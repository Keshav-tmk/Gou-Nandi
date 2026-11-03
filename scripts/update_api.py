"""Script to update src/10_api.py with multi-farmer authentication and data isolation."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
api_file = ROOT / "src" / "10_api.py"

content = api_file.read_text(encoding="utf-8")

# 1. Update imports
old_imp = "from fastapi import FastAPI, HTTPException, Query, Request, status"
new_imp = """from fastapi import FastAPI, HTTPException, Query, Request, status, Header, Depends
from src.database import get_db, create_access_token, decode_access_token"""

if old_imp in content:
    content = content.replace(old_imp, new_imp, 1)

# 2. Update dashboard_api_live
old_dash = '''@app.get("/dashboard/api/live")
def dashboard_api_live(
    cow_id: str = Query(default="COW-001", min_length=1, max_length=64),
) -> Dict[str, Any]:
    """Consolidated real-time state for dashboard: hardware freshness, sensor readings, and 5 AI modules."""
    ai = get_ai_service()
    return ai.get_live_dashboard_payload(cow_id=cow_id)'''

new_dash = '''@app.get("/dashboard/api/live")
def dashboard_api_live(
    cow_id: Optional[str] = Query(default=None, min_length=1, max_length=64),
    farmer: Optional[Dict[str, Any]] = Depends(get_current_farmer_optional),
) -> Dict[str, Any]:
    """Consolidated real-time state for dashboard with strict farmer isolation."""
    ai = get_ai_service()
    db = get_db()

    target_cow = cow_id
    if farmer is not None:
        farmer_cows = db.get_farmer_cows(farmer["farmer_id"])
        if not target_cow:
            target_cow = farmer_cows[0]["cow_id"] if farmer_cows else "COW-NONE"
        else:
            verify_cow_access(target_cow, farmer)
    else:
        if not target_cow:
            target_cow = "COW-001"

    return ai.get_live_dashboard_payload(cow_id=target_cow)'''

if old_dash in content:
    content = content.replace(old_dash, new_dash, 1)

# 3. Add auth schemas, dependencies, auth endpoints, and updated herd endpoints
marker = "# COW REGISTRY & HERD MANAGEMENT ENDPOINTS"
if marker in content:
    idx = content.index(marker)
    prefix = content[:idx]

    auth_and_cows_code = '''# COW REGISTRY & MULTI-FARMER DATA ISOLATION ENDPOINTS
# ============================================================

# ============================================================
# MULTI-FARMER AUTHENTICATION & DATA ISOLATION SCHEMAS
# ============================================================

class FarmerRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=128)
    email: str = Field(..., min_length=5, max_length=128)
    phone: str = Field(..., min_length=7, max_length=32)
    password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., min_length=6, max_length=128)
    farm_name: str = Field(..., min_length=2, max_length=128)
    farm_location: str = Field(..., min_length=2, max_length=256)
    district: str = Field(default="Tumakuru", max_length=128)
    state: str = Field(default="Karnataka", max_length=128)
    number_of_cattle: int = Field(default=0, ge=0)

class FarmerLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=128)
    password: str = Field(..., min_length=1, max_length=128)

class FarmerProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=128)
    phone: Optional[str] = Field(None, min_length=7, max_length=32)
    farm_name: Optional[str] = Field(None, min_length=2, max_length=128)
    farm_location: Optional[str] = Field(None, min_length=2, max_length=256)
    district: Optional[str] = Field(None, max_length=128)
    state: Optional[str] = Field(None, max_length=128)

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., min_length=6, max_length=128)

class AddCowRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    tag: str = Field(..., min_length=1, max_length=64)
    breed: str = Field(default="Indigenous", max_length=64)
    weight_kg: float = Field(default=420.0, gt=0)
    deviceId: Optional[str] = Field(None, max_length=64)
    date_of_birth: Optional[str] = Field(default="2021-01-01")
    lactation_stage: str = Field(default="Mid-lactation", max_length=64)


def get_current_farmer_optional(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """Extract authenticated farmer identity from verified JWT Bearer token if present."""
    if not authorization:
        return None
    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'.",
        )
    token = parts[1]
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired or untrusted authentication token.",
        )
    farmer_id = payload["sub"]
    db = get_db()
    farmer = db.get_farmer_profile(farmer_id)
    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Farmer account associated with token was not found.",
        )
    farmer["is_authenticated"] = True
    return farmer


def require_current_farmer(farmer: Optional[Dict[str, Any]] = Depends(get_current_farmer_optional)) -> Dict[str, Any]:
    """Strict authentication dependency for endpoints requiring verified farmer login."""
    if not farmer or not farmer.get("is_authenticated"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access this resource.",
        )
    return farmer


def verify_cow_access(cow_id: str, farmer: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Verify that cattle record exists and belongs to the authenticated farmer's farm."""
    db = get_db()
    cow = db.get_cow(cow_id)
    if not cow:
        cow = next((c for c in COW_REGISTRY if c["id"] == cow_id or normalize_cow_id(c["id"]) == normalize_cow_id(cow_id)), None)
        if not cow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cattle '{cow_id}' was not found in the herd registry.",
            )
        cow = dict(cow)
        cow.setdefault("farmer_id", "FARM_001")

    if farmer is not None:
        authenticated_farmer_id = farmer.get("farmer_id")
        if cow.get("farmer_id") != authenticated_farmer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to view or manage cattle belonging to another farm.",
            )
    return cow


# ============================================================
# FARMER AUTHENTICATION & PROFILE ENDPOINTS
# ============================================================

@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register_farmer(payload: FarmerRegisterRequest) -> Dict[str, Any]:
    """Register a new dairy farmer account and associated farm profile."""
    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and Confirm Password do not match.",
        )
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    db = get_db()
    try:
        farmer_data = db.register_farmer(
            full_name=payload.full_name,
            email=payload.email,
            phone=payload.phone,
            password=payload.password,
            farm_name=payload.farm_name,
            farm_location=payload.farm_location,
            district=payload.district,
            state=payload.state,
            number_of_cattle=payload.number_of_cattle,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    farmer_id = farmer_data["farmer_id"]
    farm_id = farmer_data["farm"]["farm_id"]
    token = create_access_token(farmer_id, farmer_data["email"], farm_id)

    profile = db.get_farmer_profile(farmer_id)
    return {
        "status": "success",
        "message": f"Welcome to GouNandi, {payload.full_name}! Registration successful.",
        "access_token": token,
        "token_type": "bearer",
        "farmer": profile,
    }


@app.post("/auth/login")
def login_farmer(payload: FarmerLoginRequest) -> Dict[str, Any]:
    """Authenticate dairy farmer and issue JWT bearer token."""
    db = get_db()
    farmer = db.authenticate_farmer(payload.email, payload.password)
    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email address or password.",
        )

    farmer_id = farmer["farmer_id"]
    farm_id = farmer["farm"]["farm_id"]
    token = create_access_token(farmer_id, farmer["email"], farm_id)

    profile = db.get_farmer_profile(farmer_id)
    return {
        "status": "success",
        "message": f"Welcome back, {farmer['full_name']}!",
        "access_token": token,
        "token_type": "bearer",
        "farmer": profile,
    }


@app.get("/auth/me")
def get_current_user_profile(
    farmer: Dict[str, Any] = Depends(require_current_farmer),
) -> Dict[str, Any]:
    """Retrieve full profile of the authenticated dairy farmer."""
    return {
        "status": "success",
        "farmer": farmer,
    }


@app.put("/auth/profile")
def update_profile(
    payload: FarmerProfileUpdateRequest,
    farmer: Dict[str, Any] = Depends(require_current_farmer),
) -> Dict[str, Any]:
    """Update authenticated farmer's personal or farm profile."""
    db = get_db()
    updated = db.update_farmer_profile(
        farmer_id=farmer["farmer_id"],
        full_name=payload.full_name,
        phone=payload.phone,
        farm_name=payload.farm_name,
        farm_location=payload.farm_location,
        district=payload.district,
        state=payload.state,
    )
    return {
        "status": "success",
        "message": "Profile updated successfully.",
        "farmer": updated,
    }


@app.put("/auth/change-password")
def change_user_password(
    payload: ChangePasswordRequest,
    farmer: Dict[str, Any] = Depends(require_current_farmer),
) -> Dict[str, Any]:
    """Change authenticated farmer's password."""
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match.",
        )
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long.",
        )

    db = get_db()
    success = db.change_password(farmer["farmer_id"], payload.current_password, payload.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    return {
        "status": "success",
        "message": "Password updated successfully.",
    }


@app.post("/auth/logout")
def logout_farmer() -> Dict[str, Any]:
    """Log out farmer and clear authentication session."""
    return {
        "status": "success",
        "message": "Logged out successfully.",
    }


# ============================================================
# CATTLE REGISTRY & DATA ISOLATION ENDPOINTS
# ============================================================

COW_REGISTRY = [
    {
        "id": "COW-001",
        "name": "Lakshmi",
        "tag": "TAG-101",
        "breed": "Gir",
        "deviceId": "ESP32_001",
        "date_of_birth": "2021-03-15",
        "lactation_stage": "Mid-lactation",
        "weight_kg": 420.0,
        "farmer_id": "FARM_001",
    },
    {
        "id": "COW-002",
        "name": "Ganga",
        "tag": "TAG-102",
        "breed": "Sahiwal",
        "deviceId": "ESP32_002",
        "date_of_birth": "2020-08-10",
        "lactation_stage": "Early-lactation",
        "weight_kg": 450.0,
        "farmer_id": "FARM_001",
    },
    {
        "id": "COW-003",
        "name": "Nandi",
        "tag": "TAG-103",
        "breed": "Red Sindhi",
        "deviceId": "ESP32_003",
        "date_of_birth": "2022-01-20",
        "lactation_stage": "Late-lactation",
        "weight_kg": 395.0,
        "farmer_id": "FARM_001",
    },
    {
        "id": "COW-004",
        "name": "Parvati",
        "tag": "TAG-104",
        "breed": "Tharparkar",
        "deviceId": "ESP32_004",
        "date_of_birth": "2019-11-05",
        "lactation_stage": "Dry",
        "weight_kg": 465.0,
        "farmer_id": "FARM_002",
    },
    {
        "id": "COW-005",
        "name": "Kamadhenu",
        "tag": "TAG-105",
        "breed": "Kankrej",
        "deviceId": "ESP32_005",
        "date_of_birth": "2021-06-18",
        "lactation_stage": "Mid-lactation",
        "weight_kg": 435.0,
        "farmer_id": "FARM_002",
    },
    {
        "id": "COW-006",
        "name": "Surabhi",
        "tag": "TAG-106",
        "breed": "Ongole",
        "deviceId": "ESP32_006",
        "date_of_birth": "2020-04-22",
        "lactation_stage": "Mid-lactation",
        "weight_kg": 480.0,
        "farmer_id": "FARM_002",
    },
    {
        "id": "COW-007",
        "name": "Kalyani",
        "tag": "TAG-107",
        "breed": "Rathi",
        "deviceId": "ESP32_007",
        "date_of_birth": "2022-05-12",
        "lactation_stage": "Early-lactation",
        "weight_kg": 410.0,
        "farmer_id": "FARM_DEMO",
    },
    {
        "id": "COW-008",
        "name": "Gauri",
        "tag": "TAG-108",
        "breed": "Krishna Valley",
        "deviceId": "ESP32_008",
        "date_of_birth": "2021-09-30",
        "lactation_stage": "Mid-lactation",
        "weight_kg": 440.0,
        "farmer_id": "FARM_DEMO",
    },
]


@app.get("/cows")
def list_cows(
    farmer: Optional[Dict[str, Any]] = Depends(get_current_farmer_optional),
) -> Dict[str, Any]:
    """Retrieve cows with strict farmer data isolation when authenticated."""
    ai = get_ai_service()
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    cows_out = []

    if farmer is not None:
        cows_list = db.get_farmer_cows(farmer["farmer_id"])
    else:
        cows_list = db.get_all_cows_admin()
        if not cows_list:
            cows_list = COW_REGISTRY

    for cow in cows_list:
        cow_id = cow.get("cow_id") or cow.get("id")
        freshness = ai.get_cow_freshness(cow_id)
        hw_status = freshness["status"]
        readings = ai.get_cow_readings(cow_id, limit=1)
        latest_r = readings[0] if readings else None

        beh_label = None
        if latest_r:
            pred_history = ai.get_prediction_history(cow_id, limit=1)
            if pred_history and pred_history[0].get("behaviour"):
                beh_label = pred_history[0]["behaviour"].get("label")

        cow_alerts = [
            a for a in ai.get_all_active_alerts()
            if a.get("cow_id") == cow_id or a.get("cow_id") == normalize_cow_id(cow_id)
        ]

        cows_out.append({
            "id": cow_id,
            "cow_id": cow_id,
            "name": cow.get("name"),
            "tag": cow.get("tag"),
            "breed": cow.get("breed"),
            "deviceId": cow.get("deviceId") or cow.get("device_id"),
            "date_of_birth": cow.get("date_of_birth"),
            "lactation_stage": cow.get("lactation_stage"),
            "weight_kg": cow.get("weight_kg"),
            "farmer_id": cow.get("farmer_id"),
            "farm_id": cow.get("farm_id"),
            "status": hw_status,
            "has_live_telemetry": bool(latest_r),
            "last_received_at": freshness.get("last_received_at"),
            "seconds_since_last_reading": freshness.get("seconds_since_last_reading"),
            "total_readings": freshness.get("total_readings", 0),
            "latest_behaviour": beh_label,
            "alerts_count": len(cow_alerts),
            "is_stale": freshness.get("is_stale", False),
        })

    return {
        "status": "success",
        "count": len(cows_out),
        "timestamp": now_iso,
        "cows": cows_out,
    }


@app.post("/cows", status_code=status.HTTP_201_CREATED)
def register_new_cow(
    payload: AddCowRequest,
    farmer: Dict[str, Any] = Depends(require_current_farmer),
) -> Dict[str, Any]:
    """Register a new cow under the authenticated farmer's farm profile."""
    db = get_db()
    try:
        new_cow = db.add_cow(
            farmer_id=farmer["farmer_id"],
            name=payload.name,
            tag=payload.tag,
            breed=payload.breed,
            device_id=payload.deviceId,
            date_of_birth=payload.date_of_birth,
            lactation_stage=payload.lactation_stage,
            weight_kg=payload.weight_kg,
        )
        return {
            "status": "success",
            "message": f"Livestock animal '{payload.name}' registered successfully.",
            "cow": {
                **new_cow,
                "id": new_cow.get("cow_id"),
                "status": "waiting_for_sensor_data",
                "has_live_telemetry": False,
                "alerts_count": 0,
            },
        }
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@app.get("/cows/{cow_id}")
def get_cow_detail(
    cow_id: str,
    farmer: Optional[Dict[str, Any]] = Depends(get_current_farmer_optional),
) -> Dict[str, Any]:
    """Retrieve detailed profile, live telemetry, and recent history for a specific cow."""
    ai = get_ai_service()
    cow_meta = verify_cow_access(cow_id, farmer)
    norm_id = normalize_cow_id(cow_id)

    freshness = ai.get_cow_freshness(cow_id)
    recent_readings = ai.get_cow_readings(cow_id, limit=15)
    live_payload = ai.get_live_dashboard_payload(cow_id)
    pred_history = ai.get_prediction_history(cow_id, limit=10)
    alerts = [a for a in ai.get_all_active_alerts() if a.get("cow_id") == norm_id or a.get("cow_id") == cow_id]

    profile_out = {
        **cow_meta,
        "id": cow_meta.get("cow_id") or cow_meta.get("id"),
        "deviceId": cow_meta.get("deviceId") or cow_meta.get("device_id"),
    }

    return {
        "status": "success",
        "profile": profile_out,
        "freshness": freshness,
        "latest_telemetry": live_payload.get("sensor"),
        "recent_readings": recent_readings,
        "window": live_payload.get("window"),
        "ai": live_payload.get("ai"),
        "alerts": alerts,
        "prediction_history": pred_history,
    }


@app.get("/alerts")
def get_herd_alerts(
    farmer: Optional[Dict[str, Any]] = Depends(get_current_farmer_optional),
) -> Dict[str, Any]:
    """Retrieve current active and recent livestock health alerts with farmer filtering."""
    ai = get_ai_service()
    db = get_db()
    all_alerts = ai.get_all_active_alerts()

    if farmer is not None:
        farmer_cows = {c["cow_id"] for c in db.get_farmer_cows(farmer["farmer_id"])}
        filtered = [
            a for a in all_alerts
            if a.get("cow_id") in farmer_cows or normalize_cow_id(a.get("cow_id", "")) in [normalize_cow_id(c) for c in farmer_cows]
        ]
    else:
        filtered = all_alerts

    return {
        "status": "success",
        "total": len(filtered),
        "active": filtered,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/alerts/{alert_id}/resolve")
def resolve_herd_alert(
    alert_id: str,
    farmer: Optional[Dict[str, Any]] = Depends(get_current_farmer_optional),
) -> Dict[str, Any]:
    """Resolve/acknowledge an alert by ID with ownership check."""
    ai = get_ai_service()
    db = get_db()

    if farmer is not None:
        active_alerts = ai.get_all_active_alerts()
        match_alert = next((a for a in active_alerts if a.get("id") == alert_id or a.get("alert_id") == alert_id), None)
        if match_alert:
            cow_id = match_alert.get("cow_id")
            if cow_id:
                verify_cow_access(cow_id, farmer)

    success = ai.resolve_alert(alert_id)
    return {
        "status": "success" if success else "not_found",
        "alert_id": alert_id,
        "resolved": success,
        "message": "Alert resolved" if success else "Alert not found or already cleared",
    }


@app.get("/analytics/summary")
def get_analytics_summary(
    farmer: Optional[Dict[str, Any]] = Depends(get_current_farmer_optional),
) -> Dict[str, Any]:
    """Provide real herd-wide aggregate analytics isolated to the authenticated farmer's herd."""
    ai = get_ai_service()
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    if farmer is not None:
        cows_list = db.get_farmer_cows(farmer["farmer_id"])
    else:
        cows_list = db.get_all_cows_admin()
        if not cows_list:
            cows_list = COW_REGISTRY

    farmer_cow_ids = {c.get("cow_id") or c.get("id") for c in cows_list}
    all_alerts = [
        a for a in ai.get_all_active_alerts()
        if a.get("cow_id") in farmer_cow_ids or normalize_cow_id(a.get("cow_id", "")) in [normalize_cow_id(c) for c in farmer_cow_ids]
    ]

    active_cows = [
        c for c in ai.get_active_cows()
        if c in farmer_cow_ids or normalize_cow_id(c) in [normalize_cow_id(x) for x in farmer_cow_ids]
    ]

    beh_counts: Dict[str, int] = {}
    total_preds = 0
    for cow in cows_list:
        cid = cow.get("cow_id") or cow.get("id")
        history = ai.get_prediction_history(cid, limit=50)
        for h in history:
            b = h.get("behaviour")
            if b and b.get("label"):
                lbl = b["label"]
                beh_counts[lbl] = beh_counts.get(lbl, 0) + 1
                total_preds += 1

    total_cows_count = len(cows_list)
    healthy_count = max(0, total_cows_count - len(all_alerts))

    return {
        "status": "success",
        "timestamp": now_iso,
        "farmer_id": farmer.get("farmer_id") if farmer else None,
        "herd": {
            "total_cows": total_cows_count,
            "telemetry_active_cows": len(active_cows),
            "healthy_cows": healthy_count,
            "attention_cows": len(set(a.get("cow_id") for a in all_alerts)),
            "active_alerts_count": len(all_alerts),
        },
        "behaviour_distribution": beh_counts,
        "total_inferences_recorded": total_preds,
    }
'''

    content = prefix + auth_and_cows_code

api_file.write_text(content, encoding="utf-8")
print("Wrote updated src/10_api.py successfully!")

