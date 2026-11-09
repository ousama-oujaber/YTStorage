use reed_solomon::{Decoder, Encoder};
use serde::{Deserialize, Serialize};

use crate::engine::config::{
    HEADER_BLOCK, HEADER_NSYM, MAGIC, RS_N,
};
use crate::engine::frame::{bits_to_bytes, bits_to_frame, bytes_to_bits, frame_to_bits};

pub const H_CAPACITY: usize = 8040 / 8; // 1005 bytes
pub const H_CODEWORDS: usize = H_CAPACITY / RS_N; // 3
pub const H_CHUNK_K: usize = RS_N - HEADER_NSYM; // 191
pub const H_MAX_DATA: usize = H_CODEWORDS * H_CHUNK_K; // 573 bytes

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Metadata {
    pub magic: String,
    pub v: u32,
    pub name: String,
    pub size: usize,
    pub sha256: String,
    pub payload_len: usize,
    pub codewords: usize,
    pub block: usize,
    pub nsym: usize,
    pub frames: usize,
    pub encrypted: bool,
}

pub fn make_header_frame(meta: &Metadata) -> Result<Vec<u8>, String> {
    let raw = serde_json::to_vec(meta).map_err(|e| e.to_string())?;
    if raw.len() > H_MAX_DATA - 2 {
        return Err("Header too large (filename or metadata exceeds maximum allowed header size)".to_string());
    }

    let mut data = Vec::with_capacity(H_MAX_DATA);
    let len = raw.len() as u16;
    data.push((len >> 8) as u8);
    data.push((len & 0xFF) as u8);
    data.extend_from_slice(&raw);
    data.resize(H_MAX_DATA, 0u8);

    let enc = Encoder::new(HEADER_NSYM);
    let mut encoded = Vec::with_capacity(H_CODEWORDS * RS_N);

    for chunk in data.chunks_exact(H_CHUNK_K) {
        let cw = enc.encode(chunk);
        encoded.extend_from_slice(&cw);
    }

    let bits = bytes_to_bits(&encoded);
    Ok(bits_to_frame(&bits, HEADER_BLOCK))
}

pub fn read_header_frame(frame: &[u8]) -> Option<Metadata> {
    let bits = frame_to_bits(frame, HEADER_BLOCK);
    let all_bytes = bits_to_bytes(&bits);
    if all_bytes.len() < H_CODEWORDS * RS_N {
        return None;
    }
    let data = &all_bytes[..H_CODEWORDS * RS_N];

    let dec = Decoder::new(HEADER_NSYM);
    let mut decoded = Vec::with_capacity(H_MAX_DATA);

    for chunk in data.chunks_exact(RS_N) {
        match dec.correct(chunk, None) {
            Ok(recovered) => {
                decoded.extend_from_slice(recovered.data());
            }
            Err(_) => return None,
        }
    }

    if decoded.len() < 2 {
        return None;
    }

    let raw_len = ((decoded[0] as usize) << 8) | (decoded[1] as usize);
    if decoded.len() < 2 + raw_len {
        return None;
    }

    let raw_slice = &decoded[2..2 + raw_len];
    let meta: Metadata = serde_json::from_slice(raw_slice).ok()?;
    if meta.magic == MAGIC {
        Some(meta)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_frame_roundtrip() {
        let meta = Metadata {
            magic: MAGIC.to_string(),
            v: 1,
            name: "document.pdf".to_string(),
            size: 1048576,
            sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string(),
            payload_len: 1048604,
            codewords: 4703,
            block: 4,
            nsym: 32,
            frames: 65,
            encrypted: true,
        };

        let frame = make_header_frame(&meta).expect("Failed to create header frame");
        assert_eq!(frame.len(), 1920 * 1080);

        let parsed = read_header_frame(&frame).expect("Failed to read header frame");
        assert_eq!(parsed, meta);
    }
}

