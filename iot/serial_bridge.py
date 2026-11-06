"""GouNandi ESP32 USB Serial Ingestion Bridge.

Reads real-time inertial telemetry from a physical ESP32 collar connected via USB
(e.g., Silicon Labs CP210x / CH340 on COM port), parses sensor data, and forwards
readings directly into the GouNandi FastAPI ingestion pipeline.

Usage:
    python iot/serial_bridge.py
    python iot/serial_bridge.py --port COM6 --baud 115200 --cow-id COW-001
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
import re
import sys
import time
from typing import Any, Dict, Optional, Tuple
import urllib.error
import urllib.request

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("[ERROR] 'pyserial' is not installed. Run: pip install pyserial")
    sys.exit(1)


def find_esp32_port() -> Optional[str]:
    """Auto-detect connected ESP32 / USB-UART bridge COM port."""
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        return None

    # Priority to CP210x, CH340, FTDI, or ESP32
    for p in ports:
        desc = (p.description or "").lower()
        mfg = (p.manufacturer or "").lower()
        if any(keyword in desc or keyword in mfg for keyword in ["cp210", "ch340", "uart", "esp32", "silicon labs", "ftdi"]):
            return p.device

    # Fallback to first available COM port
    return ports[0].device


def validate_sensors(sensors: Dict[str, float]) -> bool:
    """Validate that sensor values are physically plausible for cattle collar telemetry.

    Prevents corrupt packets, unscaled raw registers, or misinterpreted log timestamps
    from entering the machine learning pipeline.
    """
    if not sensors or not isinstance(sensors, dict):
        return False

    ax = sensors.get("accel_x")
    ay = sensors.get("accel_y")
    az = sensors.get("accel_z")
    gx = sensors.get("gyro_x")
    gy = sensors.get("gyro_y")
    gz = sensors.get("gyro_z")

    # Accelerometer sanity: physical cattle collar motion rarely exceeds ±8g, max ±16g
    # A value of 32g is indicative of corrupted parsing or date/timestamp leak
    for a in [ax, ay, az]:
        if a is not None and abs(a) > 16.0:
            return False

    # Gyroscope sanity: animal neck angular rate is within ±500°/s, max ±1000°/s
    # A value like 2026.0°/s is literally the year 2026 from an ISO date string
    for g in [gx, gy, gz]:
        if g is not None and abs(g) > 1000.0:
            return False

    # Temperature sanity: DS18B20 cattle probe or MPU internal (-20 to 80°C)
    t = sensors.get("temperature_c")
    if t is not None and (t < -20.0 or t > 80.0):
        return False

    return True


def parse_sensor_line(line: str) -> Optional[Tuple[Dict[str, float], Optional[str], Optional[str], Optional[str]]]:
    """Flexibly parse sensor values and metadata from various Serial output formats."""
    clean = line.strip()
    if not clean:
        return None

    # Filter out informational boot or status messages
    LOG_KEYWORDS = [
        "[INFO]", "[WARN]", "[ERROR]", "WiFi", "Wi-Fi", "Starting", "initialized",
        "HTTP status", "Connection error", "Check server", "Synchronizing",
        "POWERON", "SPIWP", "load:", "clk_drv", "entry 0x", "mode:DIO",
        "SMART LIVESTOCK", "========", "Connecting to"
    ]
    if any(kw.lower() in clean.lower() for kw in LOG_KEYWORDS):
        return None

    # Format A: JSON object (or embedded JSON object in line)
    json_match = re.search(r'(\{.*\})', clean)
    if json_match:
        try:
            data = json.loads(json_match.group(1))
            cow_id = data.get("cow_id")
            if cow_id:
                m = re.match(r"^COW[-]?0*([0-9]+)$", str(cow_id).strip(), re.IGNORECASE)
                if m:
                    cow_id = f"COW-{int(m.group(1)):03d}"
            device_id = data.get("device_id")
            ts = data.get("timestamp")

            if "sensors" in data and isinstance(data["sensors"], dict):
                sensors = {k: float(v) for k, v in data["sensors"].items() if isinstance(v, (int, float))}
                if validate_sensors(sensors):
                    return sensors, cow_id, device_id, ts
            # Direct flat dict
            sensors = {
                k: float(v) for k, v in data.items()
                if isinstance(v, (int, float)) and k not in {"cow_id", "device_id", "timestamp"}
            }
            if len(sensors) >= 3 and validate_sensors(sensors):
                return sensors, cow_id, device_id, ts
        except Exception:
            pass

    # Format B: Key-Value pairs (e.g. "ax: 0.1, ay: 0.98, az: 0.05, gx: 1.2, gy: -0.8, gz: 0.4, temp: 38.6")
    kv_pattern = re.findall(r'([a-zA-Z_]+)\s*[:=]\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)', clean)
    if kv_pattern and len(kv_pattern) >= 3:
        mapping: Dict[str, float] = {}
        alias_map = {
            "ax": "accel_x", "accel_x": "accel_x", "accx": "accel_x",
            "ay": "accel_y", "accel_y": "accel_y", "accy": "accel_y",
            "az": "accel_z", "accel_z": "accel_z", "accz": "accel_z",
            "gx": "gyro_x", "gyro_x": "gyro_x", "gyrx": "gyro_x",
            "gy": "gyro_y", "gyro_y": "gyro_y", "gyry": "gyro_y",
            "gz": "gyro_z", "gyro_z": "gyro_z", "gyrz": "gyro_z",
            "temp": "temperature_c", "temperature": "temperature_c", "temperature_c": "temperature_c", "temp_c": "temperature_c"
        }
        for k, v in kv_pattern:
            k_lower = k.lower()
            target_key = alias_map.get(k_lower, k_lower)
            try:
                mapping[target_key] = float(v)
            except ValueError:
                pass
        if len(mapping) >= 3 and validate_sensors(mapping):
            return mapping, None, None, None

    # Format C: CSV numbers (e.g. "0.05, 0.98, 0.12, 1.2, -0.8, 0.4, 38.6")
    # Strictly reject lines containing date strings or alphanumeric logs
    if re.search(r'\d{4}[-/]\d{2}[-/]\d{2}', clean):
        return None
    if re.search(r'[a-zA-Z]{3,}', clean):
        return None

    num_matches = re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', clean)
    if len(num_matches) >= 6:
        try:
            nums = [float(n) for n in num_matches]
            # Check if values are raw 16-bit integers from MPU6050
            if any(abs(n) > 50 for n in nums[:6]):
                ax = nums[0] / 16384.0
                ay = nums[1] / 16384.0
                az = nums[2] / 16384.0
                gx = nums[3] / 131.0
                gy = nums[4] / 131.0
                gz = nums[5] / 131.0
            else:
                ax, ay, az, gx, gy, gz = nums[:6]

            temp = nums[6] if len(nums) > 6 else 38.6
            sensors = {
                "accel_x": round(ax, 4),
                "accel_y": round(ay, 4),
                "accel_z": round(az, 4),
                "gyro_x": round(gx, 4),
                "gyro_y": round(gy, 4),
                "gyro_z": round(gz, 4),
                "temperature_c": round(temp, 2),
            }
            if validate_sensors(sensors):
                return sensors, None, None, None
        except Exception:
            pass

    return None


def forward_reading(
    api_url: str,
    cow_id: str,
    device_id: str,
    sensors: Dict[str, float],
    timestamp: Optional[str] = None,
) -> Dict[str, Any]:
    """Forward a single parsed sensor reading to the FastAPI /sensor-data endpoint."""
    endpoint = f"{api_url.rstrip('/')}/sensor-data"
    now_iso = timestamp or datetime.now(timezone.utc).isoformat()

    payload = {
        "cow_id": cow_id,
        "device_id": device_id,
        "timestamp": now_iso,
        "sensors": sensors,
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=req_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=3.0) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    env_url = os.environ.get("GOUNANDI_API_URL", "").strip()
    default_url = env_url if env_url else "http://127.0.0.1:8000"

    parser = argparse.ArgumentParser(description="GouNandi ESP32 USB Serial Telemetry Bridge")
    parser.add_argument("--port", type=str, default=None, help="COM port (e.g. COM3). Auto-detected if omitted.")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud rate (default: 115200)")
    parser.add_argument("--cow-id", type=str, default="COW-001", help="Target cow identifier (default: COW-001)")
    parser.add_argument("--device-id", type=str, default="ESP32-COLLAR-01", help="Hardware device ID")
    parser.add_argument("--url", type=str, default=default_url, help=f"GouNandi FastAPI server URL (default: {default_url})")
    parser.add_argument("--prod", action="store_true", help="Send directly to production backend (https://gou-nandi.onrender.com)")
    parser.add_argument("--dual", action="store_true", default=False, help="Send simultaneously to BOTH local (http://127.0.0.1:8000) and production (https://gou-nandi.onrender.com)")
    args = parser.parse_args()

    if args.dual:
        target_urls = ["http://127.0.0.1:8000", "https://gou-nandi.onrender.com"]
        mode_label = "DUAL (Local + Render Cloud)"
    elif args.prod:
        target_urls = ["https://gou-nandi.onrender.com"]
        mode_label = "PRODUCTION (Render Cloud)"
    else:
        target_urls = [args.url.rstrip("/")]
        mode_label = "PRODUCTION (Render Cloud)" if "onrender.com" in args.url else "LOCAL (Development)"

    port = args.port or find_esp32_port()
    if not port:
        print("[ERROR] No serial/COM ports found. Please connect your ESP32 via USB.")
        sys.exit(1)

    print("=" * 65)
    print(" GouNandi — ESP32 USB Serial Telemetry Ingestion Bridge")
    print("=" * 65)
    print(f"Mode:          {mode_label}")
    print(f"Target Cow:    {args.cow_id}")
    print(f"Device ID:     {args.device_id}")
    print(f"Serial Port:   {port} @ {args.baud} baud")
    print(f"FastAPI Server:{', '.join(target_urls)}")
    print("=" * 65)

    try:
        ser = serial.Serial(port, args.baud, timeout=1.0)
    except serial.SerialException as exc:
        if "PermissionError" in str(exc) or "Access is denied" in str(exc):
            print(f"\n[PORT BUSY] Could not open {port}: Access is denied.")
            print("[ACTION REQUIRED] Another application (such as the Arduino IDE Serial Monitor)")
            print(f"currently has {port} open exclusively.")
            print(">>> Please close the Serial Monitor in Arduino IDE, then run this bridge again. <<<\n")
        else:
            print(f"\n[ERROR] Could not open port {port}: {exc}")
        sys.exit(1)

    print(f"[CONNECTED] Listening on {port} for ESP32 telemetry...\n")
    readings_count = 0

    try:
        while True:
            raw_line = ser.readline()
            if not raw_line:
                continue

            try:
                line_str = raw_line.decode("utf-8", errors="replace").strip()
            except Exception:
                continue

            if not line_str:
                continue

            parsed = parse_sensor_line(line_str)
            if not parsed:
                # Informational log from ESP32
                if any(tag in line_str for tag in ["[INFO]", "[WARN]", "[ERROR]", "WiFi", "Starting"]):
                    print(f"  [ESP32 LOG] {line_str}")
                continue

            sensors, parsed_cow_id, parsed_device_id, parsed_ts = parsed
            target_cow = parsed_cow_id or args.cow_id
            target_dev = parsed_device_id or args.device_id

            # Forward to GouNandi backend(s)
            readings_count += 1
            ax = sensors.get("accel_x", 0.0)
            ay = sensors.get("accel_y", 0.0)
            az = sensors.get("accel_z", 0.0)
            gx = sensors.get("gyro_x", 0.0)
            gy = sensors.get("gyro_y", 0.0)
            gz = sensors.get("gyro_z", 0.0)

            for dest_url in target_urls:
                try:
                    forward_reading(dest_url, target_cow, target_dev, sensors, timestamp=parsed_ts)
                except urllib.error.URLError as u_err:
                    print(f"[WARN] Failed to forward to {dest_url}: {u_err}")
                except Exception as f_err:
                    print(f"[WARN] Ingestion error for {dest_url}: {f_err}")

            dest_label = "Local + Cloud" if len(target_urls) > 1 else target_urls[0]
            print(f"[{readings_count:04d}] Ingested for {target_cow} -> {dest_label}: Accel=({ax:+.2f}, {ay:+.2f}, {az:+.2f})g | Gyro=({gx:+.1f}, {gy:+.1f}, {gz:+.1f})°/s")

    except KeyboardInterrupt:
        print("\n[STOPPED] Serial bridge terminated by user.")
    finally:
        ser.close()


if __name__ == "__main__":
    main()
