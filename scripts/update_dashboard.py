"""Update DashboardPage.tsx with personalized farmer welcome banner and cow selection sync."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
dash_file = ROOT / "frontend" / "src" / "pages" / "DashboardPage.tsx"

text = dash_file.read_text(encoding="utf-8")

# 1. Import useAuthStore
if "useAuthStore" not in text:
    old_store_imp = "import { useAppStore } from '../store/appStore';"
    new_store_imp = "import { useAppStore } from '../store/appStore';\nimport { useAuthStore } from '../store/authStore';"
    text = text.replace(old_store_imp, new_store_imp, 1)

# 2. Extract farmer and farm
old_hook_call = "  const { selectedCowId, setSelectedCowId, isDemoMode } = useAppStore();"
new_hook_call = """  const { selectedCowId, setSelectedCowId, isDemoMode } = useAppStore();
  const { farmer, farm } = useAuthStore();"""
if old_hook_call in text and "const { farmer, farm }" not in text:
    text = text.replace(old_hook_call, new_hook_call, 1)

# 3. Sync selectedCowId with farmer's cows
old_cow_set = "setCowsList(cowRes.value.cows);"
new_cow_set = """setCowsList(cowRes.value.cows);
          if (cowRes.value.cows.length > 0 && !cowRes.value.cows.some((c: any) => c.id === selectedCowId)) {
            setSelectedCowId(cowRes.value.cows[0].id);
          }"""
if old_cow_set in text:
    text = text.replace(old_cow_set, new_cow_set, 1)

# 4. Personalize Welcome Banner
old_welcome = """          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Welcome to GouNandi Dairy Farm
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#E8F5E9]/90 leading-relaxed font-normal">
            Continuous wireless motion telemetry and 5-module Scikit-Learn AI monitoring for dairy livestock health, estrus cycles, rumination cadence, and locomotion.
          </p>"""

new_welcome = """          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Welcome back, {farmer?.full_name || 'Farmer'}
          </h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs sm:text-sm text-[#C8E6C9] font-semibold">
            <span>{farm?.farm_name || 'GouNandi Dairy Farm'}</span>
            {farm?.farm_location && (
              <>
                <span>•</span>
                <span className="text-[#E8F5E9]/90 font-normal">{farm.farm_location}, {farm.district || ''}</span>
              </>
            )}
            {farmer?.farmer_id && (
              <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                Farmer ID: {farmer.farmer_id}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs sm:text-sm text-[#E8F5E9]/90 leading-relaxed font-normal">
            Continuous wireless motion telemetry and 5-module Scikit-Learn AI monitoring for your dairy livestock health, estrus cycles, rumination cadence, and locomotion.
          </p>"""

if old_welcome in text:
    text = text.replace(old_welcome, new_welcome, 1)

dash_file.write_text(text, encoding="utf-8")
print("DashboardPage.tsx personalized successfully!")

