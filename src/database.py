"""GouNandi Multi-Farmer Database & Identity Management.

SQLite-backed persistent data store and authentication engine providing:
1. Multi-farmer account registration, secure PBKDF2-HMAC-SHA256 password hashing.
2. Farm profile management and device-to-cattle mapping.
3. Strict farmer-specific data isolation queries.
4. Cryptographic JWT generation, validation, and token lifecycle.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import json
import logging
from pathlib import Path
import secrets
import sqlite3
import threading
from typing import Any, Dict, List, Optional, Tuple

import jwt

logger = logging.getLogger("livestock_api.db")

# Paths
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUTPUTS_DIR = ROOT / "outputs"
DB_PATH = DATA_DIR / "gounandi.db"
SECRET_KEY_PATH = OUTPUTS_DIR / "jwt_secret.key"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

# JWT Secret Initialization
def _get_or_create_jwt_secret() -> str:
    if SECRET_KEY_PATH.exists():
        try:
            return SECRET_KEY_PATH.read_text(encoding="utf-8").strip()
        except OSError:
            pass
    secret = secrets.token_hex(32)
    try:
        SECRET_KEY_PATH.write_text(secret, encoding="utf-8")
    except OSError:
        pass
    return secret

JWT_SECRET = _get_or_create_jwt_secret()
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


# ============================================================
# CRYPTOGRAPHIC UTILITIES
# ============================================================

def hash_password(password: str) -> Tuple[str, str]:
    """Generate a salted PBKDF2-HMAC-SHA256 hash for a password."""
    salt = secrets.token_hex(16)
    pwd_bytes = password.encode("utf-8")
    salt_bytes = bytes.fromhex(salt)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", pwd_bytes, salt_bytes, 200000).hex()
    return pwd_hash, salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Verify a password against stored salt and hash using constant-time comparison."""
    pwd_bytes = password.encode("utf-8")
    salt_bytes = bytes.fromhex(salt)
    computed_hash = hashlib.pbkdf2_hmac("sha256", pwd_bytes, salt_bytes, 200000).hex()
    return hmac.compare_digest(computed_hash, stored_hash)


def create_access_token(farmer_id: str, email: str, farm_id: str) -> str:
    """Create a signed JWT token for the authenticated farmer."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": farmer_id,
        "email": email.lower().strip(),
        "farm_id": farm_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=JWT_EXPIRATION_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as exc:
        logger.debug("JWT decode failure: %s", exc)
        return None


# ============================================================
# DATABASE MANAGER
# ============================================================

class DatabaseManager:
    """Thread-safe SQLite manager for GouNandi multi-farmer data isolation."""

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._lock = threading.RLock()
        self.init_db()
        self.seed_defaults()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def init_db(self) -> None:
        """Create database tables if they do not exist."""
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()

            # 1. Farmers table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS farmers (
                farmer_id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                phone TEXT,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """)

            # 2. Farms table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS farms (
                farm_id TEXT PRIMARY KEY,
                farmer_id TEXT NOT NULL,
                farm_name TEXT NOT NULL,
                farm_location TEXT,
                district TEXT,
                state TEXT,
                number_of_cattle INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id) ON DELETE CASCADE
            );
            """)

            # 3. Cows table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS cows (
                cow_id TEXT PRIMARY KEY,
                farmer_id TEXT NOT NULL,
                farm_id TEXT NOT NULL,
                name TEXT NOT NULL,
                tag TEXT NOT NULL,
                breed TEXT,
                device_id TEXT,
                date_of_birth TEXT,
                lactation_stage TEXT,
                weight_kg REAL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id) ON DELETE CASCADE,
                FOREIGN KEY (farm_id) REFERENCES farms(farm_id) ON DELETE CASCADE
            );
            """)

            # 4. Device Mappings (Collar ESP32 -> Cow & Farm)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS device_mappings (
                device_id TEXT PRIMARY KEY,
                cow_id TEXT NOT NULL,
                farmer_id TEXT NOT NULL,
                farm_id TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY (cow_id) REFERENCES cows(cow_id) ON DELETE CASCADE
            );
            """)

            # 5. Health & Behaviour Alerts table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                alert_id TEXT PRIMARY KEY,
                farmer_id TEXT NOT NULL,
                cow_id TEXT NOT NULL,
                alert_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                resolved INTEGER DEFAULT 0,
                resolved_at TEXT,
                FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id) ON DELETE CASCADE
            );
            """)

            # 6. Persistent Telemetry Sensor Readings table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cow_id TEXT NOT NULL,
                device_id TEXT,
                farmer_id TEXT,
                timestamp TEXT NOT NULL,
                received_at TEXT NOT NULL,
                accel_x REAL,
                accel_y REAL,
                accel_z REAL,
                gyro_x REAL,
                gyro_y REAL,
                gyro_z REAL,
                temperature_c REAL,
                raw_json TEXT
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sensor_readings_cow ON sensor_readings(cow_id, received_at DESC);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sensor_readings_time ON sensor_readings(received_at DESC);")

            conn.commit()
            logger.info("GouNandi database initialized at %s", self.db_path)

    # ============================================================
    # SEEDING TEST ACCOUNTS & DEFAULT DATA
    # ============================================================

    def seed_defaults(self) -> None:
        """Seed default accounts for testing (Farmer A, Farmer B, Demo) if not present."""
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()

            # Check if farmers already exist
            cursor.execute("SELECT COUNT(*) FROM farmers")
            if cursor.fetchone()[0] > 0:
                return

            now_iso = datetime.now(timezone.utc).isoformat()
            default_pwd = "Password@123"

            # 1. Farmer A: Green Valley Dairy
            hash_a, salt_a = hash_password(default_pwd)
            cursor.execute("""
            INSERT INTO farmers (farmer_id, email, full_name, phone, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, ("FARM_001", "farmer_a@test.com", "Ramesh Kumar", "+91 98450 12345", hash_a, salt_a, now_iso))

            cursor.execute("""
            INSERT INTO farms (farm_id, farmer_id, farm_name, farm_location, district, state, number_of_cattle, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, ("FARM_LOC_001", "FARM_001", "Green Valley Dairy", "Ooty Road, Tumakuru Rural", "Tumakuru", "Karnataka", 3, now_iso))

            farmer_a_cows = [
                ("COW-001", "FARM_001", "FARM_LOC_001", "Lakshmi", "TAG-101", "Gir", "ESP32_001", "2021-03-15", "Mid-lactation", 420.0, now_iso),
                ("COW-002", "FARM_001", "FARM_LOC_001", "Ganga", "TAG-102", "Sahiwal", "ESP32_002", "2020-08-10", "Early-lactation", 450.0, now_iso),
                ("COW-003", "FARM_001", "FARM_LOC_001", "Nandi", "TAG-103", "Red Sindhi", "ESP32_003", "2022-01-20", "Late-lactation", 395.0, now_iso),
            ]
            for c in farmer_a_cows:
                cursor.execute("""
                INSERT INTO cows (cow_id, farmer_id, farm_id, name, tag, breed, device_id, date_of_birth, lactation_stage, weight_kg, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, c)
                cursor.execute("""
                INSERT INTO device_mappings (device_id, cow_id, farmer_id, farm_id, is_active, created_at)
                VALUES (?, ?, ?, ?, 1, ?)
                """, (c[6], c[0], c[1], c[2], now_iso))

            # 2. Farmer B: Sunrise Dairy
            hash_b, salt_b = hash_password(default_pwd)
            cursor.execute("""
            INSERT INTO farmers (farmer_id, email, full_name, phone, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, ("FARM_002", "farmer_b@test.com", "Suresh Patel", "+91 98765 43210", hash_b, salt_b, now_iso))

            cursor.execute("""
            INSERT INTO farms (farm_id, farmer_id, farm_name, farm_location, district, state, number_of_cattle, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, ("FARM_LOC_002", "FARM_002", "Sunrise Dairy", "Kunigal Highway", "Tumakuru", "Karnataka", 3, now_iso))

            farmer_b_cows = [
                ("COW-004", "FARM_002", "FARM_LOC_002", "Parvati", "TAG-104", "Tharparkar", "ESP32_004", "2019-11-05", "Dry", 465.0, now_iso),
                ("COW-005", "FARM_002", "FARM_LOC_002", "Kamadhenu", "TAG-105", "Kankrej", "ESP32_005", "2021-06-18", "Mid-lactation", 435.0, now_iso),
                ("COW-006", "FARM_002", "FARM_LOC_002", "Surabhi", "TAG-106", "Ongole", "ESP32_006", "2020-04-22", "Mid-lactation", 480.0, now_iso),
            ]
            for c in farmer_b_cows:
                cursor.execute("""
                INSERT INTO cows (cow_id, farmer_id, farm_id, name, tag, breed, device_id, date_of_birth, lactation_stage, weight_kg, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, c)
                cursor.execute("""
                INSERT INTO device_mappings (device_id, cow_id, farmer_id, farm_id, is_active, created_at)
                VALUES (?, ?, ?, ?, 1, ?)
                """, (c[6], c[0], c[1], c[2], now_iso))

            # Register standard ESP32-COLLAR-01 mapping for COW-001
            cursor.execute("""
            INSERT OR IGNORE INTO device_mappings (device_id, cow_id, farmer_id, farm_id, is_active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            """, ("ESP32-COLLAR-01", "COW-001", "FARM_001", "FARM_LOC_001", now_iso))

            # 3. Demo Account / Academic Profile (Chiranthana K Kori)
            hash_demo, salt_demo = hash_password(default_pwd)
            cursor.execute("""
            INSERT INTO farmers (farmer_id, email, full_name, phone, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, ("FARM_DEMO", "demo@gounandi.com", "Chiranthana K Kori", "+91 94800 00000", hash_demo, salt_demo, now_iso))

            cursor.execute("""
            INSERT INTO farms (farm_id, farmer_id, farm_name, farm_location, district, state, number_of_cattle, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, ("FARM_LOC_DEMO", "FARM_DEMO", "GouNandi SIT Research Dairy", "SIT Campus, B.H. Road", "Tumakuru", "Karnataka", 2, now_iso))

            demo_cows = [
                ("COW-007", "FARM_DEMO", "FARM_LOC_DEMO", "Kalyani", "TAG-107", "Rathi", "ESP32_007", "2022-05-12", "Early-lactation", 410.0, now_iso),
                ("COW-008", "FARM_DEMO", "FARM_LOC_DEMO", "Gauri", "TAG-108", "Krishna Valley", "ESP32_008", "2021-09-30", "Mid-lactation", 440.0, now_iso),
            ]
            for c in demo_cows:
                cursor.execute("""
                INSERT INTO cows (cow_id, farmer_id, farm_id, name, tag, breed, device_id, date_of_birth, lactation_stage, weight_kg, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, c)
                cursor.execute("""
                INSERT INTO device_mappings (device_id, cow_id, farmer_id, farm_id, is_active, created_at)
                VALUES (?, ?, ?, ?, 1, ?)
                """, (c[6], c[0], c[1], c[2], now_iso))

            conn.commit()
            logger.info("Seeded default multi-farmer accounts: Farmer A (FARM_001), Farmer B (FARM_002), Demo (FARM_DEMO)")

    # ============================================================
    # FARMER ACCOUNT OPERATIONS
    # ============================================================

    def register_farmer(
        self,
        full_name: str,
        email: str,
        phone: str,
        password: str,
        farm_name: str,
        farm_location: str,
        district: str,
        state: str,
        number_of_cattle: int = 0,
    ) -> Dict[str, Any]:
        """Register a new dairy farmer and their associated farm profile."""
        clean_email = email.strip().lower()
        now_iso = datetime.now(timezone.utc).isoformat()

        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()

            # Check duplicate email
            cursor.execute("SELECT farmer_id FROM farmers WHERE email = ?", (clean_email,))
            if cursor.fetchone():
                raise ValueError(f"Email '{clean_email}' is already registered.")

            # Generate unique IDs
            cursor.execute("SELECT COUNT(*) FROM farmers")
            count = cursor.fetchone()[0] + 1
            farmer_id = f"FARM_{count:03d}_{secrets.token_hex(2).upper()}"
            farm_id = f"FARM_LOC_{count:03d}_{secrets.token_hex(2).upper()}"

            pwd_hash, salt = hash_password(password)

            cursor.execute("""
            INSERT INTO farmers (farmer_id, email, full_name, phone, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (farmer_id, clean_email, full_name.strip(), phone.strip(), pwd_hash, salt, now_iso))

            cursor.execute("""
            INSERT INTO farms (farm_id, farmer_id, farm_name, farm_location, district, state, number_of_cattle, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (farm_id, farmer_id, farm_name.strip(), farm_location.strip(), district.strip(), state.strip(), number_of_cattle, now_iso))

            conn.commit()

            return {
                "farmer_id": farmer_id,
                "email": clean_email,
                "full_name": full_name.strip(),
                "phone": phone.strip(),
                "created_at": now_iso,
                "farm": {
                    "farm_id": farm_id,
                    "farm_name": farm_name.strip(),
                    "farm_location": farm_location.strip(),
                    "district": district.strip(),
                    "state": state.strip(),
                    "number_of_cattle": number_of_cattle,
                },
            }

    def authenticate_farmer(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Verify farmer credentials and return profile if valid."""
        clean_email = email.strip().lower()

        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT f.farmer_id, f.email, f.full_name, f.phone, f.password_hash, f.salt, f.created_at,
                   fm.farm_id, fm.farm_name, fm.farm_location, fm.district, fm.state, fm.number_of_cattle
            FROM farmers f
            LEFT JOIN farms fm ON f.farmer_id = fm.farmer_id
            WHERE f.email = ?
            """, (clean_email,))
            row = cursor.fetchone()
            if not row:
                return None

            if not verify_password(password, row["password_hash"], row["salt"]):
                return None

            return {
                "farmer_id": row["farmer_id"],
                "email": row["email"],
                "full_name": row["full_name"],
                "phone": row["phone"],
                "created_at": row["created_at"],
                "farm": {
                    "farm_id": row["farm_id"],
                    "farm_name": row["farm_name"],
                    "farm_location": row["farm_location"],
                    "district": row["district"],
                    "state": row["state"],
                    "number_of_cattle": row["number_of_cattle"],
                },
            }

    def get_farmer_profile(self, farmer_id: str) -> Optional[Dict[str, Any]]:
        """Get full farmer and farm profile by farmer ID."""
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT f.farmer_id, f.email, f.full_name, f.phone, f.created_at,
                   fm.farm_id, fm.farm_name, fm.farm_location, fm.district, fm.state, fm.number_of_cattle
            FROM farmers f
            LEFT JOIN farms fm ON f.farmer_id = fm.farmer_id
            WHERE f.farmer_id = ?
            """, (farmer_id,))
            row = cursor.fetchone()
            if not row:
                return None

            cursor.execute("SELECT COUNT(*) FROM cows WHERE farmer_id = ?", (farmer_id,))
            registered_cows = cursor.fetchone()[0]

            return {
                "farmer_id": row["farmer_id"],
                "email": row["email"],
                "full_name": row["full_name"],
                "phone": row["phone"],
                "created_at": row["created_at"],
                "registered_cows_count": registered_cows,
                "farm": {
                    "farm_id": row["farm_id"],
                    "farm_name": row["farm_name"],
                    "farm_location": row["farm_location"],
                    "district": row["district"],
                    "state": row["state"],
                    "number_of_cattle": row["number_of_cattle"] or registered_cows,
                },
            }

    def update_farmer_profile(
        self,
        farmer_id: str,
        full_name: Optional[str] = None,
        phone: Optional[str] = None,
        farm_name: Optional[str] = None,
        farm_location: Optional[str] = None,
        district: Optional[str] = None,
        state: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update farmer personal and farm profile attributes."""
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()

            if full_name is not None or phone is not None:
                updates = []
                params = []
                if full_name is not None:
                    updates.append("full_name = ?")
                    params.append(full_name.strip())
                if phone is not None:
                    updates.append("phone = ?")
                    params.append(phone.strip())
                params.append(farmer_id)
                cursor.execute(f"UPDATE farmers SET {', '.join(updates)} WHERE farmer_id = ?", params)

            if any(x is not None for x in [farm_name, farm_location, district, state]):
                updates = []
                params = []
                if farm_name is not None:
                    updates.append("farm_name = ?")
                    params.append(farm_name.strip())
                if farm_location is not None:
                    updates.append("farm_location = ?")
                    params.append(farm_location.strip())
                if district is not None:
                    updates.append("district = ?")
                    params.append(district.strip())
                if state is not None:
                    updates.append("state = ?")
                    params.append(state.strip())
                params.append(farmer_id)
                cursor.execute(f"UPDATE farms SET {', '.join(updates)} WHERE farmer_id = ?", params)

            conn.commit()

        return self.get_farmer_profile(farmer_id) or {}

    def change_password(self, farmer_id: str, old_password: str, new_password: str) -> bool:
        """Change farmer password with current password verification."""
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT password_hash, salt FROM farmers WHERE farmer_id = ?", (farmer_id,))
            row = cursor.fetchone()
            if not row:
                return False

            if not verify_password(old_password, row["password_hash"], row["salt"]):
                return False

            new_hash, new_salt = hash_password(new_password)
            cursor.execute(
                "UPDATE farmers SET password_hash = ?, salt = ? WHERE farmer_id = ?",
                (new_hash, new_salt, farmer_id),
            )
            conn.commit()
            return True

    # ============================================================
    # CATTLE MANAGEMENT & FARMER DATA ISOLATION
    # ============================================================

    def get_farmer_cows(self, farmer_id: str) -> List[Dict[str, Any]]:
        """Retrieve only cows owned by the specified farmer."""
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT cow_id, farmer_id, farm_id, name, tag, breed, device_id,
                   date_of_birth, lactation_stage, weight_kg, created_at
            FROM cows
            WHERE farmer_id = ?
            ORDER BY cow_id ASC
            """, (farmer_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_all_cows_admin(self) -> List[Dict[str, Any]]:
        """Retrieve all cows in system (for backward-compatibility and unauthenticated tests)."""
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT cow_id, farmer_id, farm_id, name, tag, breed, device_id,
                   date_of_birth, lactation_stage, weight_kg, created_at
            FROM cows
            ORDER BY cow_id ASC
            """)
            return [dict(row) for row in cursor.fetchall()]

    def get_cow(self, cow_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single cow record by normalized ID."""
        norm_id = cow_id.strip().upper()
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT cow_id, farmer_id, farm_id, name, tag, breed, device_id,
                   date_of_birth, lactation_stage, weight_kg, created_at
            FROM cows
            WHERE cow_id = ? OR REPLACE(cow_id, '-', '') = REPLACE(?, '-', '')
            """, (norm_id, norm_id))
            row = cursor.fetchone()
            return dict(row) if row else None

    def add_cow(
        self,
        farmer_id: str,
        name: str,
        tag: str,
        breed: str = "Indigenous",
        device_id: Optional[str] = None,
        date_of_birth: Optional[str] = None,
        lactation_stage: str = "Mid-lactation",
        weight_kg: float = 420.0,
        cow_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Register a new cow under the authenticated farmer's farm."""
        now_iso = datetime.now(timezone.utc).isoformat()

        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()

            # Retrieve farmer's farm_id
            cursor.execute("SELECT farm_id FROM farms WHERE farmer_id = ?", (farmer_id,))
            farm_row = cursor.fetchone()
            if not farm_row:
                raise ValueError("Farmer has no associated farm profile.")
            farm_id = farm_row["farm_id"]

            # Generate cow_id if not supplied
            if not cow_id:
                cursor.execute("SELECT COUNT(*) FROM cows")
                total_cows = cursor.fetchone()[0] + 1
                cow_id = f"COW-{total_cows:03d}"
            else:
                cow_id = cow_id.strip().upper()

            # Generate default device_id if not supplied
            if not device_id:
                device_id = f"ESP32_{cow_id.replace('-', '')}"
            else:
                device_id = device_id.strip()

            cursor.execute("""
            INSERT INTO cows (cow_id, farmer_id, farm_id, name, tag, breed, device_id, date_of_birth, lactation_stage, weight_kg, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                cow_id,
                farmer_id,
                farm_id,
                name.strip(),
                tag.strip(),
                breed.strip(),
                device_id,
                date_of_birth or "2021-01-01",
                lactation_stage.strip(),
                float(weight_kg),
                now_iso,
            ))

            # Upsert device mapping
            cursor.execute("""
            INSERT OR REPLACE INTO device_mappings (device_id, cow_id, farmer_id, farm_id, is_active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            """, (device_id, cow_id, farmer_id, farm_id, now_iso))

            conn.commit()

        return self.get_cow(cow_id) or {}

    def get_device_mapping(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Look up cow and farmer associated with a collar device ID."""
        clean_dev = device_id.strip()
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT device_id, cow_id, farmer_id, farm_id, is_active
            FROM device_mappings
            WHERE device_id = ?
            """, (clean_dev,))
            row = cursor.fetchone()
            if row:
                return dict(row)

            # Fallback: check if device_id matches a cow's device_id column directly
            cursor.execute("""
            SELECT cow_id, farmer_id, farm_id, device_id
            FROM cows
            WHERE device_id = ? OR cow_id = ?
            """, (clean_dev, clean_dev))
            row = cursor.fetchone()
            if row:
                return dict(row)

            # Known hardware alias for standard collar: ESP32-COLLAR-01 -> COW-001
            if clean_dev.upper() in ("ESP32-COLLAR-01", "ESP32_COLLAR_01", "ESP32_001"):
                return {
                    "device_id": clean_dev,
                    "cow_id": "COW-001",
                    "farmer_id": "FARM_001",
                    "farm_id": "FARM_LOC_001",
                    "is_active": 1,
                }
            return None

    # ============================================================
    # SENSOR TELEMETRY PERSISTENCE OPERATIONS
    # ============================================================

    def insert_sensor_reading(
        self,
        cow_id: str,
        device_id: Optional[str],
        farmer_id: Optional[str],
        timestamp: str,
        received_at: str,
        sensors: Dict[str, float],
    ) -> int:
        """Persist a single physical sensor reading from ESP32 into SQLite."""
        norm_cow = cow_id.strip().upper()
        ax = float(sensors.get("accel_x")) if sensors.get("accel_x") is not None else None
        ay = float(sensors.get("accel_y")) if sensors.get("accel_y") is not None else None
        az = float(sensors.get("accel_z")) if sensors.get("accel_z") is not None else None
        gx = float(sensors.get("gyro_x")) if sensors.get("gyro_x") is not None else None
        gy = float(sensors.get("gyro_y")) if sensors.get("gyro_y") is not None else None
        gz = float(sensors.get("gyro_z")) if sensors.get("gyro_z") is not None else None
        temp = sensors.get("temperature_c") if sensors.get("temperature_c") is not None else sensors.get("temp")
        temp_c = float(temp) if temp is not None else None

        raw_json = json.dumps(sensors)

        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO sensor_readings (
                cow_id, device_id, farmer_id, timestamp, received_at,
                accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, temperature_c, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                norm_cow, device_id, farmer_id, timestamp, received_at,
                ax, ay, az, gx, gy, gz, temp_c, raw_json
            ))
            conn.commit()
            return cursor.lastrowid

    def get_latest_sensor_reading(self, cow_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Retrieve the latest sensor reading from SQLite, optionally filtered by cow_id."""
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()
            if cow_id:
                norm_cow = cow_id.strip().upper()
                cursor.execute("""
                SELECT id, cow_id, device_id, farmer_id, timestamp, received_at,
                       accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, temperature_c
                FROM sensor_readings
                WHERE cow_id = ? OR REPLACE(cow_id, '-', '') = REPLACE(?, '-', '')
                ORDER BY id DESC
                LIMIT 1
                """, (norm_cow, norm_cow))
            else:
                cursor.execute("""
                SELECT id, cow_id, device_id, farmer_id, timestamp, received_at,
                       accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, temperature_c
                FROM sensor_readings
                ORDER BY id DESC
                LIMIT 1
                """)
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_reading_dict(row)

    def get_recent_sensor_readings(
        self, cow_id: Optional[str] = None, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Retrieve recent sensor readings from SQLite in ascending chronological order."""
        with self._lock, self.get_connection() as conn:
            cursor = conn.cursor()
            if cow_id:
                norm_cow = cow_id.strip().upper()
                cursor.execute("""
                SELECT id, cow_id, device_id, farmer_id, timestamp, received_at,
                       accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, temperature_c
                FROM sensor_readings
                WHERE cow_id = ? OR REPLACE(cow_id, '-', '') = REPLACE(?, '-', '')
                ORDER BY id DESC
                LIMIT ?
                """, (norm_cow, norm_cow, limit))
            else:
                cursor.execute("""
                SELECT id, cow_id, device_id, farmer_id, timestamp, received_at,
                       accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, temperature_c
                FROM sensor_readings
                ORDER BY id DESC
                LIMIT ?
                """, (limit,))
            rows = cursor.fetchall()
            # Return in chronological order (oldest to newest) as expected by window analysis & charts
            readings = [self._row_to_reading_dict(r) for r in reversed(rows)]
            return readings

    def _row_to_reading_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        """Convert a sqlite3.Row from sensor_readings into the standard API dictionary format."""
        sensors = {
            "accel_x": row["accel_x"],
            "accel_y": row["accel_y"],
            "accel_z": row["accel_z"],
            "gyro_x": row["gyro_x"],
            "gyro_y": row["gyro_y"],
            "gyro_z": row["gyro_z"],
            "temperature_c": row["temperature_c"],
        }
        sensor_count = sum(1 for v in sensors.values() if v is not None)
        return {
            "id": row["id"],
            "cow_id": row["cow_id"],
            "device_id": row["device_id"],
            "farmer_id": row["farmer_id"],
            "timestamp": row["timestamp"],
            "received_at": row["received_at"],
            "sensors": sensors,
            "sensor_count": sensor_count,
        }


# Global singleton database manager instance
_db_instance: Optional[DatabaseManager] = None

def get_db() -> DatabaseManager:
    """Get or initialize global DatabaseManager singleton."""
    global _db_instance
    if _db_instance is None:
        _db_instance = DatabaseManager()
    return _db_instance

