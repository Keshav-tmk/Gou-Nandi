"""Verify SQLite persistence for sensor readings."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.database import get_db

def test_persistence():
    db = get_db()
    conn = db.get_connection()
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in c.fetchall()]
    print("Tables in SQLite database:", tables)
    assert "sensor_readings" in tables, "sensor_readings table missing!"

    # Test inserting a reading
    rid = db.insert_sensor_reading(
        cow_id="COW-001",
        device_id="ESP32-COLLAR-01",
        farmer_id="FARM_001",
        timestamp="2026-11-05T19:07:00Z",
        received_at="2026-11-05T19:07:01Z",
        sensors={
            "accel_x": 0.05,
            "accel_y": 0.98,
            "accel_z": 0.12,
            "gyro_x": 1.2,
            "gyro_y": -0.8,
            "gyro_z": 0.4,
            "temperature_c": 38.6,
        }
    )
    print(f"Inserted test reading ID: {rid}")

    latest = db.get_latest_sensor_reading("COW-001")
    assert latest is not None
    assert latest["cow_id"] == "COW-001"
    assert latest["sensors"]["accel_x"] == 0.05
    assert latest["sensors"]["accel_y"] == 0.98
    print("Retrieved latest reading:", latest)

    recent = db.get_recent_sensor_readings("COW-001", limit=10)
    print(f"Retrieved {len(recent)} recent readings for COW-001")
    assert len(recent) >= 1
    print("Database persistence verified 100% successfully!")

if __name__ == "__main__":
    test_persistence()

