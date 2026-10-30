/**
 * Smart Livestock Monitoring System — Minimalist Real-Time Dashboard Client
 * 
 * Sources live telemetry and 5-module AI inference from consolidated FastAPI endpoints:
 * - GET /dashboard/api/live?cow_id=...
 * - GET /sensor-data/recent?cow_id=...&limit=50
 * - GET /ai/history?cow_id=...&limit=15
 */

(function () {
  "use strict";

  // Dashboard Application State
  const state = {
    selectedCowId: "COW-001",
    pollIntervalMs: 2000,
    isPolling: true,
    pollTimer: null,
    isFetching: false,
    currentAbortController: null,
    theme: "light",
    activeCows: ["COW-001"],
    lastInferenceData: null,
  };

  // Behaviour Icon Registry
  const BEHAVIOUR_ICONS = {
    grazing: "🌱",
    resting: "💤",
    walking: "🚶",
    active_mount: "⚡",
    head_nodding: "🐴",
    unknown: "🐄",
  };

  // DOM Elements Cache
  const el = {
    // Header
    cowSelect: document.getElementById("cowSelect"),
    apiStatusPill: document.getElementById("apiStatusPill"),
    apiStatusText: document.getElementById("apiStatusText"),
    hwStatusPill: document.getElementById("hwStatusPill"),
    hwStatusText: document.getElementById("hwStatusText"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    themeIcon: document.getElementById("themeIcon"),
    themeLabel: document.getElementById("themeLabel"),
    pollToggleBtn: document.getElementById("pollToggleBtn"),
    pollIcon: document.getElementById("pollIcon"),
    pollLabel: document.getElementById("pollLabel"),
    refreshBtn: document.getElementById("refreshBtn"),

    // Technical Warnings
    technicalWarningsContainer: document.getElementById("technicalWarningsContainer"),

    // Telemetry Summary (Section A)
    freshnessBadge: document.getElementById("freshnessBadge"),
    lastUpdatedTime: document.getElementById("lastUpdatedTime"),
    targetCowId: document.getElementById("targetCowId"),
    targetDeviceId: document.getElementById("targetDeviceId"),
    windowProgressText: document.getElementById("windowProgressText"),
    windowProgressBar: document.getElementById("windowProgressBar"),
    valTemp: document.getElementById("valTemp"),
    valAx: document.getElementById("valAx"),
    valAy: document.getElementById("valAy"),
    valAz: document.getElementById("valAz"),
    valGx: document.getElementById("valGx"),
    valGy: document.getElementById("valGy"),
    valGz: document.getElementById("valGz"),

    // Module 1: Behaviour
    behIcon: document.getElementById("behIcon"),
    behLabel: document.getElementById("behLabel"),
    behConf: document.getElementById("behConf"),
    behStatusBadge: document.getElementById("behStatusBadge"),
    behModelVer: document.getElementById("behModelVer"),
    behUpdated: document.getElementById("behUpdated"),

    // Module 2: Anomaly
    cardAnomaly: document.getElementById("cardAnomaly"),
    anomIcon: document.getElementById("anomIcon"),
    anomBadge: document.getElementById("anomBadge"),
    anomScore: document.getElementById("anomScore"),
    anomStatusBadge: document.getElementById("anomStatusBadge"),
    anomInterp: document.getElementById("anomInterp"),
    anomUpdated: document.getElementById("anomUpdated"),

    // Module 3: Rumination
    cardRumination: document.getElementById("cardRumination"),
    rumIcon: document.getElementById("rumIcon"),
    rumLabel: document.getElementById("rumLabel"),
    rumScore: document.getElementById("rumScore"),
    rumStatusBadge: document.getElementById("rumStatusBadge"),
    rumProb: document.getElementById("rumProb"),
    rumUpdated: document.getElementById("rumUpdated"),

    // Module 4: Estrus
    cardEstrus: document.getElementById("cardEstrus"),
    estrusIcon: document.getElementById("estrusIcon"),
    estrusRisk: document.getElementById("estrusRisk"),
    estrusMount: document.getElementById("estrusMount"),
    estrusStatusBadge: document.getElementById("estrusStatusBadge"),
    estrusSurge: document.getElementById("estrusSurge"),
    estrusUpdated: document.getElementById("estrusUpdated"),

    // Module 5: Lameness
    cardLameness: document.getElementById("cardLameness"),
    lameIcon: document.getElementById("lameIcon"),
    lameScore: document.getElementById("lameScore"),
    tempStatus: document.getElementById("tempStatus"),
    lameStatusBadge: document.getElementById("lameStatusBadge"),
    lameAsym: document.getElementById("lameAsym"),
    lameUpdated: document.getElementById("lameUpdated"),

    // Section C: Canvas
    sensorWaveformCanvas: document.getElementById("sensorWaveformCanvas"),

    // Section D: Alerts
    alertsSummaryCount: document.getElementById("alertsSummaryCount"),
    noAlertsBanner: document.getElementById("noAlertsBanner"),
    activeAlertsList: document.getElementById("activeAlertsList"),

    // Section E: History Table
    historyTableBody: document.getElementById("historyTableBody"),
  };

  /**
   * Theme Management with persistence
   */
  function initTheme() {
    const saved = localStorage.getItem("livestock_theme");
    if (saved === "dark" || saved === "light") {
      state.theme = saved;
    } else {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      state.theme = prefersDark ? "dark" : "light";
    }
    applyTheme(state.theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    if (el.themeToggleBtn) {
      el.themeToggleBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
    }
    if (el.themeIcon) {
      el.themeIcon.textContent = isDark ? "🌙" : "☀️";
    }
    if (el.themeLabel) {
      el.themeLabel.textContent = isDark ? "Dark" : "Light";
    }
    localStorage.setItem("livestock_theme", theme);
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(state.theme);
    // Redraw waveform canvas with adapted theme grid colors
    if (state.lastSensorReadings) {
      drawWaveform(state.lastSensorReadings);
    }
  }

  /**
   * Robust JSON fetch with timeout and cancellation
   */
  async function fetchJsonWithSignal(url, signal) {
    const resp = await fetch(url, { signal });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    return await resp.json();
  }

  /**
   * Format ISO timestamp to human-readable local time
   */
  function formatTime(isoString) {
    if (!isoString) return "--:--:--";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return String(isoString);
      return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return String(isoString);
    }
  }

  /**
   * Format seconds ago into readable freshness text
   */
  function formatFreshness(seconds, status) {
    if (status === "waiting_for_sensor_data" || seconds === null || seconds === undefined) {
      return "Waiting for Sensor";
    }
    if (seconds < 2.5) return "Live (Just now)";
    if (seconds < 60) return `Live (${seconds.toFixed(1)}s ago)`;
    const mins = Math.floor(seconds / 60);
    return `Stale (${mins}m ago)`;
  }

  /**
   * Reset UI to loading / empty state when switching animals
   */
  function clearDashboardUI(targetCow) {
    el.targetCowId.textContent = targetCow;
    el.targetDeviceId.textContent = "--";
    el.valTemp.textContent = "--";
    el.valAx.textContent = "--";
    el.valAy.textContent = "--";
    el.valAz.textContent = "--";
    el.valGx.textContent = "--";
    el.valGy.textContent = "--";
    el.valGz.textContent = "--";
    el.windowProgressText.textContent = "0 / 20";
    el.windowProgressBar.style.width = "0%";
    el.freshnessBadge.className = "freshness-badge waiting";
    el.freshnessBadge.textContent = "Switching Animal...";

    // Reset AI Cards to placeholder
    el.behLabel.textContent = "--";
    el.behConf.textContent = "--";
    el.behStatusBadge.className = "status-tag neutral";
    el.behStatusBadge.textContent = "Awaiting data";

    el.anomBadge.textContent = "Normal";
    el.anomScore.textContent = "--";
    el.anomStatusBadge.className = "status-tag neutral";
    el.anomStatusBadge.textContent = "Awaiting data";

    el.rumLabel.textContent = "--";
    el.rumScore.textContent = "--";
    el.rumStatusBadge.className = "status-tag neutral";
    el.rumStatusBadge.textContent = "Awaiting data";

    el.estrusRisk.textContent = "LOW RISK";
    el.estrusMount.textContent = "No mounts";
    el.estrusStatusBadge.className = "status-tag neutral";
    el.estrusStatusBadge.textContent = "Awaiting data";

    el.lameScore.textContent = "Score -- / 5.0";
    el.tempStatus.textContent = "--";
    el.lameStatusBadge.className = "status-tag neutral";
    el.lameStatusBadge.textContent = "Awaiting data";

    clearCanvas();
  }

  /**
   * Main Refresh Cycle — fetches consolidated live state
   */
  async function refreshDashboard() {
    if (state.isFetching) return;
    state.isFetching = true;

    // Abort previous in-flight request if any
    if (state.currentAbortController) {
      state.currentAbortController.abort();
    }
    const controller = new AbortController();
    state.currentAbortController = controller;

    // 4-second timeout guard
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const cowId = state.selectedCowId;

    try {
      // 1. Fetch Consolidated Live State
      const liveData = await fetchJsonWithSignal(
        `/dashboard/api/live?cow_id=${encodeURIComponent(cowId)}`,
        controller.signal
      );

      // Verify response belongs to currently selected cow (race condition guard)
      if (state.selectedCowId !== cowId) return;

      state.lastInferenceData = liveData;

      // Update API Status
      el.apiStatusPill.className = "status-pill online";
      el.apiStatusText.textContent = "API ONLINE";

      // Update Hardware Status & Freshness
      const hw = liveData.hardware || {};
      const hwStatus = hw.status || "waiting_for_sensor_data";
      if (hwStatus === "online") {
        el.hwStatusPill.className = "status-pill online";
        el.hwStatusText.textContent = "ESP32 ONLINE";
        el.freshnessBadge.className = "freshness-badge online";
      } else if (hwStatus === "stale") {
        el.hwStatusPill.className = "status-pill stale";
        el.hwStatusText.textContent = "ESP32 STALE";
        el.freshnessBadge.className = "freshness-badge stale";
      } else if (hwStatus === "offline") {
        el.hwStatusPill.className = "status-pill offline";
        el.hwStatusText.textContent = "ESP32 OFFLINE";
        el.freshnessBadge.className = "freshness-badge offline";
      } else {
        el.hwStatusPill.className = "status-pill waiting";
        el.hwStatusText.textContent = "WAITING FOR SENSOR";
        el.freshnessBadge.className = "freshness-badge waiting";
      }

      el.freshnessBadge.textContent = formatFreshness(hw.seconds_since_last_reading, hwStatus);
      el.lastUpdatedTime.textContent = formatTime(liveData.api?.server_time || new Date().toISOString());

      // Update Active Cows in Dropdown if list expanded
      if (Array.isArray(liveData.active_cows)) {
        syncActiveCows(liveData.active_cows);
      }

      // Update Section A: Telemetry
      renderTelemetrySection(liveData);

      // Update Section B: Five AI Modules
      renderAiModulesSection(liveData);

      // Update Section D: Alerts & Technical Warnings
      renderAlertsSection(liveData);

      // 2. Fetch Recent 50 Telemetry Readings for Waveform Canvas
      fetchRecentWaveform(cowId, controller.signal);

      // 3. Fetch Prediction History Table
      fetchPredictionHistory(cowId, controller.signal);

    } catch (err) {
      if (err.name === "AbortError") {
        // Normal cancellation on cow switch or timeout
        return;
      }
      console.warn("[Livestock] Dashboard sync warning:", err);
      el.apiStatusPill.className = "status-pill error";
      el.apiStatusText.textContent = "API OFFLINE";
      el.hwStatusPill.className = "status-pill offline";
      el.hwStatusText.textContent = "DISCONNECTED";
      el.freshnessBadge.className = "freshness-badge offline";
      el.freshnessBadge.textContent = "Connection Error";
    } finally {
      clearTimeout(timeoutId);
      state.isFetching = false;
    }
  }

  /**
   * Sync dynamically discovered cow identifiers to dropdown
   */
  function syncActiveCows(cows) {
    if (!cows || cows.length === 0) return;
    const existing = Array.from(el.cowSelect.options).map((o) => o.value);
    let changed = false;
    cows.forEach((c) => {
      if (!existing.includes(c)) {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c === "COW-001" ? "COW-001 (Lakshmi)" : c;
        el.cowSelect.appendChild(opt);
        changed = true;
      }
    });
  }

  /**
   * Render Section A: Telemetry Summary
   */
  function renderTelemetrySection(data) {
    const hw = data.hardware || {};
    const sensor = data.sensor || {};
    const vals = sensor.values || {};
    const win = data.window || {};

    el.targetCowId.textContent = hw.cow_id || state.selectedCowId;
    el.targetDeviceId.textContent = hw.device_id || "--";

    // Values formatted to 3 decimal places for g, 2 for gyro
    el.valAx.textContent = vals.accel_x !== null && vals.accel_x !== undefined ? Number(vals.accel_x).toFixed(3) : "--";
    el.valAy.textContent = vals.accel_y !== null && vals.accel_y !== undefined ? Number(vals.accel_y).toFixed(3) : "--";
    el.valAz.textContent = vals.accel_z !== null && vals.accel_z !== undefined ? Number(vals.accel_z).toFixed(3) : "--";

    el.valGx.textContent = vals.gyro_x !== null && vals.gyro_x !== undefined ? Number(vals.gyro_x).toFixed(2) : "--";
    el.valGy.textContent = vals.gyro_y !== null && vals.gyro_y !== undefined ? Number(vals.gyro_y).toFixed(2) : "--";
    el.valGz.textContent = vals.gyro_z !== null && vals.gyro_z !== undefined ? Number(vals.gyro_z).toFixed(2) : "--";

    if (vals.temperature_c !== null && vals.temperature_c !== undefined) {
      el.valTemp.textContent = Number(vals.temperature_c).toFixed(1);
    } else {
      el.valTemp.textContent = "--";
    }

    // Window progress
    const count = win.sample_count || 0;
    const req = win.required_samples || 20;
    el.windowProgressText.textContent = `${count} / ${req}`;
    const pct = win.progress_percent !== undefined ? win.progress_percent : Math.min(100, Math.round((count / req) * 100));
    el.windowProgressBar.style.width = `${pct}%`;
  }

  /**
   * Render Section B: Five AI Modules
   */
  function renderAiModulesSection(data) {
    const ai = data.ai || {};
    const winReady = data.window?.ready;

    // --- 1. Behaviour ---
    const beh = ai.behaviour || {};
    if (beh.status === "available" && beh.label) {
      const normLabel = beh.label.toLowerCase().replace(" ", "_");
      el.behIcon.textContent = BEHAVIOUR_ICONS[normLabel] || "🐄";
      el.behLabel.textContent = beh.label.replace("_", " ");
      el.behStatusBadge.className = "status-tag ready";
      el.behStatusBadge.textContent = "Available";

      const probs = beh.probabilities || {};
      const maxP = probs[beh.label];
      if (maxP !== undefined && maxP !== null) {
        el.behConf.textContent = `${(maxP * 100).toFixed(1)}%`;
      } else {
        el.behConf.textContent = "Confirmed";
      }
      el.behUpdated.textContent = `Window: ${beh.window_size || 20} samples`;
    } else {
      el.behIcon.textContent = "⏳";
      el.behLabel.textContent = winReady ? "Processing..." : "Warming up";
      el.behConf.textContent = "--";
      el.behStatusBadge.className = "status-tag neutral";
      el.behStatusBadge.textContent = beh.reason ? "Awaiting data" : "Warming up";
      el.behUpdated.textContent = beh.reason || "Accumulating sensor window";
    }

    // --- 2. Anomaly Detection ---
    const anom = ai.anomaly || {};
    if (anom.status === "available" && anom.detected !== null) {
      const isAnom = Boolean(anom.detected);
      el.anomBadge.textContent = isAnom ? "Unusual Activity" : "Normal";
      el.anomBadge.style.color = isAnom ? "var(--status-red)" : "var(--status-green)";
      el.anomIcon.textContent = isAnom ? "⚠️" : "🛡️";
      el.anomStatusBadge.className = isAnom ? "status-tag alert" : "status-tag normal";
      el.anomStatusBadge.textContent = isAnom ? "Alert" : "Sound";
      el.anomScore.textContent = anom.score !== undefined ? Number(anom.score).toFixed(4) : "--";
      el.anomInterp.textContent = anom.interpretation || "Observed dynamics match normal baseline.";
      el.anomUpdated.textContent = "Baseline: Grazing IMU reference";
    } else {
      el.anomBadge.textContent = "--";
      el.anomBadge.style.color = "var(--text-main)";
      el.anomIcon.textContent = "⏳";
      el.anomStatusBadge.className = "status-tag neutral";
      el.anomStatusBadge.textContent = "Awaiting data";
      el.anomScore.textContent = "--";
      el.anomInterp.textContent = anom.reason || "Awaiting minimum 20 samples";
      el.anomUpdated.textContent = "Baseline: Grazing IMU reference";
    }

    // --- 3. Rumination ---
    const rum = ai.rumination || {};
    if (rum.status === "available" && rum.is_ruminating !== null) {
      const isRum = Boolean(rum.is_ruminating);
      el.rumLabel.textContent = isRum ? "Ruminating" : "Non-ruminating";
      el.rumLabel.style.color = isRum ? "var(--accent)" : "var(--text-main)";
      el.rumIcon.textContent = isRum ? "🌾" : "💤";
      el.rumStatusBadge.className = isRum ? "status-tag ready" : "status-tag neutral";
      el.rumStatusBadge.textContent = isRum ? "Active Cud" : "Rest / Feed";

      const chew = rum.chewing_rhythm_score !== undefined ? Number(rum.chewing_rhythm_score).toFixed(2) : "--";
      el.rumScore.textContent = `${chew} (Rhythm Index)`;
      const probPct = rum.probability !== undefined ? Math.round(rum.probability * 100) : "--";
      el.rumProb.textContent = `Chewing Probability: ${probPct}%`;
      el.rumUpdated.textContent = rum.interpretation || "Chewing rhythm analysis active";
    } else {
      el.rumLabel.textContent = "--";
      el.rumLabel.style.color = "var(--text-main)";
      el.rumIcon.textContent = "⏳";
      el.rumStatusBadge.className = "status-tag neutral";
      el.rumStatusBadge.textContent = "Awaiting data";
      el.rumScore.textContent = "--";
      el.rumProb.textContent = "--";
      el.rumUpdated.textContent = rum.reason || "Accumulating sensor window";
    }

    // --- 4. Estrus ---
    const estrus = ai.estrus || {};
    if (estrus.status === "available" && estrus.risk_level) {
      const risk = estrus.risk_level;
      el.estrusRisk.textContent = `${risk} RISK`;
      if (risk === "HIGH") {
        el.estrusRisk.style.color = "var(--status-red)";
        el.estrusIcon.textContent = estrus.mount_detected ? "⚡" : "🔥";
        el.estrusStatusBadge.className = "status-tag alert";
        el.estrusStatusBadge.textContent = "High Risk";
      } else if (risk === "MODERATE") {
        el.estrusRisk.style.color = "var(--status-amber)";
        el.estrusIcon.textContent = "👀";
        el.estrusStatusBadge.className = "status-tag warning";
        el.estrusStatusBadge.textContent = "Watch";
      } else {
        el.estrusRisk.style.color = "var(--status-green)";
        el.estrusIcon.textContent = "🌱";
        el.estrusStatusBadge.className = "status-tag normal";
        el.estrusStatusBadge.textContent = "Normal";
      }

      el.estrusMount.textContent = estrus.mount_detected ? "MOUNT DETECTED" : "No mounts";
      const surge = estrus.activity_surge !== undefined ? `+${Number(estrus.activity_surge).toFixed(2)} g` : "--";
      el.estrusSurge.textContent = surge;
      el.estrusUpdated.textContent = estrus.interpretation || "Mounting & activity surveillance active";
    } else {
      el.estrusRisk.textContent = "--";
      el.estrusRisk.style.color = "var(--text-main)";
      el.estrusIcon.textContent = "⏳";
      el.estrusStatusBadge.className = "status-tag neutral";
      el.estrusStatusBadge.textContent = "Awaiting data";
      el.estrusMount.textContent = "--";
      el.estrusSurge.textContent = "--";
      el.estrusUpdated.textContent = estrus.reason || "Accumulating sensor window";
    }

    // --- 5. Lameness & Thermal ---
    const lame = ai.lameness || {};
    if (lame.status === "available" && lame.locomotion_score !== null) {
      const score = Number(lame.locomotion_score).toFixed(1);
      el.lameScore.textContent = `Score ${score} / 5.0`;

      const tStatus = lame.temperature_status || "NORMAL";
      if (tStatus === "ELEVATED_FEVER_RISK") {
        el.tempStatus.textContent = `Fever Alert (${lame.contact_temperature_c}°C)`;
        el.tempStatus.style.color = "var(--status-red)";
        el.lameIcon.textContent = "🌡️";
        el.lameStatusBadge.className = "status-tag alert";
        el.lameStatusBadge.textContent = "Fever Alert";
      } else if (score >= 3.2) {
        el.tempStatus.textContent = `Normal (${lame.contact_temperature_c}°C)`;
        el.tempStatus.style.color = "var(--status-red)";
        el.lameIcon.textContent = "⚠️";
        el.lameStatusBadge.className = "status-tag alert";
        el.lameStatusBadge.textContent = "Asymmetry";
      } else {
        el.tempStatus.textContent = `Normal (${lame.contact_temperature_c}°C)`;
        el.tempStatus.style.color = "var(--status-green)";
        el.lameIcon.textContent = "🦵";
        el.lameStatusBadge.className = "status-tag normal";
        el.lameStatusBadge.textContent = "Sound";
      }

      const asym = lame.gait_asymmetry_index !== undefined ? `${Math.round(lame.gait_asymmetry_index * 100)}%` : "--";
      el.lameAsym.textContent = asym;
      el.lameUpdated.textContent = lame.interpretation || "Gait and thermal health operational";
    } else {
      el.lameScore.textContent = "Score -- / 5.0";
      el.tempStatus.textContent = "--";
      el.tempStatus.style.color = "var(--text-main)";
      el.lameIcon.textContent = "⏳";
      el.lameStatusBadge.className = "status-tag neutral";
      el.lameStatusBadge.textContent = "Awaiting data";
      el.lameAsym.textContent = "--";
      el.lameUpdated.textContent = lame.reason || "Accumulating sensor window";
    }
  }

  /**
   * Render Section D: Alerts & Technical Warnings
   */
  function renderAlertsSection(data) {
    const alerts = data.alerts || [];
    const techWarnings = data.technical_warnings || [];

    // Technical Warnings Banner
    if (techWarnings.length > 0) {
      el.technicalWarningsContainer.style.display = "flex";
      el.technicalWarningsContainer.innerHTML = techWarnings
        .map((tw) => `<div class="tech-warning-banner"><span>⚠️</span> <span>${tw.message}</span></div>`)
        .join("");
    } else {
      el.technicalWarningsContainer.style.display = "none";
      el.technicalWarningsContainer.innerHTML = "";
    }

    // Animal Health Alerts
    const count = alerts.length;
    el.alertsSummaryCount.textContent = `${count} Active`;
    if (count > 0) {
      el.alertsSummaryCount.className = "alerts-count-badge has-alerts";
      el.noAlertsBanner.style.display = "none";
      el.activeAlertsList.style.display = "flex";

      el.activeAlertsList.innerHTML = alerts
        .map((a) => {
          const isWarning = a.severity === "warning";
          return `
            <div class="alert-item ${isWarning ? "warning" : ""}">
              <div class="alert-main">
                <span class="alert-icon">${isWarning ? "⚠️" : "🚨"}</span>
                <div>
                  <div class="alert-title">${a.title} (${a.cow_id})</div>
                  <div class="alert-msg">${a.message}</div>
                </div>
              </div>
              <div class="alert-meta">
                <div>${formatTime(a.timestamp)}</div>
                <div>Source: ${a.source || "AI Engine"}</div>
              </div>
            </div>
          `;
        })
        .join("");
    } else {
      el.alertsSummaryCount.className = "alerts-count-badge";
      el.noAlertsBanner.style.display = "flex";
      el.activeAlertsList.style.display = "none";
      el.activeAlertsList.innerHTML = "";
    }
  }

  /**
   * Fetch Recent 50 Telemetry Readings and Draw Waveform
   */
  async function fetchRecentWaveform(cowId, signal) {
    try {
      const data = await fetchJsonWithSignal(
        `/sensor-data/recent?cow_id=${encodeURIComponent(cowId)}&limit=50`,
        signal
      );
      if (state.selectedCowId !== cowId) return;
      const readings = data.readings || [];
      state.lastSensorReadings = readings;
      drawWaveform(readings);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.warn("[Livestock] Waveform fetch failed:", err);
      }
    }
  }

  /**
   * Draw continuous 3-axis accelerometer waveform on Canvas
   */
  function drawWaveform(readings) {
    const canvas = el.sensorWaveformCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw reference horizontal grid lines
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
    ctx.lineWidth = 1;

    // Center zero / 1g line
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Upper/Lower quarter lines
    ctx.beginPath();
    ctx.moveTo(0, height / 4);
    ctx.lineTo(width, height / 4);
    ctx.moveTo(0, (height * 3) / 4);
    ctx.lineTo(width, (height * 3) / 4);
    ctx.stroke();

    if (!readings || readings.length < 2) return;

    const samples = readings.slice(-50);
    const step = width / (samples.length - 1);

    const series = [
      { key: "accel_x", color: "#00d2ff" },
      { key: "accel_y", color: "#10b981" },
      { key: "accel_z", color: "#a855f7" },
    ];

    series.forEach(({ key, color }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.75;
      ctx.beginPath();

      samples.forEach((reading, i) => {
        const s = reading.sensors || reading;
        let val = Number(s[key]) || 0;
        // Range ±2.5g maps to height
        const y = height / 2 - (val / 2.5) * (height / 2);
        const x = i * step;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
    });
  }

  function clearCanvas() {
    const canvas = el.sensorWaveformCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Fetch and render 5-module prediction history table
   */
  async function fetchPredictionHistory(cowId, signal) {
    try {
      const data = await fetchJsonWithSignal(
        `/ai/history?cow_id=${encodeURIComponent(cowId)}&limit=15`,
        signal
      );
      if (state.selectedCowId !== cowId) return;
      const history = data.history || [];

      if (history.length === 0) {
        el.historyTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="table-empty-cell">
              No historical predictions recorded for ${cowId} yet.
            </td>
          </tr>
        `;
        return;
      }

      const rowsHtml = history
        .slice()
        .reverse()
        .map((item) => {
          const time = formatTime(item.timestamp);
          const behLabel = item.behaviour?.label ? item.behaviour.label.replace("_", " ") : "insufficient data";

          const isAnom = item.anomaly?.detected;
          const anomBadge = isAnom
            ? `<span style="color: var(--status-red); font-weight:700;">⚠️ Unusual</span>`
            : `<span style="color: var(--status-green);">Normal</span>`;

          const isRum = item.rumination?.is_ruminating;
          const rumBadge = isRum
            ? `<span style="color: var(--accent); font-weight:600;">🌾 Ruminating</span>`
            : `<span style="color: var(--text-muted);">Non-rum</span>`;

          const estrusRisk = item.estrus?.risk_level || "LOW";
          let estrusBadge = `<span style="color: var(--status-green);">Low</span>`;
          if (estrusRisk === "HIGH") {
            estrusBadge = `<span style="color: var(--status-red); font-weight:700;">🔥 High</span>`;
          } else if (estrusRisk === "MODERATE") {
            estrusBadge = `<span style="color: var(--status-amber); font-weight:600;">⚡ Moderate</span>`;
          }

          const lScore = item.lameness?.locomotion_score !== undefined ? Number(item.lameness.locomotion_score).toFixed(1) : "--";
          const tempVal = item.lameness?.contact_temperature_c !== undefined ? `(${item.lameness.contact_temperature_c}°C)` : "";
          const lameBadge = `<span>Score ${lScore} ${tempVal}</span>`;

          return `
            <tr>
              <td>${time}</td>
              <td style="text-transform: capitalize; font-weight: 500;">${behLabel}</td>
              <td>${anomBadge}</td>
              <td>${rumBadge}</td>
              <td>${estrusBadge}</td>
              <td>${lameBadge}</td>
            </tr>
          `;
        })
        .join("");

      el.historyTableBody.innerHTML = rowsHtml;
    } catch (err) {
      if (err.name !== "AbortError") {
        console.warn("[Livestock] History fetch warning:", err);
      }
    }
  }

  /**
   * Start / Pause Auto Polling
   */
  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.isPolling = true;
    if (el.pollIcon) el.pollIcon.textContent = "⏸️";
    if (el.pollLabel) el.pollLabel.textContent = "Pause";
    refreshDashboard();
    state.pollTimer = setInterval(refreshDashboard, state.pollIntervalMs);
  }

  function pausePolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.isPolling = false;
    if (el.pollIcon) el.pollIcon.textContent = "▶️";
    if (el.pollLabel) el.pollLabel.textContent = "Resume";
  }

  /**
   * Setup Canvas Dimensions for Retina DPI
   */
  function resizeCanvas() {
    const canvas = el.sensorWaveformCanvas;
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor((rect.width || 600) * dpr);
    canvas.height = Math.floor((rect.height || 150) * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
  }

  /**
   * Initialize App Listeners and State
   */
  function init() {
    initTheme();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Theme Toggle Listener
    if (el.themeToggleBtn) {
      el.themeToggleBtn.addEventListener("click", toggleTheme);
    }

    // Cow Selector Listener
    if (el.cowSelect) {
      el.cowSelect.addEventListener("change", (e) => {
        const newCow = e.target.value;
        if (newCow === state.selectedCowId) return;
        state.selectedCowId = newCow;
        clearDashboardUI(newCow);
        refreshDashboard();
      });
    }

    // Manual Refresh Button
    if (el.refreshBtn) {
      el.refreshBtn.addEventListener("click", () => {
        refreshDashboard();
      });
    }

    // Pause / Resume Polling Toggle
    if (el.pollToggleBtn) {
      el.pollToggleBtn.addEventListener("click", () => {
        if (state.isPolling) pausePolling();
        else startPolling();
      });
    }

    // Page Visibility handling (pause in background, refresh and resume on return)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (state.pollTimer) clearInterval(state.pollTimer);
      } else {
        if (state.isPolling) {
          refreshDashboard();
          state.pollTimer = setInterval(refreshDashboard, state.pollIntervalMs);
        }
      }
    });

    // Start auto polling cycle
    startPolling();
  }

  // Run on DOM Ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
