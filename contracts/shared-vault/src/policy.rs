//! Kasa kuralları ve güvenli aritmetik.
//!
//! Neden ayrı dosya: onay kuralı (eşik/quorum) ve taşma denetimi, kontratın
//! yürütme akışından bağımsız olarak tek tek sınanabilmeli.

use crate::types::Error;

/// Taşmada panik yerine hata döndüren toplama.
///
/// Neden: `overflow-checks = true` ile taşma panik üretir; panik çağıran tarafta
/// ayırt edilemeyen tek bir hataya dönüşür ve arayüz "neden olmadı" diyemez.
/// Kontrattaki her i128 toplaması buradan geçer.
pub fn add_i128(a: i128, b: i128) -> Result<i128, Error> {
    a.checked_add(b).ok_or(Error::Overflow)
}

/// Taşmada panik yerine hata döndüren çıkarma.
pub fn sub_i128(a: i128, b: i128) -> Result<i128, Error> {
    a.checked_sub(b).ok_or(Error::Overflow)
}

/// Taşmada panik yerine hata döndüren u64 toplaması (talep son kullanma zamanı için).
pub fn add_u64(a: u64, b: u64) -> Result<u64, Error> {
    a.checked_add(b).ok_or(Error::Overflow)
}

/// Tutarın geçerli olup olmadığı. Sıfır ve negatif reddedilir.
pub fn require_positive(amount: i128) -> Result<(), Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }
    Ok(())
}

/// Bu tutar onaysız harcanabilir mi?
///
/// Sınır DÂHİLDİR: tam eşik kadar tutar onay istemez (Bölüm 8.1 test 21).
pub fn is_below_threshold(amount: i128, threshold: i128) -> bool {
    amount <= threshold
}

/// Onay sayısı yeterli mi?
pub fn has_quorum(approval_count: u32, quorum: u32) -> bool {
    approval_count >= quorum
}
