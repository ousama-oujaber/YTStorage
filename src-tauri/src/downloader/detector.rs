use regex::Regex;
use crate::downloader::types::DownloadProvider;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectedSource {
    pub provider: DownloadProvider,
    pub id: String,
    pub normalized_url: String,
}

pub fn detect_provider(url: &str) -> Result<DetectedSource, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    // Google Drive check
    let gdrive_regexes = [
        Regex::new(r"drive\.google\.com/file/d/([a-zA-Z0-9_-]+)").unwrap(),
        Regex::new(r"drive\.google\.com/open\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)").unwrap(),
        Regex::new(r"drive\.google\.com/uc\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)").unwrap(),
    ];

    for re in &gdrive_regexes {
        if let Some(caps) = re.captures(trimmed) {
            let id = caps[1].to_string();
            let normalized = format!("https://drive.google.com/uc?export=download&id={}", id);
            return Ok(DetectedSource {
                provider: DownloadProvider::GoogleDrive,
                id,
                normalized_url: normalized,
            });
        }
    }

    // YouTube check
    let yt_regexes = [
        Regex::new(r"(?:youtube\.com/watch\?(?:[^&]*&)*v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})").unwrap(),
    ];

    for re in &yt_regexes {
        if let Some(caps) = re.captures(trimmed) {
            let id = caps[1].to_string();
            let normalized = format!("https://www.youtube.com/watch?v={}", id);
            return Ok(DetectedSource {
                provider: DownloadProvider::YouTube,
                id,
                normalized_url: normalized,
            });
        }
    }

    // Explicitly reject unsupported domains
    if trimmed.contains("google.com") || trimmed.contains("youtube.com") || trimmed.contains("youtu.be") {
        return Err("Could not extract video/file ID from the URL. Please verify the link.".to_string());
    }

    Err("Unsupported provider. YTDisk only supports downloading from YouTube and Google Drive.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_youtube() {
        let urls = [
            ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://youtube.com/shorts/dQw4w9WgXcQ?feature=share", "dQw4w9WgXcQ"),
            ("https://www.youtube.com/watch?feature=related&v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ];

        for (url, expected_id) in urls {
            let res = detect_provider(url).unwrap();
            assert_eq!(res.provider, DownloadProvider::YouTube);
            assert_eq!(res.id, expected_id);
        }
    }

    #[test]
    fn test_detect_gdrive() {
        let urls = [
            ("https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing", "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"),
            ("https://drive.google.com/open?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs", "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"),
            ("https://drive.google.com/uc?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs&export=download", "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"),
        ];

        for (url, expected_id) in urls {
            let res = detect_provider(url).unwrap();
            assert_eq!(res.provider, DownloadProvider::GoogleDrive);
            assert_eq!(res.id, expected_id);
        }
    }

    #[test]
    fn test_unsupported_domains() {
        assert!(detect_provider("https://vimeo.com/123456").is_err());
        assert!(detect_provider("https://dropbox.com/s/123456").is_err());
        assert!(detect_provider("https://example.com/video.mp4").is_err());
    }
}

