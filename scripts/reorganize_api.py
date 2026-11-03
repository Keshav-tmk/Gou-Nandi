"""Reorganize src/10_api.py to place auth dependencies before endpoints."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
api_file = ROOT / "src" / "10_api.py"

text = api_file.read_text(encoding="utf-8")

# Auth Schemas & Dependencies block
auth_deps_block = '''
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
'''

# Remove auth_deps_block from below marker if it's there
dup_marker = "# MULTI-FARMER AUTHENTICATION & DATA ISOLATION SCHEMAS"
if dup_marker in text:
    end_dup = text.find("# FARMER AUTHENTICATION & PROFILE ENDPOINTS")
    if end_dup != -1:
        # Find start of dup_marker
        start_dup = text.rfind(dup_marker)
        # We'll remove this lower copy and put it up top
        text = text[:start_dup] + text[end_dup:]

# Insert auth_deps_block right after `app.add_middleware` or before the first endpoint
mid_marker = "app.add_middleware(\n    CORSMiddleware,"
if mid_marker in text:
    pos = text.find(")\n", text.find(mid_marker)) + 2
    text = text[:pos] + "\n" + auth_deps_block + "\n" + text[pos:]
elif "app = FastAPI(" in text:
    pos = text.find(")", text.find("app = FastAPI(")) + 1
    text = text[:pos] + "\n" + auth_deps_block + "\n" + text[pos:]

api_file.write_text(text, encoding="utf-8")
print("Reorganized src/10_api.py successfully!")

