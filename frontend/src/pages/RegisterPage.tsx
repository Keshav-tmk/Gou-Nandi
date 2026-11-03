// ============================================================
// GouNandi AI — Farmer Registration Page (/register)
// ============================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { Card } from '../components/common/Card';
import {
  User,
  Mail,
  Phone,
  Lock,
  Building,
  MapPin,
  Map,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    farm_name: '',
    farm_location: '',
    district: 'Tumakuru',
    state: 'Karnataka',
    number_of_cattle: 4,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'number_of_cattle' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    if (formData.password !== formData.confirm_password) {
      setErrorMessage('Password and Confirm Password do not match.');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await authService.register(formData);
      if (res && res.access_token) {
        setAuth(res.access_token, res.farmer);
        navigate('/', { replace: true });
      } else {
        setErrorMessage('Registration succeeded but authentication token was missing.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Email might already be registered.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F4] dark:bg-farm-darkBg flex flex-col justify-center items-center p-4 sm:p-6 transition-colors select-none py-10">
      <div className="w-full max-w-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-sm border border-[#E3E9E2] dark:border-farm-darkBorder p-2 mb-1">
            <img src="/logo.png" alt="GouNandi Emblem" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#263238] dark:text-white tracking-tight flex items-center justify-center gap-1.5">
            GouNandi <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#E8F5E9] text-[#2E7D32] uppercase tracking-wider">AI</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#607067] dark:text-gray-400">
            Register New Dairy Farm & Activate Precision Cattle Welfare
          </p>
        </div>

        {/* Registration Card */}
        <Card className="p-6 sm:p-8 bg-white dark:bg-farm-darkCard border border-[#E3E9E2] dark:border-farm-darkBorder shadow-lg rounded-2xl">
          <div className="mb-6 pb-3 border-b border-[#E3E9E2] dark:border-farm-darkBorder flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#263238] dark:text-white">
                Farmer & Dairy Farm Registration
              </h2>
              <p className="text-xs text-[#607067]">
                Your herd data and collar telemetry will be completely isolated to your account.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E7D32] bg-[#E8F5E9] px-2.5 py-1 rounded-full border border-[#C8E6C9]">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Isolated
            </span>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2.5 text-xs text-[#D84343]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            {/* Section 1: Personal Details */}
            <div>
              <h3 className="text-xs font-bold text-[#2E7D32] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <User className="w-4 h-4" />
                1. Farmer Personal Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#607067] mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#8A9990] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      name="full_name"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.full_name}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#607067] mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#8A9990] absolute left-3 top-2.5" />
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="farmer@dairyfarm.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#607067] mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#8A9990] absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      name="phone"
                      required
                      placeholder="+91 98450 12345"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#607067] mb-1">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#8A9990] absolute left-2.5 top-2.5" />
                      <input
                        type="password"
                        name="password"
                        required
                        placeholder="••••••"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full pl-8 pr-2 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#607067] mb-1">Confirm</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#8A9990] absolute left-2.5 top-2.5" />
                      <input
                        type="password"
                        name="confirm_password"
                        required
                        placeholder="••••••"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        className="w-full pl-8 pr-2 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Farm Details */}
            <div className="pt-2 border-t border-[#E3E9E2] dark:border-farm-darkBorder">
              <h3 className="text-xs font-bold text-[#2E7D32] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Building className="w-4 h-4" />
                2. Dairy Farm Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#607067] mb-1">Farm Name</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-[#8A9990] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      name="farm_name"
                      required
                      placeholder="e.g. Green Valley Dairy"
                      value={formData.farm_name}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#607067] mb-1">Farm Location / Village</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-[#8A9990] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      name="farm_location"
                      required
                      placeholder="e.g. Ooty Road, Tumakuru Rural"
                      value={formData.farm_location}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#607067] mb-1">District</label>
                    <div className="relative">
                      <Map className="w-4 h-4 text-[#8A9990] absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        name="district"
                        required
                        value={formData.district}
                        onChange={handleChange}
                        className="w-full pl-8 pr-2 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#607067] mb-1">State</label>
                    <input
                      type="text"
                      name="state"
                      required
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#607067] mb-1">Number of Cattle</label>
                  <div className="relative">
                    <Layers className="w-4 h-4 text-[#8A9990] absolute left-3 top-2.5" />
                    <input
                      type="number"
                      name="number_of_cattle"
                      min="1"
                      max="1000"
                      required
                      value={formData.number_of_cattle}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
            >
              {isLoading ? (
                <span>Registering Farm Account...</span>
              ) : (
                <>
                  <span>Create Account & Enter Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </Card>

        {/* Footer Link to Login */}
        <div className="text-center text-xs text-[#607067] dark:text-gray-400">
          Already registered?{' '}
          <Link
            to="/login"
            className="font-bold text-[#2E7D32] hover:underline"
          >
            Sign In to Existing Account
          </Link>
        </div>
      </div>
    </div>
  );
};

