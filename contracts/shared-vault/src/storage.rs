//! Storage anahtarları ve TTL yönetimi.
//!
//! Neden ayrı dosya: Soroban'da storage kirası vardır, her kayıt arşivlenebilir.
//! TTL uzatmayı çağrı noktalarına dağıtırsan bir yerde unutulur ve kasa demo günü
//! "yok" görünür. Uzatma tek bir yerden yapılır.

use soroban_sdk::{contractimpl, contracttype, token, Address, Env, Vec};

use crate::policy;
use crate::types::{Config, Error, LedgerEntry, LedgerKind, Member, SpendRequest};
use crate::{SharedVault, SharedVaultArgs, SharedVaultClient};

/// Instance storage TTL eşiği (ledger). Kalan ömür bunun altına inince uzatılır.
pub const INSTANCE_EXTEND_THRESHOLD: u32 = 100_000;
/// Instance storage'ın uzatılacağı hedef ömür (ledger) ≈ 30 gün.
pub const INSTANCE_EXTEND_TO: u32 = 518_400;

/// Persistent storage eşiği ve hedefi. Talepler ve defter burada yaşar.
pub const PERSISTENT_EXTEND_THRESHOLD: u32 = 100_000;
pub const PERSISTENT_EXTEND_TO: u32 = 518_400;

/// Storage anahtarları.
///
/// `Member(Address)` ve `Request(u32)` ayrı anahtarlardır; hepsini tek bir `Vec`'e
/// koymak, üye sayısı büyüdükçe her okumada tüm listeyi çözmek demek olurdu.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Kurulum parametreleri (admin, share_token, threshold, quorum, request_ttl).
    Config,
    /// Üye adreslerinin sırası — kayıtların kendisi `Member(Address)` altında.
    MemberList,
    Member(Address),
    /// Bir sonraki talep id'si.
    NextRequestId,
    Request(u32),
    /// Talep id'lerinin listesi — `get_requests` bunun üzerinden dolaşır.
    RequestList,
    /// Defter satırları.
    Ledger,
}

/// Kontratın kurulu olup olmadığını bildirir; kurulum kontrolünü tek anahtara bağlar.
pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Config)
}

/// Instance storage ömrünü her başarılı kullanımda tazeler; kasanın arşivlenmesini önler.
pub fn touch_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_EXTEND_THRESHOLD, INSTANCE_EXTEND_TO);
}

/// Kurulum ayarlarını yazar; tüm politika değerlerinin tek kaynağı olmasını sağlar.
pub fn set_config(env: &Env, config: &Config) {
    env.storage().instance().set(&DataKey::Config, config);
}

/// Kurulum ayarlarını okur ve kurulmamış kontratı açık bir hatayla reddeder.
pub fn get_config(env: &Env) -> Result<Config, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .ok_or(Error::NotInitialized)
}

/// Üye adres sırasını okur; ilk kurulumda boş liste döndürür.
pub fn get_member_list(env: &Env) -> Vec<Address> {
    env.storage()
        .instance()
        .get(&DataKey::MemberList)
        .unwrap_or(Vec::new(env))
}

/// Üye adres sırasını yazar; okuma fonksiyonlarının kararlı sırada sonuç vermesini sağlar.
pub fn set_member_list(env: &Env, members: &Vec<Address>) {
    env.storage().instance().set(&DataKey::MemberList, members);
}

/// Üye kaydının varlığını bildirir.
pub fn has_member(env: &Env, address: &Address) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Member(address.clone()))
}

/// Üye kaydını yazar ve persistent storage ömrünü tazeler.
pub fn set_member(env: &Env, member: &Member) {
    let key = DataKey::Member(member.address.clone());
    env.storage().persistent().set(&key, member);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_EXTEND_THRESHOLD, PERSISTENT_EXTEND_TO);
}

/// Üye kaydını okur ve yoksa `NotMember` döndürür.
pub fn get_member(env: &Env, address: &Address) -> Result<Member, Error> {
    let key = DataKey::Member(address.clone());
    let member = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::NotMember)?;
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_EXTEND_THRESHOLD, PERSISTENT_EXTEND_TO);
    Ok(member)
}

/// Üye kaydını kaldırır; adres listesi çağıran tarafından ayrıca güncellenir.
pub fn remove_member(env: &Env, address: &Address) {
    env.storage()
        .persistent()
        .remove(&DataKey::Member(address.clone()));
}

/// Sıradaki talep kimliğini okur; ilk talep sıfır kimliğini alır.
pub fn get_next_request_id(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::NextRequestId)
        .unwrap_or(0)
}

/// Sıradaki talep kimliğini yazar.
pub fn set_next_request_id(env: &Env, id: u32) {
    env.storage().instance().set(&DataKey::NextRequestId, &id);
}

/// Talep kimliklerinin oluşturulma sırasını okur.
pub fn get_request_list(env: &Env) -> Vec<u32> {
    env.storage()
        .instance()
        .get(&DataKey::RequestList)
        .unwrap_or(Vec::new(env))
}

/// Talep kimliklerinin oluşturulma sırasını yazar.
pub fn set_request_list(env: &Env, requests: &Vec<u32>) {
    env.storage()
        .instance()
        .set(&DataKey::RequestList, requests);
}

/// Talebi yazar ve persistent storage ömrünü tazeler.
pub fn set_request(env: &Env, request: &SpendRequest) {
    let key = DataKey::Request(request.id);
    env.storage().persistent().set(&key, request);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_EXTEND_THRESHOLD, PERSISTENT_EXTEND_TO);
}

/// Talebi okur ve bilinmeyen kimliği açık bir hatayla reddeder.
pub fn get_request(env: &Env, id: u32) -> Result<SpendRequest, Error> {
    let key = DataKey::Request(id);
    let request = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::RequestNotFound)?;
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_EXTEND_THRESHOLD, PERSISTENT_EXTEND_TO);
    Ok(request)
}

/// Defterin tamamını okur; ilk işlemden önce boş liste döndürür.
pub fn get_ledger(env: &Env) -> Vec<LedgerEntry> {
    let key = DataKey::Ledger;
    let ledger = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env));
    if env.storage().persistent().has(&key) {
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_EXTEND_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );
    }
    ledger
}

/// Deftere yeni satır ekler ve geçmişin storage ömrünü tazeler.
pub fn append_ledger(env: &Env, entry: &LedgerEntry) {
    let key = DataKey::Ledger;
    let mut ledger = get_ledger(env);
    ledger.push_back(entry.clone());
    env.storage().persistent().set(&key, &ledger);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_EXTEND_THRESHOLD, PERSISTENT_EXTEND_TO);
}

#[contractimpl]
impl SharedVault {
    /// Kasa kilitlenirse üyenin net katkısı kadarını tek başına çekmesine izin verir.
    /// Çekilen tutarı döndürür; böylece arayüz net sonucu ayrıca hesaplamaz.
    pub fn emergency_exit(env: Env, member: Address) -> Result<i128, Error> {
        member.require_auth();
        let config = get_config(&env)?;
        let mut record = get_member(&env, &member)?;
        let amount = policy::sub_i128(record.contributed, record.withdrawn)?;
        if amount <= 0 {
            return Err(Error::ExceedsContribution);
        }
        let token_client = token::Client::new(&env, &config.share_token);
        if amount > token_client.balance(&env.current_contract_address()) {
            return Err(Error::InsufficientBalance);
        }

        record.withdrawn = policy::add_i128(record.withdrawn, amount)?;
        set_member(&env, &record);
        append_ledger(
            &env,
            &LedgerEntry {
                kind: LedgerKind::EmergencyExit,
                member: member.clone(),
                amount,
                at: env.ledger().timestamp(),
                request_id: None,
            },
        );
        token_client.transfer(&env.current_contract_address(), &member, &amount);
        touch_instance(&env);
        Ok(amount)
    }

    /// Kasadaki dfToken bakiyesini kontratın tuttuğu token üzerinden okur.
    pub fn get_balance(env: Env) -> Result<i128, Error> {
        let config = get_config(&env)?;
        touch_instance(&env);
        Ok(token::Client::new(&env, &config.share_token).balance(&env.current_contract_address()))
    }

    /// Üyeleri katılım sırasıyla döndürür; çıkarılmış üyeleri listelemez.
    pub fn get_members(env: Env) -> Result<Vec<Member>, Error> {
        get_config(&env)?;
        let mut members = Vec::new(&env);
        for address in get_member_list(&env).iter() {
            members.push_back(get_member(&env, &address)?);
        }
        touch_instance(&env);
        Ok(members)
    }

    /// Tek bir üye kaydını döndürür; adres üye değilse `NotMember` verir.
    pub fn get_member(env: Env, member: Address) -> Result<Member, Error> {
        get_config(&env)?;
        let result = get_member(&env, &member)?;
        touch_instance(&env);
        Ok(result)
    }

    /// Tüm harcama taleplerini oluşturulma sırasıyla döndürür.
    pub fn get_requests(env: Env) -> Result<Vec<SpendRequest>, Error> {
        get_config(&env)?;
        let mut requests = Vec::new(&env);
        for id in get_request_list(&env).iter() {
            requests.push_back(get_request(&env, id)?);
        }
        touch_instance(&env);
        Ok(requests)
    }

    /// Kimliği verilen harcama talebini döndürür.
    pub fn get_request(env: Env, request_id: u32) -> Result<SpendRequest, Error> {
        get_config(&env)?;
        let result = get_request(&env, request_id)?;
        touch_instance(&env);
        Ok(result)
    }

    /// Kalıcı işlem defterini kronolojik sırayla döndürür.
    pub fn get_ledger(env: Env) -> Result<Vec<LedgerEntry>, Error> {
        get_config(&env)?;
        let result = get_ledger(&env);
        touch_instance(&env);
        Ok(result)
    }
}
