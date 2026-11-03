// ============================================================
// GouNandi AI — Multi-Farmer Authentication & Profile Types
// ============================================================

export interface FarmProfile {
  farm_id: string;
  farm_name: string;
  farm_location: string;
  district: string;
  state: string;
  number_of_cattle: number;
}

export interface FarmerProfile {
  farmer_id: string;
  email: string;
  full_name: string;
  phone: string;
  created_at: string;
  registered_cows_count?: number;
  farm: FarmProfile;
}

export interface AuthResponse {
  status: string;
  message: string;
  access_token: string;
  token_type: string;
  farmer: FarmerProfile;
}

export interface FarmerRegisterData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  farm_name: string;
  farm_location: string;
  district: string;
  state: string;
  number_of_cattle: number;
}

export interface ProfileUpdateData {
  full_name?: string;
  phone?: string;
  farm_name?: string;
  farm_location?: string;
  district?: string;
  state?: string;
}

