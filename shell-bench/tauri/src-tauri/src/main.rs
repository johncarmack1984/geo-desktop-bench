// Desktop-only Tauri 2 shell. Captures main() start, and `frontend_ready` prints
// the cold-start elapsed (main → renderer first frame) to stdout for the harness.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::Instant;

struct StartTime(Instant);

#[tauri::command]
fn echo(msg: String) -> String {
    msg
}

#[tauri::command]
fn frontend_ready(state: tauri::State<StartTime>) {
    let ms = state.0.elapsed().as_secs_f64() * 1000.0;
    println!("STARTUP_MS={ms:.1}");
}

#[tauri::command]
fn report_ipc(line: String) {
    println!("IPC_RESULT {line}");
}

#[derive(serde::Serialize)]
struct Pt {
    lon: f64,
    lat: f64,
}

// DuckDB on the Rust side: synthesize a point cloud in-DB, bbox-filter it, and
// hand the rows back to the webview (which renders them as a deck.gl layer).
// The whole query runs native — no JS, no network — then crosses IPC once.
#[tauri::command]
fn query(west: f64, south: f64, east: f64, north: f64, limit: usize) -> Result<Vec<Pt>, String> {
    let conn = duckdb::Connection::open_in_memory().map_err(|e| e.to_string())?;
    let sql = format!(
        "SELECT lon, lat FROM (
            SELECT 10.5 + random() * 1.5 AS lon, 43.0 + random() * 1.5 AS lat FROM range(1000000)
         ) WHERE lon BETWEEN {west} AND {east} AND lat BETWEEN {south} AND {north} LIMIT {limit}"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Pt {
                lon: r.get(0)?,
                lat: r.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

fn main() {
    let start = Instant::now();
    tauri::Builder::default()
        .manage(StartTime(start))
        .invoke_handler(tauri::generate_handler![echo, frontend_ready, report_ipc, query])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
