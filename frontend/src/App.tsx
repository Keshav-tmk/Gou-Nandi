// ============================================================
// SmartLivestock AI — Application Root with Router & Layout
// ============================================================

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';

import { DashboardPage } from './pages/DashboardPage';
import { BehaviourPage } from './pages/BehaviourPage';
import { CowsPage } from './pages/CowsPage';
import { CowDetailsPage } from './pages/CowDetailsPage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/behaviour" element={<BehaviourPage />} />
            <Route path="/cows" element={<CowsPage />} />
            <Route path="/cows/:id" element={<CowDetailsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppLayout>
      </HashRouter>
    </ErrorBoundary>
  );
}

