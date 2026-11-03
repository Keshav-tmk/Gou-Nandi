// ============================================================
// GouNandi AI — Farmer Profile & Farm Settings Page (/profile)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { Card } from '../components/common/Card';
import { SectionHeader } from '../components/common/SectionHeader';
import {
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Lock,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Tag,
  Layers,
  Save,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { farmer, farm, logout, updateLocalProfile } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Edit profile state
  const [personalData, setPersonalData] = useState({
    full_name: farmer?.full_name || '',
    phone: farmer?.phone || '',
    farm_name: farm?.farm_name || '',
    farm_location: farm?.farm_location || '',
    district: farm?.district || 'Tumakuru',
    state: farm?.state || 'Karnataka',
  });

  // Password state
  const [pwdData, setPwdData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state if farmer updates
  useEffect(() => {
    if (farmer) {
      setPersonalData({
        full_name: farmer.full_name || '',
        phone: farmer.phone || '',
        farm_name: farmer.farm?.farm_name || '',
        farm_location: farmer.farm?.farm_location || '',
        district: farmer.farm?.district || 'Tumakuru',
        state: farmer.farm?.state || 'Karnataka',
      });
    }
  }, [farmer]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await authService.updateProfile(personalData);
      if (res && res.farmer) {
        updateLocalProfile(res.farmer);
        setStatusMessage({ type: 'success', text: 'Farm profile updated successfully.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    if (pwdData.new_password !== pwdData.confirm_password) {
      setStatusMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      setIsSubmitting(false);
      return;
    }

    try {
      await authService.changePassword(pwdData.current_password, pwdData.new_password, pwdData.confirm_password);
      setStatusMessage({ type: 'success', text: 'Password changed successfully.' });
      setPwdData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to change password. Verify your current password.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = farmer?.full_name
    ? farmer.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'FM';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#263238] dark:text-white tracking-tight flex items-center gap-2">
          <User className="w-6 h-6 text-[#2E7D32]" />
          Farmer Account & Farm Settings
        </h1>
        <p className="text-xs sm:text-sm text-[#607067] dark:text-gray-400 mt-1">
          Manage your personal details, registered dairy farm profile, security, and data access.
        </p>
      </div>

      {/* Top Profile Summary Badge */}
      <Card className="p-5 sm:p-6 bg-white dark:bg-farm-darkCard border border-[#E3E9E2] dark:border-farm-darkBorder shadow-xs rounded-2xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          {/* Avatar with initials */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] text-white flex items-center justify-center text-xl font-extrabold shadow-sm border-2 border-white dark:border-gray-800 shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[#263238] dark:text-white">
                {farmer?.full_name || 'Registered Dairy Farmer'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                {farmer?.farmer_id || 'FARM_001'}
              </span>
            </div>
            <p className="text-xs font-semibold text-[#2E7D32] mt-0.5 flex items-center justify-center sm:justify-start gap-1">
              <Building className="w-3.5 h-3.5" />
              {farm?.farm_name || 'GouNandi Dairy Farm'}
            </p>
            <p className="text-xs text-[#607067] mt-1 flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
              <MapPin className="w-3.5 h-3.5 text-[#8A9990]" />
              {farm?.farm_location || 'Tumakuru Rural'}, {farm?.district || 'Tumakuru'}, {farm?.state || 'Karnataka'}
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-xs font-bold hover:bg-red-100 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E3E9E2] dark:border-farm-darkBorder pb-2">
        <button
          type="button"
          onClick={() => { setActiveTab('profile'); setStatusMessage(null); }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
              : 'text-[#607067] hover:bg-[#F7F9F4]'
          }`}
        >
          Personal & Farm Details
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('security'); setStatusMessage(null); }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
              : 'text-[#607067] hover:bg-[#F7F9F4]'
          }`}
        >
          Password & Security
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tab 1: Profile & Farm Information */}
      {activeTab === 'profile' && (
        <Card className="p-6 bg-white dark:bg-farm-darkCard border border-[#E3E9E2] dark:border-farm-darkBorder shadow-xs rounded-2xl">
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <h3 className="text-sm font-bold text-[#263238] dark:text-white pb-2 border-b border-[#E3E9E2] dark:border-farm-darkBorder flex items-center gap-1.5">
              <Building className="w-4 h-4 text-[#2E7D32]" />
              Edit Farmer & Farm Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[#607067] font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={personalData.full_name}
                  onChange={(e) => setPersonalData({ ...personalData, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[#607067] font-semibold mb-1">Email (Cannot be modified)</label>
                <input
                  type="email"
                  disabled
                  value={farmer?.email || ''}
                  className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[#607067] font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={personalData.phone}
                  onChange={(e) => setPersonalData({ ...personalData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[#607067] font-semibold mb-1">Farm Name</label>
                <input
                  type="text"
                  required
                  value={personalData.farm_name}
                  onChange={(e) => setPersonalData({ ...personalData, farm_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[#607067] font-semibold mb-1">Farm Location</label>
                <input
                  type="text"
                  required
                  value={personalData.farm_location}
                  onChange={(e) => setPersonalData({ ...personalData, farm_location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#607067] font-semibold mb-1">District</label>
                  <input
                    type="text"
                    required
                    value={personalData.district}
                    onChange={(e) => setPersonalData({ ...personalData, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#607067] font-semibold mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={personalData.state}
                    onChange={(e) => setPersonalData({ ...personalData, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <Card className="p-6 bg-white dark:bg-farm-darkCard border border-[#E3E9E2] dark:border-farm-darkBorder shadow-xs rounded-2xl">
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <h3 className="text-sm font-bold text-[#263238] dark:text-white pb-2 border-b border-[#E3E9E2] dark:border-farm-darkBorder flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#2E7D32]" />
              Update Account Password
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#607067] font-semibold mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={pwdData.current_password}
                  onChange={(e) => setPwdData({ ...pwdData, current_password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[#607067] font-semibold mb-1">New Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={pwdData.new_password}
                  onChange={(e) => setPwdData({ ...pwdData, new_password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[#607067] font-semibold mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={pwdData.confirm_password}
                  onChange={(e) => setPwdData({ ...pwdData, confirm_password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};

