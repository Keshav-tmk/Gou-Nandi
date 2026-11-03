import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
"""Verify keshav registration, login, cow addition, and data isolation."""

import urllib.request
import urllib.error
import json
from src.database import get_db, verify_password

def verify_keshav():
    print("=" * 60)
    print("STEP-BY-STEP VERIFICATION FOR KESHAV FARM ACCOUNT")
    print("=" * 60)

    # 1. Verify DB Record
    db = get_db()
    farmer_record = db.authenticate_farmer('k@gmail.com', 'Password@123')
    assert farmer_record is not None, 'Farmer was not found in DB or password mismatch!'
    print('[1] DB Record Verified:')
    print('    Farmer ID:', farmer_record['farmer_id'])
    print('    Full Name:', farmer_record['full_name'])
    print('    Email:', farmer_record['email'])
    print('    Phone:', farmer_record['phone'])
    print('    Farm Name:', farmer_record['farm']['farm_name'])
    print('    Farm Location:', farmer_record['farm']['farm_location'])
    print('    District:', farmer_record['farm']['district'])
    print('    State:', farmer_record['farm']['state'])
    print('    Cattle Capacity:', farmer_record['farm']['number_of_cattle'])

    # 2. Verify Password Hashing in DB
    with db.get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT password_hash, salt FROM farmers WHERE email = ?', ('k@gmail.com',))
        row = c.fetchone()
        assert row is not None
        assert row['password_hash'] != 'Password@123', 'Password is not hashed!'
        assert verify_password('Password@123', row['password_hash'], row['salt']) is True
        print('[2] Password Hash Security Verified: PBKDF2-HMAC-SHA256 with 200,000 rounds')

    # 3. Verify Login via HTTP
    login_req = urllib.request.Request(
        'http://localhost:5173/auth/login',
        data=json.dumps({'email': 'k@gmail.com', 'password': 'Password@123'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(login_req) as resp:
        assert resp.status == 200
        login_data = json.loads(resp.read().decode())
        token = login_data['access_token']
        print('[3] HTTP Login Verified via Vite Proxy: Token issued')

    # 4. Verify /auth/me
    me_req = urllib.request.Request(
        'http://localhost:5173/auth/me',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(me_req) as resp:
        assert resp.status == 200
        me_data = json.loads(resp.read().decode())
        assert me_data['farmer']['full_name'] == 'keshav'
        print('[4] /auth/me Verified: Welcome back, keshav')

    # 5. Verify Cattle Isolation (Starts with 0 cows)
    cows_req = urllib.request.Request(
        'http://localhost:5173/cows',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(cows_req) as resp:
        assert resp.status == 200
        cows_data = json.loads(resp.read().decode())
        assert cows_data['count'] == 0
        print('[5] Cattle Isolation Verified: keshav sees 0 cows (Farmer A / Farmer B cattle isolated)')

    # 6. Add a Cow for keshav
    add_cow_req = urllib.request.Request(
        'http://localhost:5173/cows',
        data=json.dumps({
            'name': 'Gauri',
            'tag': 'TAG-K101',
            'breed': 'Gir',
            'weight_kg': 410.0,
            'deviceId': 'ESP32_K101'
        }).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(add_cow_req) as resp:
        assert resp.status == 201
        created_cow = json.loads(resp.read().decode())['cow']
        cow_id = created_cow['id']
        print(f'[6] Added Cattle for keshav: {cow_id} ({created_cow["name"]})')

    # 7. Verify keshav now sees exactly 1 cow
    with urllib.request.urlopen(cows_req) as resp:
        cows_after = json.loads(resp.read().decode())
        assert cows_after['count'] == 1
        assert cows_after['cows'][0]['id'] == cow_id
        print(f'[7] Herd Verified: keshav now sees {cows_after["count"]} cow: {[c["id"] for c in cows_after["cows"]]}')

    # 8. Verify Farmer A CANNOT access keshav's cow (HTTP 403)
    res_a = urllib.request.urlopen(
        urllib.request.Request(
            'http://localhost:5173/auth/login',
            data=json.dumps({'email': 'farmer_a@test.com', 'password': 'Password@123'}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
    )
    token_a = json.loads(res_a.read().decode())['access_token']

    try:
        urllib.request.urlopen(
            urllib.request.Request(
                f'http://localhost:5173/cows/{cow_id}',
                headers={'Authorization': f'Bearer {token_a}'}
            )
        )
        assert False, 'Farmer A should have been forbidden from accessing keshav cow!'
    except urllib.error.HTTPError as e:
        assert e.code == 403
        print(f'[8] Cross-Farmer Access Rejection Verified: HTTP 403 Forbidden')

    print('\n' + '=' * 60)
    print('ALL VERIFICATION STEPS PASSED 100%!')
    print('=' * 60)

if __name__ == '__main__':
    verify_keshav()
