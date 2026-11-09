use reed_solomon::{Decoder, Encoder};
use crate::engine::config::RS_N;

pub fn num_codewords(payload_len: usize, nsym: usize) -> usize {
    if nsym == 0 {
        return 0;
    }
    let k = RS_N - nsym;
    (payload_len + k - 1) / k
}

pub fn ecc_encode(data: &[u8], nsym: usize) -> Vec<u8> {
    if nsym == 0 {
        return data.to_vec();
    }
    let k = RS_N - nsym;
    let pad_len = (k - (data.len() % k)) % k;

    let mut padded = Vec::with_capacity(data.len() + pad_len);
    padded.extend_from_slice(data);
    padded.resize(data.len() + pad_len, 0u8);

    let n_codewords = padded.len() / k;
    let enc = Encoder::new(nsym);

    // Each codeword is 255 bytes (k data + nsym parity)
    let mut codewords: Vec<Vec<u8>> = Vec::with_capacity(n_codewords);
    for chunk in padded.chunks_exact(k) {
        let cw = enc.encode(chunk).to_vec();
        codewords.push(cw);
    }

    // Interleave via matrix transposition: shape (n_codewords, RS_N).T -> (RS_N, n_codewords)
    let mut interleaved = Vec::with_capacity(n_codewords * RS_N);
    for j in 0..RS_N {
        for i in 0..n_codewords {
            interleaved.push(codewords[i][j]);
        }
    }

    interleaved
}

pub fn ecc_decode(data: &[u8], n_codewords: usize, nsym: usize) -> Result<(Vec<u8>, usize), String> {
    if nsym == 0 {
        return Ok((data.to_vec(), 0));
    }
    let total = n_codewords * RS_N;
    if data.len() < total {
        return Err(format!(
            "Not enough data for Reed-Solomon decoding: expected at least {} bytes, got {}",
            total,
            data.len()
        ));
    }

    let dec = Decoder::new(nsym);
    let mut out = Vec::with_capacity(n_codewords * (RS_N - nsym));
    let mut fixed = 0;

    for i in 0..n_codewords {
        let mut cw = vec![0u8; RS_N];
        for j in 0..RS_N {
            cw[j] = data[j * n_codewords + i];
        }

        match dec.correct_err_count(&cw, None) {
            Ok((recovered, err_count)) => {
                fixed += err_count;
                out.extend_from_slice(recovered.data());
            }
            Err(e) => {
                return Err(format!(
                    "Codeword {}/{} unrecoverable: {:?}",
                    i + 1,
                    n_codewords,
                    e
                ));
            }
        }
    }

    Ok((out, fixed))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ecc_roundtrip() {
        let original = b"Hello Reed-Solomon in Rust with transposed interleaving!";
        let nsym = 32;
        let encoded = ecc_encode(original, nsym);
        let n_cw = num_codewords(original.len(), nsym);
        assert_eq!(n_cw, 1);
        assert_eq!(encoded.len(), 255);

        let (decoded, fixed) = ecc_decode(&encoded, n_cw, nsym).unwrap();
        assert_eq!(fixed, 0);
        assert_eq!(&decoded[..original.len()], original);
    }

    #[test]
    fn test_ecc_corruption_recovery() {
        let original = b"Test error recovery with burst errors across codewords!";
        let nsym = 32;
        let mut encoded = ecc_encode(original, nsym);
        let n_cw = num_codewords(original.len(), nsym);

        // Corrupt up to 10 bytes in the encoded stream
        for idx in [5, 12, 25, 40, 80, 100, 150, 200] {
            if idx < encoded.len() {
                encoded[idx] ^= 0xAA;
            }
        }

        let (decoded, fixed) = ecc_decode(&encoded, n_cw, nsym).unwrap();
        assert!(fixed > 0);
        assert_eq!(&decoded[..original.len()], original);
    }
}

