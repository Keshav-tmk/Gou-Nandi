"""Update CowsPage.tsx handleAddAnimalSubmit to call cowsService.addCow."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
file_path = ROOT / "frontend" / "src" / "pages" / "CowsPage.tsx"

text = file_path.read_text(encoding="utf-8")

old_start = "  const handleAddAnimalSubmit = (e: React.FormEvent) => {"
old_end = "  };\n\n  const getAgeDisplay"

idx_s = text.find(old_start)
idx_e = text.find(old_end, idx_s)

if idx_s != -1 and idx_e != -1:
    new_fn = """  const handleAddAnimalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCow.name.trim()) return;

    try {
      const res = await cowsService.addCow({
        name: newCow.name.trim(),
        tag: newCow.tag.trim() || `TAG-${100 + cows.length + 1}`,
        breed: newCow.breed,
        weight_kg: Number(newCow.weight_kg) || 420,
        deviceId: newCow.deviceId.trim() || `ESP32_${Date.now() % 1000}`,
      });
      if (res && res.cow) {
        setCows([res.cow, ...cows]);
      }
    } catch {
      const nextId = `COW-${String(cows.length + 1).padStart(3, '0')}`;
      const created: CowSummary = {
        id: nextId,
        name: newCow.name,
        tag: newCow.tag || `TAG-${100 + cows.length + 1}`,
        breed: newCow.breed,
        deviceId: newCow.deviceId,
        date_of_birth: new Date().toISOString().split('T')[0],
        lactation_stage: 'Mid-lactation',
        weight_kg: Number(newCow.weight_kg) || 420,
        status: 'waiting_for_sensor_data',
        has_live_telemetry: false,
        last_received_at: null,
        seconds_since_last_reading: null,
        total_readings: 0,
        latest_behaviour: 'resting',
        alerts_count: 0,
        is_stale: false,
      };
      setCows([created, ...cows]);
    }
    setIsAddModalOpen(false);
    setNewCow({
      name: '',
      tag: '',
      breed: 'Gir',
      weight_kg: 420,
      deviceId: `COLLAR-ESP32-00${cows.length + 2}`,
    });
  };"""

    text = text[:idx_s] + new_fn + text[idx_e + 4:]
    file_path.write_text(text, encoding="utf-8")
    print("CowsPage.tsx updated successfully!")
else:
    print("Could not find handleAddAnimalSubmit block")

