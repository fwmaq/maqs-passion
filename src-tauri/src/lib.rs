use tauri::{Emitter, Manager};
use serde::Serialize;
use std::time::{Duration, Instant};

#[tauri::command]
fn finish_splash(app: tauri::AppHandle) -> Result<(), String> {
    let main = app.get_webview_window("main").ok_or("Main window not found")?;
    main.show().map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;
    let splash = app.get_webview_window("splash").ok_or("Splash window not found")?;
    splash.close().map_err(|error| error.to_string())?;
    Ok(())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(16))
        .user_agent("MaqsPassion/2.0 (private network diagnostics)")
        .build().map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct LatencyMeasurement { latency_ms: f64, jitter_ms: f64, samples: usize }

#[tauri::command]
async fn speed_latency() -> Result<LatencyMeasurement, String> {
    let http = client()?;
    let mut readings = Vec::new();
    for i in 0..5 {
        let started = Instant::now();
        let url = format!("https://speed.cloudflare.com/__down?bytes=0&nonce={i}");
        let response = http.get(url).send().await.map_err(|e| format!("Latency test failed: {e}"))?;
        if !response.status().is_success() { return Err(format!("Latency endpoint: {}", response.status())); }
        response.bytes().await.map_err(|e| e.to_string())?;
        readings.push(started.elapsed().as_secs_f64() * 1000.0);
    }
    let average = readings.iter().sum::<f64>() / readings.len() as f64;
    let jitter = readings.windows(2).map(|window| (window[1]-window[0]).abs()).sum::<f64>() / (readings.len()-1) as f64;
    Ok(LatencyMeasurement{latency_ms:average,jitter_ms:jitter,samples:readings.len()})
}

#[derive(Serialize, Clone)]
struct SpeedMeasurement { mbps: f64, bytes: usize, seconds: f64, samples: usize }
#[derive(Serialize, Clone)]
struct SpeedProgress { phase: String, mbps: f64, bytes: usize, seconds: f64, samples: usize }

#[tauri::command]
async fn speed_phase(app: tauri::AppHandle, phase: String) -> Result<SpeedMeasurement, String> {
    if phase != "download" && phase != "upload" { return Err("Unknown test phase".to_owned()); }
    let http = client()?;
    let started = Instant::now();
    let duration = Duration::from_secs(15);
    let mut measured_bytes: usize = 0;
    let mut samples: usize = 0;
    let data = vec![0x59u8; 1024 * 1024];
    while started.elapsed() < duration {
        let remaining = duration.saturating_sub(started.elapsed());
        if remaining.is_zero() { break }
        let task = async {
            if phase == "download" {
                let response = http.get("https://speed.cloudflare.com/__down?bytes=4194304").send().await.map_err(|e| e.to_string())?;
                if !response.status().is_success() { return Err(format!("HTTP {}",response.status())); }
                let bytes=response.bytes().await.map_err(|e|e.to_string())?;
                Ok::<usize,String>(bytes.len())
            } else {
                let response=http.post("https://speed.cloudflare.com/__up")
                    .header("Content-Type","application/octet-stream")
                    .body(data.clone()).send().await.map_err(|e|e.to_string())?;
                if !response.status().is_success() { return Err(format!("HTTP {}",response.status())); }
                Ok::<usize,String>(data.len())
            }
        };
        match tokio::time::timeout(remaining,task).await {
            Ok(Ok(bytes)) => {
                measured_bytes=measured_bytes.saturating_add(bytes);
                samples+=1;
                let elapsed = started.elapsed().as_secs_f64().max(0.001);
                let mbps = (measured_bytes as f64 * 8.0) / elapsed / 1_000_000.0;
                let _ = app.emit("speed-progress", SpeedProgress {phase:phase.clone(),mbps,bytes:measured_bytes,seconds:elapsed,samples});
            }
            Ok(Err(err)) => {return Err(format!("{} phase failed: {}",phase,err));}
            Err(_) => {break}
        }
    }
    let elapsed = started.elapsed().as_secs_f64();
    if measured_bytes==0 {return Err(format!("{}: no successful transfers completed in 15 seconds",phase));}
    Ok(SpeedMeasurement {mbps: (measured_bytes as f64 * 8.0) / elapsed / 1_000_000.0,bytes:measured_bytes,seconds:elapsed,samples})
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // The updater is optional during local development. It only starts after
            // configure-updates.mjs has installed a trusted public signing key and endpoint.
            let configured = serde_json::to_value(app.config())
                .ok()
                .and_then(|config| config.pointer("/plugins/updater/pubkey")
                    .and_then(|value| value.as_str())
                    .map(|key| !key.trim().is_empty()))
                .unwrap_or(false);
            if configured {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![finish_splash,speed_latency,speed_phase])
        .run(tauri::generate_context!())
        .expect("error while running Maq's Passion");
}
