use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryItem {
    pub id: String,
    pub operation: String, // "encode", "decode", "download"
    pub name: String,
    pub size_bytes: usize,
    pub sha256: Option<String>,
    pub status: String, // "success", "failed", "cancelled"
    pub error_message: Option<String>,
    pub source_path: Option<String>,
    pub output_path: Option<String>,
    pub created_at: String,
    pub duration_seconds: f32,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub download_dir: PathBuf,
    pub restore_dir: PathBuf,
    pub video_output_dir: PathBuf,
    pub auto_decode: bool,
    pub default_block: usize,
    pub default_nsym: usize,
    pub default_crf: u32,
    pub theme: String, // "dark", "light", "system"
}

impl Default for AppSettings {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        Self {
            download_dir: home.join("Downloads").join("YTDisk"),
            restore_dir: home.join("Downloads").join("YTDisk").join("Restored"),
            video_output_dir: home.join("Videos").join("YTDisk"),
            auto_decode: true,
            default_block: 4,
            default_nsym: 32,
            default_crf: 12,
            theme: "dark".to_string(),
        }
    }
}

pub struct TaskManager {
    cancellation_tokens: Mutex<HashMap<String, Arc<AtomicBool>>>,
    config_dir: PathBuf,
}

impl TaskManager {
    pub fn new() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let config_dir = home.join(".config").join("ytdisk");
        let _ = std::fs::create_dir_all(&config_dir);

        Self {
            cancellation_tokens: Mutex::new(HashMap::new()),
            config_dir,
        }
    }

    pub fn register_task(&self, task_id: &str) -> Arc<AtomicBool> {
        let token = Arc::new(AtomicBool::new(false));
        let mut tokens = self.cancellation_tokens.lock().unwrap();
        tokens.insert(task_id.to_string(), token.clone());
        token
    }

    pub fn unregister_task(&self, task_id: &str) {
        let mut tokens = self.cancellation_tokens.lock().unwrap();
        tokens.remove(task_id);
    }

    pub fn cancel_task(&self, task_id: &str) -> bool {
        let tokens = self.cancellation_tokens.lock().unwrap();
        if let Some(token) = tokens.get(task_id) {
            token.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    }

    pub fn get_settings(&self) -> AppSettings {
        let path = self.config_dir.join("settings.json");
        if path.exists() {
            if let Ok(mut f) = File::open(&path) {
                let mut content = String::new();
                if f.read_to_string(&mut content).is_ok() {
                    if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                        return settings;
                    }
                }
            }
        }
        let default_settings = AppSettings::default();
        let _ = self.save_settings(&default_settings);
        default_settings
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), String> {
        let path = self.config_dir.join("settings.json");
        let json = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        let mut f = File::create(&path)
            .map_err(|e| format!("Failed to create settings file {:?}: {}", path, e))?;
        f.write_all(json.as_bytes())
            .map_err(|e| format!("Failed to write settings: {}", e))?;
        Ok(())
    }

    pub fn get_history(&self) -> Vec<HistoryItem> {
        let path = self.config_dir.join("history.json");
        if path.exists() {
            if let Ok(mut f) = File::open(&path) {
                let mut content = String::new();
                if f.read_to_string(&mut content).is_ok() {
                    if let Ok(items) = serde_json::from_str::<Vec<HistoryItem>>(&content) {
                        return items;
                    }
                }
            }
        }
        Vec::new()
    }

    pub fn add_history_item(&self, item: HistoryItem) -> Result<(), String> {
        let mut history = self.get_history();
        history.insert(0, item);
        if history.len() > 100 {
            history.truncate(100);
        }

        let path = self.config_dir.join("history.json");
        let json = serde_json::to_string_pretty(&history)
            .map_err(|e| format!("Failed to serialize history: {}", e))?;
        let mut f = File::create(&path)
            .map_err(|e| format!("Failed to create history file: {}", e))?;
        f.write_all(json.as_bytes())
            .map_err(|e| format!("Failed to write history: {}", e))?;
        Ok(())
    }

    pub fn clear_history(&self) -> Result<(), String> {
        let path = self.config_dir.join("history.json");
        if path.exists() {
            let _ = std::fs::remove_file(path);
        }
        Ok(())
    }
}

