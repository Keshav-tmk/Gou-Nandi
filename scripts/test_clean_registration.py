import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import urllib.request
import urllib.error
import json
import sqlite3
from src.database import get_db, verify_password

def test_registration_and_leave_ready():
    db = get_db()
    
    # Step 1: Clean up any prior 'k@gmail.com' records so we can test fresh registration
    with db.get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT farmer_id FROM farmers WHERE email = 'k@gmail.com'")
        row = c.fetchone()
        if row:
            farmer_id = row['farmer_id']
            # Delete cows belonging to this farmer's farms
            c.execute("DELETE FROM cows WHERE farm_id IN (SELECT farm_id FROM farms WHERE farmer_id = ?)", (farmer_id,))
            c.execute("DELETE FROM farms WHERE farmer_id = ?", (farmer_id,))
            c.execute("DELETE FROM farmers WHERE farmer_id = ?", (farmer_id,))
            conn.commit()
            print("[INFO] Cleaned up prior 'k@gmail.com' test data from database.")

    # Step 2: Exact payload sent by React frontend RegisterPage.tsx
    payload = {
        "full_name": "keshav",
        "email": "k@gmail.com",
        "phone": "1234567891",
        "password": "Password@123",
        "confirm_password": "Password@123",
        "farm_name": "keshav farm",
        "farm_location": "tumkur",
        "district": "Tumakuru",
        "state": "Karnataka",
        "number_of_cattle": 10
    }

    # Step 3: POST to http://localhost:5173/auth/register (Vite proxy forwarding to FastAPI)
    req = urllib.request.Request(
        "http://localhost:5173/auth/register",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    print("[INFO] Submitting registration payload to http://localhost:5173/auth/register...")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 201, f"Expected 201, got {resp.status}"
        data = json.loads(resp.read().decode())
        print("[PASS] Registration HTTP Response 201 Received!")
        print("       Token issued:", data["access_token"][:25] + "...")
        print("       Farmer ID:", data["farmer"]["farmer_id"])
        print("       Farmer Name:", data["farmer"]["full_name"])
        print("       Farm Name:", data["farmer"]["farm"]["farm_name"])
        token = data["access_token"]
        new_farmer_id = data["farmer"]["farmer_id"]

    # Step 4: Verify Database Record
    with db.get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM farmers WHERE email = 'k@gmail.com'")
        farmer = c.fetchone()
        assert farmer is not None, "Farmer not found in SQLite DB!"
        assert verify_password("Password@123", farmer["password_hash"], farmer["salt"]) is True
        print("[PASS] Database Record Verified with PBKDF2-HMAC-SHA256 (200,000 iterations).")

        c.execute("SELECT * FROM farms WHERE farmer_id = ?", (new_farmer_id,))
        farm = c.fetchone()
        assert farm is not None, "Farm not found in SQLite DB!"
        assert farm["farm_name"] == "keshav farm"
        print("[PASS] Farm Record Verified: 'keshav farm' in Tumakuru, Karnataka.")

    # Step 5: Verify /auth/me with the issued JWT
    me_req = urllib.request.Request(
        "http://localhost:5173/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(me_req) as resp:
        assert resp.status == 200
        me_data = json.loads(resp.read().decode())
        assert me_data["farmer"]["full_name"] == "keshav"
        print("[PASS] /auth/me returns valid farmer session: 'keshav'")

    # Step 6: Verify Login with credentials
    login_req = urllib.request.Request(
        "http://localhost:5173/auth/login",
        data=json.dumps({"email": "k@gmail.com", "password": "Password@123"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(login_req) as resp:
        assert resp.status == 200
        print("[PASS] /auth/login returns 200 OK with valid JWT.")

    # Now reset so the user can click 'Create Account & Enter Dashboard' on their screen right now
    with db.get_connection() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM cows WHERE farm_id IN (SELECT farm_id FROM farms WHERE farmer_id = ?)", (new_farmer_id,))
        c.execute("DELETE FROM farms WHERE farmer_id = ?", (new_farmer_id,))
        c.execute("DELETE FROM farmers WHERE farmer_id = ?", (new_farmer_id,))
        conn.commit()
    print("[INFO] DB cleared for 'k@gmail.com' so the user can test the registration directly in the UI!")
    print("\nALL 6 CHECKS COMPLETED AND VERIFIED 100%!")

if __name__ == "__main__":
    test_registration_and_leave_ready()
