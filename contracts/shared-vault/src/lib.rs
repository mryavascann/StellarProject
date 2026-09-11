#![no_std]
//! `shared_vault` — ortak kasa kontratı.
//!
//! Kasanın tuttuğu tek varlık DeFindex vault payıdır (dfToken). Kontrat tek token
//! türüyle çalışır ve cross-contract DeFindex çağrısı yapmaz (KARAR K-001).
//! Simülasyonda dfToken yerine SEP-41 arayüzlü bir test token'ı kullanılır;
//! kontrat açısından aradaki fark sıfırdır.

mod policy;
mod storage;
mod test;
mod types;

use soroban_sdk::{contract, contractimpl, token, Address, Env, String, Vec};

pub use types::{Config, Error, LedgerEntry, LedgerKind, Member, RequestStatus, SpendRequest};

#[contract]
pub struct SharedVault;

#[contractimpl]
impl SharedVault {
    /// Kasayı kurar. Bir kez çağrılabilir; ikinci çağrı `AlreadyInitialized` döner.
    /// Admin aynı zamanda ilk üyedir.
    pub fn init(
        env: Env,
        admin: Address,
        share_token: Address,
        threshold: i128,
        quorum: u32,
        request_ttl: u64,
    ) -> Result<(), Error> {
        if storage::is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        if threshold <= 0 || quorum == 0 || request_ttl == 0 {
            return Err(Error::InvalidConfig);
        }
        admin.require_auth();

        let config = Config {
            admin: admin.clone(),
            share_token,
            threshold,
            quorum,
            request_ttl,
        };
        let member = Member {
            address: admin.clone(),
            joined_at: env.ledger().timestamp(),
            contributed: 0,
            withdrawn: 0,
        };
        let mut members = Vec::new(&env);
        members.push_back(admin);

        storage::set_config(&env, &config);
        storage::set_member(&env, &member);
        storage::set_member_list(&env, &members);
        storage::set_next_request_id(&env, 0);
        storage::set_request_list(&env, &Vec::new(&env));
        storage::touch_instance(&env);
        Ok(())
    }

    /// Üye ekler. Yalnızca admin.
    pub fn add_member(env: Env, caller: Address, new_member: Address) -> Result<(), Error> {
        let config = storage::get_config(&env)?;
        caller.require_auth();
        if caller != config.admin {
            return Err(Error::NotAdmin);
        }
        if storage::has_member(&env, &new_member) {
            return Err(Error::AlreadyMember);
        }

        let member = Member {
            address: new_member.clone(),
            joined_at: env.ledger().timestamp(),
            contributed: 0,
            withdrawn: 0,
        };
        let mut members = storage::get_member_list(&env);
        members.push_back(new_member);
        storage::set_member(&env, &member);
        storage::set_member_list(&env, &members);
        storage::touch_instance(&env);
        Ok(())
    }

    /// Üye çıkarır ve o üyenin bekleyen taleplerini iptal eder. Yalnızca admin.
    pub fn remove_member(env: Env, caller: Address, member: Address) -> Result<(), Error> {
        let config = storage::get_config(&env)?;
        caller.require_auth();
        if caller != config.admin {
            return Err(Error::NotAdmin);
        }
        if member == config.admin {
            return Err(Error::NotAuthorized);
        }
        storage::get_member(&env, &member)?;

        let mut kept = Vec::new(&env);
        for address in storage::get_member_list(&env).iter() {
            if address != member {
                kept.push_back(address);
            }
        }
        for id in storage::get_request_list(&env).iter() {
            let mut request = storage::get_request(&env, id)?;
            if request.requester == member && request.status == RequestStatus::Pending {
                request.status = RequestStatus::Cancelled;
                storage::set_request(&env, &request);
            }
        }
        storage::remove_member(&env, &member);
        storage::set_member_list(&env, &kept);
        storage::touch_instance(&env);
        Ok(())
    }

    /// Üyenin dfToken'ını kontrata çeker ve deftere yazar.
    pub fn deposit(env: Env, member: Address, amount: i128) -> Result<(), Error> {
        policy::require_positive(amount)?;
        member.require_auth();
        let config = storage::get_config(&env)?;
        let mut record = storage::get_member(&env, &member)?;

        token::Client::new(&env, &config.share_token).transfer(
            &member,
            &env.current_contract_address(),
            &amount,
        );
        record.contributed = policy::add_i128(record.contributed, amount)?;
        storage::set_member(&env, &record);
        storage::append_ledger(
            &env,
            &LedgerEntry {
                kind: LedgerKind::Deposit,
                member,
                amount,
                at: env.ledger().timestamp(),
                request_id: None,
            },
        );
        storage::touch_instance(&env);
        Ok(())
    }

    /// Harcama talebi açar. `amount <= threshold` ise doğrudan `Approved` olur.
    pub fn request_spend(
        env: Env,
        member: Address,
        amount: i128,
        note: String,
    ) -> Result<u32, Error> {
        policy::require_positive(amount)?;
        member.require_auth();
        storage::get_member(&env, &member)?;
        let config = storage::get_config(&env)?;
        let balance =
            token::Client::new(&env, &config.share_token).balance(&env.current_contract_address());
        if amount > balance {
            return Err(Error::InsufficientBalance);
        }

        let id = storage::get_next_request_id(&env);
        let next_id = id.checked_add(1).ok_or(Error::Overflow)?;
        let now = env.ledger().timestamp();
        let request = SpendRequest {
            id,
            requester: member,
            amount,
            note,
            approvals: Vec::new(&env),
            status: if policy::is_below_threshold(amount, config.threshold) {
                RequestStatus::Approved
            } else {
                RequestStatus::Pending
            },
            created_at: now,
            expires_at: policy::add_u64(now, config.request_ttl)?,
        };
        let mut requests = storage::get_request_list(&env);
        requests.push_back(id);
        storage::set_request(&env, &request);
        storage::set_request_list(&env, &requests);
        storage::set_next_request_id(&env, next_id);
        storage::touch_instance(&env);
        Ok(id)
    }

    /// Onay ekler; onay sayısı quorum'a ulaşınca talep `Approved` olur.
    pub fn approve(env: Env, member: Address, request_id: u32) -> Result<(), Error> {
        member.require_auth();
        storage::get_member(&env, &member)?;
        let config = storage::get_config(&env)?;
        let mut request = storage::get_request(&env, request_id)?;
        if request.status != RequestStatus::Pending {
            return Err(Error::InvalidStatus);
        }
        if env.ledger().timestamp() > request.expires_at {
            return Err(Error::RequestExpired);
        }
        if request.requester == member {
            return Err(Error::SelfApproval);
        }
        for approver in request.approvals.iter() {
            if approver == member {
                return Err(Error::AlreadyApproved);
            }
        }
        request.approvals.push_back(member);
        if policy::has_quorum(request.approvals.len(), config.quorum) {
            request.status = RequestStatus::Approved;
        }
        storage::set_request(&env, &request);
        storage::touch_instance(&env);
        Ok(())
    }

    /// Onaylı talebi yürütür: dfToken'ı **talep edene** gönderir (KARAR K-002).
    pub fn execute(env: Env, request_id: u32) -> Result<(), Error> {
        let config = storage::get_config(&env)?;
        let mut request = storage::get_request(&env, request_id)?;
        if request.status == RequestStatus::Pending {
            return Err(Error::NotApproved);
        }
        if request.status != RequestStatus::Approved {
            return Err(Error::InvalidStatus);
        }
        if env.ledger().timestamp() > request.expires_at {
            return Err(Error::RequestExpired);
        }
        let token_client = token::Client::new(&env, &config.share_token);
        if request.amount > token_client.balance(&env.current_contract_address()) {
            return Err(Error::InsufficientBalance);
        }

        request.status = RequestStatus::Executed;
        storage::set_request(&env, &request);
        let mut member = storage::get_member(&env, &request.requester)?;
        member.withdrawn = policy::add_i128(member.withdrawn, request.amount)?;
        storage::set_member(&env, &member);
        storage::append_ledger(
            &env,
            &LedgerEntry {
                kind: LedgerKind::Spend,
                member: request.requester.clone(),
                amount: request.amount,
                at: env.ledger().timestamp(),
                request_id: Some(request.id),
            },
        );
        token_client.transfer(
            &env.current_contract_address(),
            &request.requester,
            &request.amount,
        );
        storage::touch_instance(&env);
        Ok(())
    }

    /// Talebi iptal eder. Talep sahibi veya admin.
    pub fn cancel(env: Env, caller: Address, request_id: u32) -> Result<(), Error> {
        caller.require_auth();
        let config = storage::get_config(&env)?;
        let mut request = storage::get_request(&env, request_id)?;
        if caller != request.requester && caller != config.admin {
            return Err(Error::NotAuthorized);
        }
        if request.status != RequestStatus::Pending && request.status != RequestStatus::Approved {
            return Err(Error::InvalidStatus);
        }
        request.status = RequestStatus::Cancelled;
        storage::set_request(&env, &request);
        storage::touch_instance(&env);
        Ok(())
    }
}
