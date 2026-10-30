"""ESP32 Collar Telemetry Simulator.

Simulates the physical ESP32 smart collar hardware mounted on cattle.
Generates genuine 10 Hz MPU-6050 (accelerometer + gyroscope) and DS18B20 (contact temperature)
sensor streams and dispatches 20-sample batches over HTTP to the FastAPI ingestion endpoint.

Supported Modes:
  - 'cycle': Realistic diurnal behavioural cycle (grazing -> rumination -> walking -> resting -> mounting)
  - 'grazing': Continuous calm grazing activity
  - 'rumination': Rhythmic jaw chewing / cud chewing motion
  - 'mount': Intense mounting behaviour (triggers estrus surveillance)
  - 'fever': Elevated contact body temperature (triggers thermal alert)
  - 'lameness': Asymmetric walking gait (triggers locomotion irregularity)

Usage:
  python iot/simulation/esp32_collar_simulator.py --url http://127.0.0.1:8000 --cow-id COW-001 --batches 5
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import math
import random
import sys
import time
from typing import Any, Dict, List
import urllib.error
import urllib.request


def generate_reading(
    cow_id: str,
    device_id: str,
    timestamp_iso: str,
    behaviour: str = "grazing",
    t_sec: float = 0.0,
    temperature_c: float = 38.6,
) -> Dict[str, Any]:
    """Generate realistic physical IMU readings matching animal biomechanics."""
    # Base acceleration in g: gravity points primarily along Y (collar downward tilt) or Z
    # MPU-6050 collar orientation: Y = down/dorso-ventral, X = lateral, Z = cranio-caudal

    noise = lambda scale: random.gauss(0.0, scale)

    if behaviour == "grazing":
        # Head down; cyclical low-frequency nodding (0.4 Hz)
        freq = 0.4
        ax = 0.05 + 0.08 * math.sin(2 * math.pi * freq * t_sec) + noise(0.03)
        ay = 0.88 + 0.12 * math.cos(2 * math.pi * freq * t_sec) + noise(0.04)
        az = 0.35 + 0.06 * math.sin(2 * math.pi * freq * t_sec) + noise(0.03)
        gx = 6.0 * math.cos(2 * math.pi * freq * t_sec) + noise(2.0)
        gy = 4.0 * math.sin(2 * math.pi * freq * t_sec) + noise(2.0)
        gz = 2.0 * math.sin(2 * math.pi * freq * t_sec) + noise(1.5)

    elif behaviour == "rumination":
        # Resting posture; distinct rhythmic jaw chewing micro-accelerations (0.9 - 1.2 Hz)
        chew_freq = 1.05
        ax = 0.02 + 0.04 * math.sin(2 * math.pi * chew_freq * t_sec) + noise(0.015)
        ay = 0.94 + 0.05 * math.sin(2 * math.pi * chew_freq * t_sec) + noise(0.02)
        az = 0.18 + 0.03 * math.cos(2 * math.pi * chew_freq * t_sec) + noise(0.015)
        gx = 2.5 * math.sin(2 * math.pi * chew_freq * t_sec) + noise(1.0)
        gy = 1.8 * math.cos(2 * math.pi * chew_freq * t_sec) + noise(1.0)
        gz = 1.0 * math.sin(2 * math.pi * chew_freq * t_sec) + noise(0.8)

    elif behaviour == "walking":
        # Step cadence (~1.5 Hz), alternating lateral and vertical sway
        step_freq = 1.5
        ax = 0.15 * math.sin(2 * math.pi * step_freq * t_sec) + noise(0.05)
        ay = 0.95 + 0.35 * math.cos(2 * math.pi * step_freq * t_sec) + noise(0.06)
        az = 0.25 + 0.20 * math.sin(2 * math.pi * step_freq * t_sec) + noise(0.05)
        gx = 18.0 * math.sin(2 * math.pi * step_freq * t_sec) + noise(4.0)
        gy = 12.0 * math.cos(2 * math.pi * step_freq * t_sec) + noise(3.5)
        gz = 8.0 * math.sin(2 * math.pi * step_freq * t_sec) + noise(3.0)

    elif behaviour == "active_mount":
        # Intense vertical thrust, rearing posture, high angular velocity
        ax = 0.45 + noise(0.18)
        ay = 1.45 + noise(0.22)
        az = 0.85 + noise(0.25)
        gx = random.uniform(30.0, 75.0) * random.choice([-1, 1])
        gy = random.uniform(20.0, 50.0) * random.choice([-1, 1])
        gz = random.uniform(-40.0, 40.0)

    elif behaviour == "lameness":
        # Asymmetric walking limp: uneven lateral variance and jerking
        step_freq = 1.2
        limp_phase = math.sin(2 * math.pi * step_freq * t_sec)
        ax = 0.35 * limp_phase + (0.30 if limp_phase > 0 else 0.0) + noise(0.08)
        ay = 0.90 + 0.45 * math.cos(2 * math.pi * step_freq * t_sec) + noise(0.08)
        az = 0.20 + 0.30 * limp_phase + noise(0.06)
        gx = 22.0 * limp_phase + noise(5.0)
        gy = 15.0 * math.cos(2 * math.pi * step_freq * t_sec) + noise(4.0)
        gz = 10.0 * limp_phase + noise(4.0)

    else:  # resting
        ax = 0.01 + noise(0.01)
        ay = 0.98 + noise(0.015)
        az = 0.12 + noise(0.01)
        gx = noise(0.8)
        gy = noise(0.8)
        gz = noise(0.5)

    return {
        "cow_id": cow_id,
        "device_id": device_id,
        "timestamp": timestamp_iso,
        "sensors": {
            "accel_x": round(ax, 4),
            "accel_y": round(ay, 4),
            "accel_z": round(az, 4),
            "gyro_x": round(gx, 2),
            "gyro_y": round(gy, 2),
            "gyro_z": round(gz, 2),
            "temperature_c": round(temperature_c + noise(0.05), 1),
        },
    }


def send_batch(
    url: str,
    batch: List[Dict[str, Any]],
    timeout: float = 5.0,
) -> bool:
    """Send JSON batch to the ingestion API endpoint."""
    endpoint = f"{url.rstrip('/')}/sensor-data/batch"
    body = json.dumps(batch).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status in (200, 201)
    except urllib.error.URLError as err:
        print(f"Transmission error to {endpoint}: {err}", file=sys.stderr)
        return False


def run_simulator(
    url: str = "http://127.0.0.1:8000",
    cow_id: str = "COW-001",
    device_id: str = "ESP32-COLLAR-01",
    total_batches: int = 10,
    interval_sec: float = 2.0,
    batch_size: int = 20,
    mode: str = "cycle",
) -> None:
    """Run real-time simulator dispatching 20-sample batches (10 Hz)."""
    print(f"=== Starting ESP32 Collar Telemetry Simulator ===")
    print(f"Target API:   {url}")
    print(f"Target Cow:   {cow_id} ({device_id})")
    print(f"Batch Size:   {batch_size} samples (10 Hz over {batch_size * 0.1:.1f}s)")
    print(f"Dispatch:     Every {interval_sec:.1f} seconds")
    print(f"Mode:         {mode}")
    print("-------------------------------------------------")

    behaviour_cycle = ["grazing", "rumination", "walking", "resting", "active_mount"]
    cycle_idx = 0

    batches_sent = 0
    while total_batches == 0 or batches_sent < total_batches:
        # Determine behaviour
        if mode == "cycle":
            current_behaviour = behaviour_cycle[cycle_idx % len(behaviour_cycle)]
            # Change behaviour every 2 batches
            if (batches_sent + 1) % 2 == 0:
                cycle_idx += 1
        else:
            current_behaviour = mode

        # Determine temperature
        temp_c = 40.1 if mode == "fever" else 38.6

        # Generate 20 readings spaced at 100ms (10 Hz)
        now_ts = time.time()
        batch = []
        for i in range(batch_size):
            sample_time = now_ts - ((batch_size - 1 - i) * 0.10)
            sample_iso = datetime.fromtimestamp(sample_time, tz=timezone.utc).isoformat()
            reading = generate_reading(
                cow_id=cow_id,
                device_id=device_id,
                timestamp_iso=sample_iso,
                behaviour=current_behaviour,
                t_sec=i * 0.10,
                temperature_c=temp_c,
            )
            batch.append(reading)

        # Dispatch
        success = send_batch(url, batch)
        batches_sent += 1

        status_flag = "OK" if success else "FAIL"
        print(f"[{status_flag}] Batch #{batches_sent:02d} dispatched: {batch_size} readings | State: {current_behaviour.upper()} | Temp: {temp_c:.1f}°C")

        if total_batches == 0 or batches_sent < total_batches:
            time.sleep(interval_sec)

    print("=== Simulation Completed Successfully ===")


def main():
    parser = argparse.ArgumentParser(description="ESP32 Collar Telemetry Simulator")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="FastAPI root URL")
    parser.add_argument("--cow-id", default="COW-001", help="Target Cow ID")
    parser.add_argument("--device-id", default="ESP32-COLLAR-01", help="Collar Device ID")
    parser.add_argument("--batches", type=int, default=5, help="Total batches to send (0 = infinite)")
    parser.add_argument("--interval", type=float, default=2.0, help="Interval between batches in seconds")
    parser.add_argument("--size", type=int, default=20, help="Samples per batch (default 20)")
    parser.add_argument("--mode", default="cycle", choices=["cycle", "grazing", "rumination", "walking", "active_mount", "resting", "fever", "lameness"], help="Simulation behavior mode")
    args = parser.parse_args()

    run_simulator(
        url=args.url,
        cow_id=args.cow_id,
        device_id=args.device_id,
        total_batches=args.batches,
        interval_sec=args.interval,
        batch_size=args.size,
        mode=args.mode,
    )


if __name__ == "__main__":
    main()
