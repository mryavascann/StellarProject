//! Kontrat testleri — MASTER PROMPT Bölüm 8.1'deki 30 testin tamamı.
//!
//! Bu dosya implementasyondan ÖNCE yazıldı ve hepsinin kırmızı olduğu görüldü (kural 0.2).
//! Testler "çalıştı mı" diye değil, "yanlış yapılabilecek şeyi yapıyor mu" diye yazıldı.

#![cfg(test)]

use soroban_sdk::testutils::{storage::Instance as _, Address as _, Ledger as _};
use soroban_sdk::{token, Address, Env, String};

use crate::policy;
use crate::storage::{INSTANCE_EXTEND_THRESHOLD, INSTANCE_EXTEND_TO};
use crate::types::{Error, LedgerKind, RequestStatus};
use crate::{SharedVault, SharedVaultClient};

/// 7 ondalıklı token'ın bir birimi (stroop).
const UNIT: i128 = 10_000_000;
/// ⚠ SİM — config/simulation.ts ile aynı: 20 dfToken.
const THRESHOLD: i128 = 20 * UNIT;
/// ⚠ SİM — eşik üstü talepler için gereken onay sayısı.
const QUORUM: u32 = 2;
/// ⚠ SİM — 72 saat.
const REQUEST_TTL: u64 = 259_200;

/// Test bağlamı. Client'lar `Env`'i ödünç aldığı için sahiplik burada tutulur,
/// client'lar ihtiyaç anında üretilir.
struct Ctx {
    env: Env,
    vault_id: Address,
    token_id: Address,
    admin: Address,
    a: Address,
    b: Address,
    c: Address,
}

impl Ctx {
    fn client(&self) -> SharedVaultClient<'_> {
        SharedVaultClient::new(&self.env, &self.vault_id)
    }
    fn token(&self) -> token::Client<'_> {
        token::Client::new(&self.env, &self.token_id)
    }
    fn minter(&self) -> token::StellarAssetClient<'_> {
        token::StellarAssetClient::new(&self.env, &self.token_id)
    }
    fn note(&self, text: &str) -> String {
        String::from_str(&self.env, text)
    }
    /// Kasadaki gerçek token bakiyesi. Kontratın kendi saydığı değil, zincirin gördüğü.
    fn vault_balance(&self) -> i128 {
        self.token().balance(&self.vault_id)
    }
}

/// Kurulmuş ama üyesiz kasa.
fn bare(threshold: i128, quorum: u32, request_ttl: u64) -> Ctx {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let c = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_id = sac.address();
    let vault_id = env.register(SharedVault, ());

    let ctx = Ctx {
        env,
        vault_id,
        token_id,
        admin,
        a,
        b,
        c,
    };
    ctx.client()
        .init(&ctx.admin, &ctx.token_id, &threshold, &quorum, &request_ttl);
    ctx
}

/// 4 üyeli (admin + 3), herkese 100 birim basılmış, simülasyon parametreli kasa.
fn setup() -> Ctx {
    let ctx = bare(THRESHOLD, QUORUM, REQUEST_TTL);
    let client = ctx.client();
    client.add_member(&ctx.admin, &ctx.a);
    client.add_member(&ctx.admin, &ctx.b);
    client.add_member(&ctx.admin, &ctx.c);

    let minter = ctx.minter();
    for who in [&ctx.admin, &ctx.a, &ctx.b, &ctx.c] {
        minter.mint(who, &(100 * UNIT));
    }
    ctx
}

/// a, b ve c'nin 10'ar birim yatırdığı kasa. Kasa bakiyesi 30 birim.
fn funded() -> Ctx {
    let ctx = setup();
    let client = ctx.client();
    client.deposit(&ctx.a, &(10 * UNIT));
    client.deposit(&ctx.b, &(10 * UNIT));
    client.deposit(&ctx.c, &(10 * UNIT));
    ctx
}

// ---------------------------------------------------------------------------
// YETKİLENDİRME (1–6)
// ---------------------------------------------------------------------------

/// 1. `deposit` `require_auth` olmadan çağrılamaz.
#[test]
fn t01_deposit_yetkisiz_cagrilamaz() {
    let ctx = setup();
    // Sahte yetkileri kaldır: artık her çağrı gerçek imza ister.
    ctx.env.set_auths(&[]);
    assert!(ctx.client().try_deposit(&ctx.a, &(1 * UNIT)).is_err());
}

/// 2. Üye olmayan `deposit` yapamaz.
#[test]
fn t02_uye_olmayan_deposit_yapamaz() {
    let ctx = setup();
    let yabanci = Address::generate(&ctx.env);
    ctx.minter().mint(&yabanci, &(10 * UNIT));
    assert_eq!(
        ctx.client().try_deposit(&yabanci, &(1 * UNIT)),
        Err(Ok(Error::NotMember))
    );
}

/// 3. Üye olmayan `request_spend` yapamaz.
#[test]
fn t03_uye_olmayan_talep_acamaz() {
    let ctx = funded();
    let yabanci = Address::generate(&ctx.env);
    assert_eq!(
        ctx.client()
            .try_request_spend(&yabanci, &(1 * UNIT), &ctx.note("Kira Ekim")),
        Err(Ok(Error::NotMember))
    );
}

/// 4. Üye olmayan `approve` yapamaz.
#[test]
fn t04_uye_olmayan_onaylayamaz() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(25 * UNIT), &ctx.note("Kira Ekim"));
    let yabanci = Address::generate(&ctx.env);
    assert_eq!(client.try_approve(&yabanci, &id), Err(Ok(Error::NotMember)));
}

/// 5. Admin olmayan `add_member` yapamaz.
#[test]
fn t05_admin_olmayan_uye_ekleyemez() {
    let ctx = setup();
    let yeni = Address::generate(&ctx.env);
    assert_eq!(
        ctx.client().try_add_member(&ctx.a, &yeni),
        Err(Ok(Error::NotAdmin))
    );
}

/// 6. Admin olmayan `remove_member` yapamaz.
#[test]
fn t06_admin_olmayan_uye_cikaramaz() {
    let ctx = setup();
    assert_eq!(
        ctx.client().try_remove_member(&ctx.a, &ctx.b),
        Err(Ok(Error::NotAdmin))
    );
}

// ---------------------------------------------------------------------------
// ONAY MANTIĞI (7–12)
// ---------------------------------------------------------------------------

/// 7. Eşik altı talep doğrudan `Approved`.
#[test]
fn t07_esik_alti_talep_dogrudan_onayli() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(5 * UNIT), &ctx.note("İnternet faturası"));
    assert_eq!(client.get_request(&id).status, RequestStatus::Approved);
}

/// 8. Eşik üstü talep `Pending`.
#[test]
fn t08_esik_ustu_talep_beklemede() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(25 * UNIT), &ctx.note("Kira Ekim"));
    assert_eq!(client.get_request(&id).status, RequestStatus::Pending);
}

/// 9. Talep sahibi kendini onaylayamaz.
#[test]
fn t09_talep_sahibi_kendini_onaylayamaz() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(25 * UNIT), &ctx.note("Kira Ekim"));
    assert_eq!(
        client.try_approve(&ctx.a, &id),
        Err(Ok(Error::SelfApproval))
    );
}

/// 10. Aynı üye iki kez onaylayamaz.
#[test]
fn t10_ayni_uye_iki_kez_onaylayamaz() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(25 * UNIT), &ctx.note("Kira Ekim"));
    client.approve(&ctx.b, &id);
    assert_eq!(
        client.try_approve(&ctx.b, &id),
        Err(Ok(Error::AlreadyApproved))
    );
}

/// 11. Quorum dolunca `Approved`.
#[test]
fn t11_quorum_dolunca_onaylanir() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(25 * UNIT), &ctx.note("Kira Ekim"));
    client.approve(&ctx.b, &id);
    assert_eq!(client.get_request(&id).status, RequestStatus::Pending);
    client.approve(&ctx.c, &id);
    assert_eq!(client.get_request(&id).status, RequestStatus::Approved);
}

/// 12. Quorum dolmadan `execute` başarısız.
#[test]
fn t12_quorum_dolmadan_execute_olmaz() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(25 * UNIT), &ctx.note("Kira Ekim"));
    client.approve(&ctx.b, &id);
    assert_eq!(client.try_execute(&id), Err(Ok(Error::NotApproved)));
}

// ---------------------------------------------------------------------------
// YÜRÜTME (13–17)
// ---------------------------------------------------------------------------

/// 13. `execute` yalnızca `Approved`'dan çalışır.
#[test]
fn t13_execute_yalnizca_onaylidan_calisir() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(25 * UNIT), &ctx.note("Kira Ekim"));
    assert_eq!(client.get_request(&id).status, RequestStatus::Pending);
    assert_eq!(client.try_execute(&id), Err(Ok(Error::NotApproved)));
}

/// 14. `execute` iki kez çalışmaz — durum transferden ÖNCE `Executed` yazılır.
#[test]
fn t14_execute_iki_kez_calismaz() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(5 * UNIT), &ctx.note("İnternet faturası"));
    client.execute(&id);
    assert_eq!(client.try_execute(&id), Err(Ok(Error::InvalidStatus)));
    // Para yalnızca bir kez çıkmış olmalı.
    assert_eq!(ctx.vault_balance(), 25 * UNIT);
}

/// 15. Süresi dolmuş talep `execute` edilemez.
#[test]
fn t15_suresi_dolmus_talep_execute_edilemez() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(5 * UNIT), &ctx.note("İnternet faturası"));
    ctx.env
        .ledger()
        .with_mut(|l| l.timestamp += REQUEST_TTL + 1);
    assert_eq!(client.try_execute(&id), Err(Ok(Error::RequestExpired)));
}

/// 16. `execute` fonu talep edene gönderir — admin'e veya onaylayana değil.
#[test]
fn t16_execute_fonu_talep_edene_gonderir() {
    let ctx = funded();
    let client = ctx.client();
    let onceki = ctx.token().balance(&ctx.a);
    let id = client.request_spend(&ctx.a, &(5 * UNIT), &ctx.note("İnternet faturası"));
    client.execute(&id);
    assert_eq!(ctx.token().balance(&ctx.a), onceki + 5 * UNIT);
}

/// 17. `execute` kasa bakiyesini doğru düşürür.
#[test]
fn t17_execute_kasa_bakiyesini_dusurur() {
    let ctx = funded();
    let client = ctx.client();
    assert_eq!(ctx.vault_balance(), 30 * UNIT);
    let id = client.request_spend(&ctx.a, &(5 * UNIT), &ctx.note("İnternet faturası"));
    client.execute(&id);
    assert_eq!(ctx.vault_balance(), 25 * UNIT);
    assert_eq!(client.get_balance(), 25 * UNIT);
}

// ---------------------------------------------------------------------------
// SINIR VE ARİTMETİK (18–22)
// ---------------------------------------------------------------------------

/// 18. `amount <= 0` reddedilir.
#[test]
fn t18_sifir_ve_negatif_tutar_reddedilir() {
    let ctx = funded();
    let client = ctx.client();
    assert_eq!(
        client.try_deposit(&ctx.a, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_deposit(&ctx.a, &(-1 * UNIT)),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_request_spend(&ctx.a, &0, &ctx.note("Kira Ekim")),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_request_spend(&ctx.a, &(-5 * UNIT), &ctx.note("Kira Ekim")),
        Err(Ok(Error::InvalidAmount))
    );
}

/// 19. Bakiyeden fazlası reddedilir.
#[test]
fn t19_bakiyeden_fazlasi_reddedilir() {
    let ctx = funded();
    assert_eq!(
        ctx.client()
            .try_request_spend(&ctx.a, &(30 * UNIT + 1), &ctx.note("Kira Ekim")),
        Err(Ok(Error::InsufficientBalance))
    );
}

/// 20. Tam bakiye kadar çekim çalışır.
#[test]
fn t20_tam_bakiye_kadar_cekim_calisir() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(30 * UNIT), &ctx.note("Kira Ekim"));
    client.approve(&ctx.b, &id);
    client.approve(&ctx.c, &id);
    client.execute(&id);
    assert_eq!(ctx.vault_balance(), 0);
}

/// 21. Tam eşik kadar tutar onaysız geçer (`<=` sınır davranışı).
#[test]
fn t21_tam_esik_kadar_tutar_onaysiz_gecer() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &THRESHOLD, &ctx.note("Kira Ekim"));
    assert_eq!(client.get_request(&id).status, RequestStatus::Approved);

    // Bir stroop fazlası onay ister — sınırın hangi tarafta olduğu kanıtlanıyor.
    let id2 = client.request_spend(&ctx.b, &(THRESHOLD + 1), &ctx.note("Kira Ekim"));
    assert_eq!(client.get_request(&id2).status, RequestStatus::Pending);
}

/// 22. `i128` taşması panik değil hata döndürür.
///
/// Taşmayı zincir üzerinden tetiklemek için token arzını `i128::MAX`'a taşımak gerekirdi;
/// bunun yerine taşmanın gerçekten oluştuğu yer olan aritmetik yardımcı doğrudan sınanıyor.
/// Kontrattaki her toplama bu yardımcıdan geçer.
#[test]
fn t22_i128_tasmasi_hata_dondurur() {
    assert_eq!(policy::add_i128(i128::MAX, 1), Err(Error::Overflow));
    assert_eq!(policy::add_i128(i128::MIN, -1), Err(Error::Overflow));
    assert_eq!(policy::add_i128(5, 7), Ok(12));
}

// ---------------------------------------------------------------------------
// DURUM GEÇİŞLERİ (23–26)
// ---------------------------------------------------------------------------

/// 23. `Cancelled` talep `approve` edilemez.
#[test]
fn t23_iptal_edilmis_talep_onaylanamaz() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(25 * UNIT), &ctx.note("Kira Ekim"));
    client.cancel(&ctx.a, &id);
    assert_eq!(
        client.try_approve(&ctx.b, &id),
        Err(Ok(Error::InvalidStatus))
    );
}

/// 24. `Cancelled` talep `execute` edilemez.
#[test]
fn t24_iptal_edilmis_talep_execute_edilemez() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(5 * UNIT), &ctx.note("İnternet faturası"));
    client.cancel(&ctx.a, &id);
    assert_eq!(client.try_execute(&id), Err(Ok(Error::InvalidStatus)));
    assert_eq!(ctx.vault_balance(), 30 * UNIT);
}

/// 25. `Executed` talep `cancel` edilemez.
#[test]
fn t25_yurutulmus_talep_iptal_edilemez() {
    let ctx = funded();
    let client = ctx.client();
    let id = client.request_spend(&ctx.a, &(5 * UNIT), &ctx.note("İnternet faturası"));
    client.execute(&id);
    assert_eq!(
        client.try_cancel(&ctx.a, &id),
        Err(Ok(Error::InvalidStatus))
    );
}

/// 26. `remove_member` çıkarılan üyenin bekleyen taleplerini iptal eder.
#[test]
fn t26_uye_cikarilinca_bekleyen_talepleri_iptal_olur() {
    let ctx = funded();
    let client = ctx.client();
    let benim = client.request_spend(&ctx.a, &(25 * UNIT), &ctx.note("Kira Ekim"));
    let baskasinin = client.request_spend(&ctx.b, &(25 * UNIT), &ctx.note("Kira Kasım"));

    client.remove_member(&ctx.admin, &ctx.a);

    assert_eq!(client.get_request(&benim).status, RequestStatus::Cancelled);
    // Başkasının talebi etkilenmez.
    assert_eq!(
        client.get_request(&baskasinin).status,
        RequestStatus::Pending
    );
}

// ---------------------------------------------------------------------------
// DİĞER (27–30)
// ---------------------------------------------------------------------------

/// 27. `init` iki kez çağrılamaz.
#[test]
fn t27_init_iki_kez_cagrilamaz() {
    let ctx = setup();
    assert_eq!(
        ctx.client()
            .try_init(&ctx.admin, &ctx.token_id, &THRESHOLD, &QUORUM, &REQUEST_TTL),
        Err(Ok(Error::AlreadyInitialized))
    );
}

/// 28. `emergency_exit` üyenin katkısını aşamaz.
#[test]
fn t28_acil_cikis_katkiyi_asamaz() {
    let ctx = funded();
    let client = ctx.client();
    let onceki = ctx.token().balance(&ctx.a);

    let cekilen = client.emergency_exit(&ctx.a);

    // Kasada 30 birim var ama a yalnızca 10 yatırdı.
    assert_eq!(cekilen, 10 * UNIT);
    assert_eq!(ctx.token().balance(&ctx.a), onceki + 10 * UNIT);
    assert_eq!(ctx.vault_balance(), 20 * UNIT);

    // İkinci çağrı boş döner; katkı tükendi.
    assert_eq!(
        client.try_emergency_exit(&ctx.a),
        Err(Ok(Error::ExceedsContribution))
    );
}

/// 29. Defter kayıtları deposit/execute sonrası doğru.
#[test]
fn t29_defter_kayitlari_dogru() {
    let ctx = setup();
    let client = ctx.client();
    client.deposit(&ctx.a, &(10 * UNIT));
    let id = client.request_spend(&ctx.a, &(4 * UNIT), &ctx.note("İnternet faturası"));
    client.execute(&id);

    let defter = client.get_ledger();
    assert_eq!(defter.len(), 2);

    let yatirma = defter.get(0).unwrap();
    assert_eq!(yatirma.kind, LedgerKind::Deposit);
    assert_eq!(yatirma.member, ctx.a);
    assert_eq!(yatirma.amount, 10 * UNIT);
    assert_eq!(yatirma.request_id, None);

    let harcama = defter.get(1).unwrap();
    assert_eq!(harcama.kind, LedgerKind::Spend);
    assert_eq!(harcama.member, ctx.a);
    assert_eq!(harcama.amount, 4 * UNIT);
    assert_eq!(harcama.request_id, Some(id));

    // Üye kaydı da defterle tutarlı olmalı.
    let uye = client.get_member(&ctx.a);
    assert_eq!(uye.contributed, 10 * UNIT);
    assert_eq!(uye.withdrawn, 4 * UNIT);
}

/// 30. Storage TTL uzatması çalışıyor.
#[test]
fn t30_storage_ttl_uzatiliyor() {
    let ctx = funded();

    // Zamanı eşiğin hemen altına ilerlet; aksi hâlde `extend_ttl` bilinçli olarak no-op olur.
    ctx.env
        .ledger()
        .with_mut(|l| l.sequence_number += INSTANCE_EXTEND_TO - INSTANCE_EXTEND_THRESHOLD + 1);
    let once = ctx
        .env
        .as_contract(&ctx.vault_id, || ctx.env.storage().instance().get_ttl());

    // Herhangi bir yazma işlemi TTL'i tazelemeli.
    ctx.client().deposit(&ctx.a, &(1 * UNIT));

    let sonra = ctx
        .env
        .as_contract(&ctx.vault_id, || ctx.env.storage().instance().get_ttl());

    assert!(sonra > once, "TTL tazelenmedi: {once} → {sonra}");
    assert!(sonra >= INSTANCE_EXTEND_TO);
}
