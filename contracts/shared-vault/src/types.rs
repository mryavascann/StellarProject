//! Kasanın veri modeli ve hata tipleri (MASTER PROMPT Bölüm 7.1).

use soroban_sdk::{contracterror, contracttype, Address, String, Vec};

/// Kasaya ait üye kaydı.
///
/// `contributed`/`withdrawn` **yalnızca defter içindir**; oransal pay hakkı hesabı
/// MVP'de yapılmaz (Bölüm 13 kapsam dışı). Bu alanların tek işlevsel kullanımı
/// `emergency_exit`'in üst sınırını belirlemektir.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Member {
    pub address: Address,
    pub joined_at: u64,
    /// Toplam yatırdığı dfToken (stroop).
    pub contributed: i128,
    /// Toplam çektiği dfToken (stroop).
    pub withdrawn: i128,
}

/// Harcama talebinin yaşam döngüsü.
///
/// `Expired` ayrı bir durum olarak saklanmaz; süre dolmuşsa `execute`/`approve`
/// çalışma anında reddeder. Sebebi: zamanı geçmiş her talebi ayrıca güncellemek
/// zincire gereksiz yazma maliyeti bindirir.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RequestStatus {
    Pending,
    Approved,
    Executed,
    Cancelled,
    Expired,
}

/// Harcama talebi. Eşiğin altındaki talepler onaysız yürütülebilir.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendRequest {
    pub id: u32,
    pub requester: Address,
    /// dfToken cinsinden (stroop).
    pub amount: i128,
    /// Kullanıcının yazdığı not, örn. "Kira Ekim".
    pub note: String,
    pub approvals: Vec<Address>,
    pub status: RequestStatus,
    pub created_at: u64,
    pub expires_at: u64,
}

/// Defter satırının türü.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LedgerKind {
    Deposit,
    Spend,
    EmergencyExit,
}

/// Defter satırı — "kim, ne zaman, ne kadar, hangi talep için".
///
/// Neden zincirde tutuluyor: RPC olay geçmişi ~7 gün sonra erişilemez hâle geliyor
/// (data skill). Defterin tek güvenilir kaynağı kontrat storage'ıdır.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LedgerEntry {
    pub kind: LedgerKind,
    pub member: Address,
    pub amount: i128,
    pub at: u64,
    /// Deposit ve emergency_exit satırlarında `None`.
    pub request_id: Option<u32>,
}

/// Kasanın kurulum parametreleri. Kontratın içinde hiçbir sabit yoktur;
/// hepsi `init` ile dışarıdan gelir (simülasyon değerleri: config/simulation.ts).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    /// Kasanın tuttuğu tek varlık: DeFindex vault payı (KARAR K-001).
    pub share_token: Address,
    /// Onaysız harcama üst limiti (stroop). Sınır dâhildir: `amount <= threshold`.
    pub threshold: i128,
    /// Eşik üstü talepler için gereken onay sayısı.
    pub quorum: u32,
    /// Talep ömrü (saniye).
    pub request_ttl: u64,
}

/// Kontrat hataları.
///
/// Neden `panic!` değil: panik, çağıran tarafta ayırt edilemeyen tek bir hata olur;
/// arayüz "neden olmadı" sorusuna Türkçe cevap veremez. Her hata ayrı koddur.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAdmin = 3,
    NotMember = 4,
    AlreadyMember = 5,
    InvalidAmount = 6,
    InsufficientBalance = 7,
    RequestNotFound = 8,
    NotApproved = 9,
    AlreadyApproved = 10,
    SelfApproval = 11,
    RequestExpired = 12,
    InvalidStatus = 13,
    NotAuthorized = 14,
    Overflow = 15,
    InvalidConfig = 16,
    ExceedsContribution = 17,
}
