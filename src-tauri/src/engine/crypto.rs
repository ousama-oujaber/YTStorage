use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

pub const SALT_LEN: usize = 16;
pub const NONCE_LEN: usize = 12;

fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    // n = 2^15 = 32768, r = 8, p = 1, length = 32
    let params = scrypt::Params::new(15, 8, 1, 32)
        .map_err(|e| format!("Invalid Scrypt parameters: {:?}", e))?;
    let mut key = [0u8; 32];
    scrypt::scrypt(password.as_bytes(), salt, &params, &mut key)
        .map_err(|e| format!("Scrypt key derivation failed: {:?}", e))?;
    Ok(key)
}

pub fn encrypt(data: &[u8], password: &str) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce = [0u8; NONCE_LEN];
    let mut rng = rand::thread_rng();
    rng.fill_bytes(&mut salt);
    rng.fill_bytes(&mut nonce);

    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("AES-GCM cipher init error: {:?}", e))?;
    let nonce_obj = Nonce::from_slice(&nonce);
    let ciphertext = cipher
        .encrypt(nonce_obj, data)
        .map_err(|e| format!("Encryption error: {:?}", e))?;

    let mut out = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

pub fn decrypt(blob: &[u8], password: &str) -> Result<Vec<u8>, String> {
    if blob.len() < SALT_LEN + NONCE_LEN + 16 {
        return Err("Encrypted blob is too short".to_string());
    }

    let salt = &blob[..SALT_LEN];
    let nonce = &blob[SALT_LEN..SALT_LEN + NONCE_LEN];
    let ct = &blob[SALT_LEN + NONCE_LEN..];

    let key = derive_key(password, salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("AES-GCM cipher init error: {:?}", e))?;
    let nonce_obj = Nonce::from_slice(nonce);
    let plaintext = cipher
        .decrypt(nonce_obj, ct)
        .map_err(|_| "Decryption failed: incorrect password or corrupted data".to_string())?;

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let msg = b"Super secret test payload for YTDisk!";
        let pass = "correct-horse-battery-staple";
        let encrypted = encrypt(msg, pass).unwrap();
        assert_ne!(&encrypted[..], &msg[..]);

        let decrypted = decrypt(&encrypted, pass).unwrap();
        assert_eq!(&decrypted[..], &msg[..]);

        // Wrong password should fail
        assert!(decrypt(&encrypted, "wrong-password").is_err());
    }
}

