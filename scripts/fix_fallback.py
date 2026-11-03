"""Fix unauthenticated fallback in src/10_api.py."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
api_file = ROOT / "src" / "10_api.py"

text = api_file.read_text(encoding="utf-8")

old_pattern = """    if farmer is not None:
        cows_list = db.get_farmer_cows(farmer["farmer_id"])
    else:
        cows_list = db.get_all_cows_admin()
        if not cows_list:
            cows_list = COW_REGISTRY"""

new_pattern = """    if farmer is not None:
        cows_list = db.get_farmer_cows(farmer["farmer_id"])
    else:
        cows_list = COW_REGISTRY"""

text = text.replace(old_pattern, new_pattern)
api_file.write_text(text, encoding="utf-8")
print("Updated cows_list fallback to COW_REGISTRY for unauthenticated requests!")

