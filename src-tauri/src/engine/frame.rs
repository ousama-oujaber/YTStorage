use crate::engine::config::{GRID_H, GRID_W};

pub fn bytes_to_bits(data: &[u8]) -> Vec<u8> {
    let mut bits = Vec::with_capacity(data.len() * 8);
    for &b in data {
        for i in (0..8).rev() {
            bits.push((b >> i) & 1);
        }
    }
    bits
}

pub fn bits_to_bytes(bits: &[u8]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity((bits.len() + 7) / 8);
    for chunk in bits.chunks(8) {
        let mut b = 0u8;
        for (i, &bit) in chunk.iter().enumerate() {
            b |= (bit & 1) << (7 - i);
        }
        bytes.push(b);
    }
    bytes
}

pub fn grid(block: usize) -> (usize, usize) {
    (GRID_W / block, GRID_H / block)
}

pub fn bits_per_frame(block: usize) -> usize {
    let (cols, rows) = grid(block);
    cols * rows
}

pub fn bits_to_frame(bits: &[u8], block: usize) -> Vec<u8> {
    let (cols, rows) = grid(block);
    let mut frame = vec![0u8; GRID_W * GRID_H];

    for r in 0..rows {
        for c in 0..cols {
            let idx = r * cols + c;
            let val = if idx < bits.len() && bits[idx] == 1 {
                255u8
            } else {
                0u8
            };

            for by in 0..block {
                let y = r * block + by;
                let row_offset = y * GRID_W;
                for bx in 0..block {
                    let x = c * block + bx;
                    frame[row_offset + x] = val;
                }
            }
        }
    }

    frame
}

pub fn frame_to_bits(frame: &[u8], block: usize) -> Vec<u8> {
    let (cols, rows) = grid(block);
    let mut bits = Vec::with_capacity(cols * rows);
    let m = block / 4;
    let sample_h = block - 2 * m;
    let sample_w = block - 2 * m;
    let sample_count = (sample_h * sample_w) as u64;

    for r in 0..rows {
        for c in 0..cols {
            let mut sum: u64 = 0;
            for sy in 0..sample_h {
                let y = r * block + m + sy;
                let row_offset = y * GRID_W;
                for sx in 0..sample_w {
                    let x = c * block + m + sx;
                    sum += frame[row_offset + x] as u64;
                }
            }
            let bit = if sum > 127 * sample_count { 1 } else { 0 };
            bits.push(bit);
        }
    }

    bits
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bits_bytes_roundtrip() {
        let original = vec![0x00, 0xFF, 0x55, 0xAA, 0x12, 0x34, 0xDE, 0xAD];
        let bits = bytes_to_bits(&original);
        assert_eq!(bits.len(), original.len() * 8);

        let recovered = bits_to_bytes(&bits);
        assert_eq!(recovered, original);
    }

    #[test]
    fn test_frame_bits_roundtrip() {
        let block = 4;
        let bpf = bits_per_frame(block);
        let mut bits = Vec::with_capacity(bpf);
        for i in 0..bpf {
            bits.push(((i * 7 + 3) % 2) as u8);
        }

        let frame = bits_to_frame(&bits, block);
        assert_eq!(frame.len(), GRID_W * GRID_H);

        let recovered_bits = frame_to_bits(&frame, block);
        assert_eq!(recovered_bits, bits);
    }
}

