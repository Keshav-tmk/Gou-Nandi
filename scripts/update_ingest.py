"""Update ingest_sensor_data in src/10_api.py."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
api_file = ROOT / "src" / "10_api.py"

text = api_file.read_text(encoding="utf-8")

target_start = "record = {"
target_end = '"sensor_count": len(payload.sensors),'

idx_start = text.find(target_start)
idx_end = text.find(target_end, idx_start)

if idx_start != -1 and idx_end != -1:
    end_bracket = text.find("}", idx_end) + 1
    old_block = text[idx_start:end_bracket]
    print("Found block:")
    print(repr(old_block))

    new_block = """# Device-to-cattle and farm association
    db = get_db()
    dev_map = db.get_device_mapping(payload.device_id) if payload.device_id else None
    if not dev_map and payload.cow_id:
        dev_map = db.get_cow(payload.cow_id)

    target_cow_id = dev_map["cow_id"] if dev_map and "cow_id" in dev_map else payload.cow_id
    farmer_id = dev_map.get("farmer_id") if dev_map else None

    record = {
        "received_at": received_time,
        "cow_id": target_cow_id,
        "device_id": payload.device_id,
        "farmer_id": farmer_id,
        "timestamp": payload.timestamp,
        "sensors": payload.sensors,
        "sensor_count": len(payload.sensors),
    }"""
    text = text[:idx_start] + new_block + text[end_bracket:]
    api_file.write_text(text, encoding="utf-8")
    print("Successfully updated ingest_sensor_data device mapping!")
else:
    print("Target block not found in src/10_api.py")

