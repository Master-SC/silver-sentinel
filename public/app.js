/**
 * SilverSentinel Dashboard Controller (app.js)
 * Implements real-time triage updates, simulation dispatching, filters,
 * route checklists, and a complete client-side simulation engine fallback
 * in case the local backend HTTP server is offline.
 * 
 * Enhanced with:
 * - Dynamic SVG geographic map rendering and pin positioning
 * - Live Sub-Agent Reasoning Console stream simulations
 * - Quick-filtering category tags
 * - Interactive route completion progress bars
 */

// --- DUAL-MODE CONTROLLER: CLIENT-SIDE FALLBACK DATABASE & LOGIC ---
const FALLBACK_POSTCODES = {
  'SW1A 1AA': { area: 'Westminster', lat: 51.501, lon: -0.141 },
  'SW1V 2BP': { area: 'Pimlico', lat: 51.491, lon: -0.138 },
  'SE1 9SG': { area: 'Southwark', lat: 51.503, lon: -0.096 },
  'E1 6AN': { area: 'Spitalfields', lat: 51.520, lon: -0.076 },
  'WC2N 5DN': { area: 'Charing Cross', lat: 51.508, lon: -0.127 },
  'M1 1AE': { area: 'Manchester Piccadilly', lat: 53.480, lon: -2.230 },
  'M15 4FN': { area: 'Hulme', lat: 53.468, lon: -2.247 },
  'L1 0AB': { area: 'Liverpool Centre', lat: 53.401, lon: -2.983 },
  'L3 4FP': { area: 'Albert Dock', lat: 53.398, lon: -2.992 },
  'EH1 1YT': { area: 'Edinburgh Royal Mile', lat: 55.950, lon: -3.189 },
  'EH3 9QQ': { area: 'Tollcross', lat: 55.943, lon: -3.205 },
  'G1 1QX': { area: 'Glasgow George Square', lat: 55.862, lon: -4.249 },
  'CF10 1EP': { area: 'Cardiff City Centre', lat: 51.481, lon: -3.178 },
  'CF11 9HB': { area: 'Canton', lat: 51.478, lon: -3.201 },
  'BT1 5GS': { area: 'Belfast City Hall', lat: 54.597, lon: -5.930 }
};

function getFallbackResidents() {
  const firstNames = ['Arthur', 'Beatrice', 'Charles', 'Dorothy', 'Edward', 'Florence', 'George', 'Gwendolyn', 'Harold', 'Irene', 'James', 'Kathleen', 'Leonard', 'Margaret', 'Ronald', 'Albert', 'Evelyn', 'Stanley', 'Mildred', 'Walter'];
  const lastNames = ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Robinson', 'Walker', 'White', 'Green', 'Wood', 'Jackson', 'Clarke'];
  const postcodes = Object.keys(FALLBACK_POSTCODES);
  const residents = [];
  
  let seed = 42;
  function random() {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  for (let i = 0; i < 45; i++) {
    const name = `${firstNames[Math.floor(random() * firstNames.length)]} ${lastNames[Math.floor(random() * lastNames.length)]}`;
    const age = Math.floor(65 + random() * 32);
    const mobilityScore = Math.floor(1 + random() * 5);
    const medicalDeviceDependent = random() < 0.20;
    const livesAlone = random() < 0.65;
    const conditions = ['Chronic COPD', 'Advanced Dementia', 'Arthritis', 'Cardiovascular Disease', 'Type 1 Diabetes', 'Parkinsons'];
    const condition = random() < 0.75 ? conditions[Math.floor(random() * conditions.length)] : 'None';
    const postcode = postcodes[Math.floor(random() * postcodes.length)];
    
    residents.push({
      id: `RES-${1000 + i}`,
      name, age, postcode, area: FALLBACK_POSTCODES[postcode].area,
      mobilityScore, medicalDeviceDependent, condition, livesAlone,
      phone: `07700 900${Math.floor(100 + random() * 900)}`
    });
  }
  return residents;
}

const FALLBACK_ALERTS = {
  flood: {
    id: 'MET-AL-002',
    hazard: 'Severe Flash Flooding',
    severity: 'Red',
    description: 'Rapidly rising water levels. Threat to life. Property flooding expected in low-lying sectors.',
    affectedPostcodes: ['SW1A 1AA', 'SW1V 2BP', 'SE1 9SG'],
    issuedAt: new Date().toISOString()
  },
  freeze: {
    id: 'MET-AL-001',
    hazard: 'Deep Freeze & Black Ice',
    severity: 'Amber',
    description: 'Temperatures projected to fall below -6°C overnight with severe black ice hazard.',
    affectedPostcodes: ['EH1 1YT', 'EH3 9QQ', 'G1 1QX'],
    issuedAt: new Date().toISOString()
  },
  storm: {
    id: 'MET-AL-003',
    hazard: 'Gale Force Winds & Storm Surge',
    severity: 'Yellow',
    description: 'Winds up to 65mph expected. High risk of power grid disruption and localized flooding.',
    affectedPostcodes: ['L1 0AB', 'L3 4FP', 'CF11 9HB'],
    issuedAt: new Date().toISOString()
  }
};

function calculateFallbackScore(resident, alert) {
  let score = 0.0;
  const breakdown = [];

  if (resident.age > 65) {
    const ageFactor = (resident.age - 65) * 0.4;
    score += ageFactor;
    breakdown.push({ factor: 'Age Vulnerability', points: parseFloat(ageFactor.toFixed(1)), detail: `Age ${resident.age} (>65)` });
  }

  const mobilityFactor = resident.mobilityScore * 1.5;
  score += mobilityFactor;
  breakdown.push({ factor: 'Low Mobility', points: mobilityFactor, detail: `Mobility Index ${resident.mobilityScore}/5` });

  if (resident.medicalDeviceDependent) {
    const deviceFactor = 6.0;
    score += deviceFactor;
    breakdown.push({ factor: 'Medical Device Dependent', points: deviceFactor, detail: 'Requires active power/equipment' });
  }

  if (resident.livesAlone) {
    const isolationFactor = 2.0;
    score += isolationFactor;
    breakdown.push({ factor: 'Living Isolated', points: isolationFactor, detail: 'Lives alone, no local household support' });
  }

  if (resident.condition && resident.condition !== 'None') {
    const conditionFactor = 2.0;
    score += conditionFactor;
    breakdown.push({ factor: 'Medical Condition', points: conditionFactor, detail: resident.condition });
  }

  const severityPoints = { 'Red': 5.0, 'Amber': 3.0, 'Yellow': 1.5 };
  const alertSeverityFactor = severityPoints[alert.severity] || 1.0;
  score += alertSeverityFactor;
  breakdown.push({ factor: 'Weather Alert Level', points: alertSeverityFactor, detail: `${alert.severity} ${alert.hazard}` });

  if (alert.hazard.toLowerCase().includes('freeze') && resident.condition.includes('COPD')) {
    const freezeCopdFactor = 3.0;
    score += freezeCopdFactor;
    breakdown.push({ factor: 'Hazard-Condition Symbiosis', points: freezeCopdFactor, detail: 'Cold weather risk to COPD condition' });
  }

  if (alert.hazard.toLowerCase().includes('flood') && resident.mobilityScore >= 4) {
    const floodMobilityFactor = 3.5;
    score += floodMobilityFactor;
    breakdown.push({ factor: 'Hazard-Mobility Symbiosis', points: floodMobilityFactor, detail: 'Flood hazard risk to low mobility resident' });
  }

  const finalScore = parseFloat(score.toFixed(2));
  let urgencyBand = 'Standard';
  if (finalScore >= 18) urgencyBand = 'CRITICAL (Immediate Dispatch)';
  else if (finalScore >= 12) urgencyBand = 'HIGH (Same Day Visit)';
  else if (finalScore >= 7) urgencyBand = 'MEDIUM (Contact / Check)';

  return {
    residentId: resident.id,
    residentName: resident.name,
    age: resident.age,
    postcode: resident.postcode,
    area: resident.area,
    phone: resident.phone,
    condition: resident.condition,
    mobilityScore: resident.mobilityScore,
    medicalDeviceDependent: resident.medicalDeviceDependent,
    livesAlone: resident.livesAlone,
    alertId: alert.id,
    hazard: alert.hazard,
    severity: alert.severity,
    vulnerabilityScore: finalScore,
    urgencyBand,
    breakdown
  };
}

function fallbackDistance(pc1, pc2) {
  const pos1 = FALLBACK_POSTCODES[pc1];
  const pos2 = FALLBACK_POSTCODES[pc2];
  if (!pos1 || !pos2) return 10.0;
  const R = 6371;
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLon = (pos2.lon - pos1.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(pos1.lat*Math.PI/180) * Math.cos(pos2.lat*Math.PI/180) * Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateFallbackRoutes(triaged) {
  const sectors = {};
  for (const r of triaged) {
    const key = r.area || 'Unknown Sector';
    if (!sectors[key]) sectors[key] = [];
    sectors[key].push(r);
  }

  const routes = [];
  let counter = 1;

  for (const [sectorName, list] of Object.entries(sectors)) {
    const sorted = [...list].sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);
    const hub = sorted[0].postcode;
    const hazard = sorted[0].hazard;
    const severity = sorted[0].severity;

    const unvisited = [...sorted];
    const optimized = [];
    let curr = hub;

    while (unvisited.length > 0) {
      let bestIdx = -1;
      let maxWeight = -Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const c = unvisited[i];
        const dist = fallbackDistance(curr, c.postcode);
        const weight = (c.vulnerabilityScore * 2) - dist;
        if (weight > maxWeight) {
          maxWeight = weight;
          bestIdx = i;
        }
      }
      if (bestIdx !== -1) {
        const next = unvisited.splice(bestIdx, 1)[0];
        optimized.push(next);
        curr = next.postcode;
      } else {
        break;
      }
    }

    const tasks = optimized.map((res, idx) => {
      let actions = ['Conduct wellness check and report status to dashboard.'];
      if (hazard.toLowerCase().includes('freeze')) {
        actions = [
          'Deliver high-thermal emergency blanket and emergency heater.',
          'Verify main indoor heating is active; if failed, report immediately.',
          'Ensure warm fluids and shelf-stable food are accessible.'
        ];
      } else if (hazard.toLowerCase().includes('flood')) {
        actions = [
          'Assess immediate flood water level at property entry.',
          'If water is near threshold, prepare for evacuation to local hub.',
          'Relocate critical medical devices and medication to upper floors.'
        ];
      } else if (hazard.toLowerCase().includes('wind')) {
        actions = [
          'Secure loose outdoor items that could impact windows.',
          'Check backup lighting (torches) and radio status.',
          'Confirm power status and emergency contact numbers.'
        ];
      }

      if (res.medicalDeviceDependent) {
        actions.unshift('CRITICAL: Verify and test auxiliary battery backup for medical equipment.');
      }
      if (res.mobilityScore >= 4) {
        actions.push('Verify evacuation exit path is completely clear.');
      }

      return {
        sequence: idx + 1,
        residentId: res.residentId,
        name: res.residentName,
        age: res.age,
        postcode: res.postcode,
        phone: res.phone,
        urgencyBand: res.urgencyBand,
        vulnerabilityScore: res.vulnerabilityScore,
        conditions: res.condition,
        mobility: res.mobilityScore,
        deviceDependent: res.medicalDeviceDependent,
        recommendedActions: actions
      };
    });

    routes.push({
      routeId: `ROUTE-SEC-${String(counter++).padStart(3, '0')}`,
      sector: sectorName,
      hazard,
      severity,
      totalVisits: tasks.length,
      criticalVisits: tasks.filter(t => t.urgencyBand.includes('CRITICAL')).length,
      highVisits: tasks.filter(t => t.urgencyBand.includes('HIGH')).length,
      estimatedDurationMinutes: tasks.length * 25 + 15,
      tasks
    });
  }
  return routes;
}

// --- GLOBAL STATE ---
let state = {
  isUsingFallback: false,
  allResidents: [],
  activeAlerts: [],
  triagedResidents: [],
  routes: [],
  expandedRoutes: {},
  checkedTasks: {},
  quickFilter: 'ALL' // Filter tags: 'ALL', 'DEVICE', 'MOBILITY', 'ISOLATED', 'COPD'
};

// SVG Projection Helper
// Maps Latitude and Longitude to the 300x400 SVG Map coordinates
function projectLatLngToSvg(lat, lon) {
  // UK geographic boundaries bounding box for coordinates
  const latMin = 51.2;
  const latMax = 56.4;
  const lonMin = -6.2;
  const lonMax = -0.1;
  
  // Project to viewport coordinates
  const x = 50 + ((lon - lonMin) / (lonMax - lonMin)) * (200 - 50);
  const y = 350 - ((lat - latMin) / (latMax - latMin)) * (350 - 50);
  return { x: parseFloat(x.toFixed(1)), y: parseFloat(y.toFixed(1)) };
}

// Elements
const elSystemStatusIndicator = document.getElementById('system-status-indicator');
const elValActiveAlerts = document.getElementById('val-active-alerts');
const elValVulnerableCount = document.getElementById('val-vulnerable-count');
const elValTriagedCount = document.getElementById('val-triaged-count');

const elBtnSimFlood = document.getElementById('btn-sim-flood');
const elBtnSimFreeze = document.getElementById('btn-sim-freeze');
const elBtnSimStorm = document.getElementById('btn-sim-storm');
const elBtnResetPipeline = document.getElementById('btn-reset-pipeline');

const elAlertFeedList = document.getElementById('alert-feed-list');
const elResidentsTriageList = document.getElementById('residents-triage-list');
const elDispatchRoutesList = document.getElementById('dispatch-routes-list');

const elResidentSearchInput = document.getElementById('resident-search-input');
const elFilterUrgencySelect = document.getElementById('filter-urgency-select');
const elQuickFiltersContainer = document.getElementById('quick-filters-container');

const elExplanationModal = document.getElementById('explanation-modal');
const elModalTitle = document.getElementById('modal-title');
const elModalBodyContent = document.getElementById('modal-body-content');
const elBtnCloseModal = document.getElementById('btn-close-modal');

const elConsoleLogsStream = document.getElementById('console-logs-stream');
const elBtnClearConsole = document.getElementById('btn-clear-console');

// API Server Origin Check
const API_BASE = window.location.origin;

// Initialize Application
async function initApp() {
  setupEventListeners();
  
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    if (res.ok) {
      state.isUsingFallback = false;
      elSystemStatusIndicator.style.backgroundColor = 'var(--color-success)';
      addLog('[SYSTEM] Connected to local SilverSentinel API microservice.', 'system-msg');
    } else {
      throw new Error();
    }
  } catch (err) {
    state.isUsingFallback = true;
    elSystemStatusIndicator.style.backgroundColor = 'var(--color-yellow)';
    state.allResidents = getFallbackResidents();
    addLog('[SYSTEM] Local server offline. Loaded local sandbox database (45 older citizens).', 'system-msg');
  }

  await refreshData();
}

// Fetch or Compute state
async function refreshData() {
  if (state.isUsingFallback) {
    elValVulnerableCount.textContent = state.allResidents.length;
    elValActiveAlerts.textContent = state.activeAlerts.length;

    if (state.activeAlerts.length === 0) {
      state.triagedResidents = [];
      state.routes = [];
    } else {
      const matched = [];
      for (const alert of state.activeAlerts) {
        const affected = state.allResidents.filter(r => alert.affectedPostcodes.includes(r.postcode));
        for (const res of affected) {
          matched.push(calculateFallbackScore(res, alert));
        }
      }
      state.triagedResidents = matched.sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);
      state.routes = generateFallbackRoutes(state.triagedResidents);
    }
    
    elValTriagedCount.textContent = state.triagedResidents.length;
    renderAll();
  } else {
    try {
      const rStatus = await (await fetch(`${API_BASE}/api/status`)).json();
      elValVulnerableCount.textContent = rStatus.vulnerableResidentsCount;
      elValActiveAlerts.textContent = rStatus.activeAlertsCount;
      elValTriagedCount.textContent = rStatus.triagedCount;

      state.activeAlerts = await (await fetch(`${API_BASE}/api/alerts`)).json();
      state.triagedResidents = await (await fetch(`${API_BASE}/api/triage`)).json();
      state.routes = await (await fetch(`${API_BASE}/api/dispatch`)).json();
      
      renderAll();
    } catch (err) {
      console.error('Failed to sync with API server', err);
      state.isUsingFallback = true;
      elSystemStatusIndicator.style.backgroundColor = 'var(--color-yellow)';
      state.allResidents = getFallbackResidents();
      await refreshData();
    }
  }
}

// Trigger Weather simulation
async function triggerSimulation(hazardKey) {
  addLog(`[SYSTEM] Triggers Met Office alert simulation for: ${hazardKey.toUpperCase()}`, 'system-msg');
  
  if (state.isUsingFallback) {
    const alert = FALLBACK_ALERTS[hazardKey];
    if (alert) {
      if (!state.activeAlerts.some(a => a.id === alert.id)) {
        state.activeAlerts.push(alert);
      }
      simulateSubagentReasoning(alert);
      await refreshData();
    }
  } else {
    try {
      const res = await fetch(`${API_BASE}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hazardKey })
      });
      const data = await res.json();
      
      const allMockAlerts = FALLBACK_ALERTS;
      simulateSubagentReasoning(allMockAlerts[hazardKey]);
      await refreshData();
    } catch (err) {
      console.error('Simulation API failed', err);
    }
  }
}

// Reset System
async function resetSystem() {
  addLog('[SYSTEM] Purging active alerts and dispatch routing buffers...', 'system-msg');
  if (state.isUsingFallback) {
    state.activeAlerts = [];
    state.triagedResidents = [];
    state.routes = [];
    state.checkedTasks = {};
    await refreshData();
  } else {
    try {
      await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
      state.checkedTasks = {};
      await refreshData();
    } catch (err) {
      console.error('Reset API failed', err);
    }
  }
  
  // Clear glows and pins on map
  document.querySelectorAll('.zone-glow').forEach(el => el.style.opacity = 0);
  const pinG = document.getElementById('map-pins');
  if (pinG) pinG.innerHTML = '';
  addLog('[SYSTEM] All alerts cleared. System returned to standby.', 'system-msg');
}

// Stream simulated sub-agent reasoning logs to bottom panel console
function simulateSubagentReasoning(alert) {
  const affectedZone = alert.affectedPostcodes.join(', ');
  
  setTimeout(() => {
    addLog(`[INGESTION] Ingested Met Office alert ID: ${alert.id} (${alert.severity} ${alert.hazard})`, 'system-msg');
  }, 100);

  setTimeout(() => {
    addLog(`[SUB-AGENT] Spawning 'TriageMatcher' sub-agent in region sectors: ${affectedZone}`, 'agent-think');
  }, 500);

  setTimeout(() => {
    const matchedCount = state.triagedResidents.filter(r => r.alertId === alert.id).length;
    addLog(`[SUB-AGENT] TriageMatcher checked database profiles... Found ${matchedCount} vulnerable residents in warning zones.`, 'agent-think');
  }, 1000);

  setTimeout(() => {
    const criticals = state.triagedResidents.filter(r => r.alertId === alert.id && r.vulnerabilityScore >= 18);
    criticals.forEach(c => {
      addLog(`[ALERT] Matched CRITICAL resident: ${c.residentName} (${c.postcode}) - Priority Score: ${c.vulnerabilityScore}. Medical Device: ${c.medicalDeviceDependent}`, 'agent-critical');
    });
  }, 1600);

  setTimeout(() => {
    addLog(`[SUB-AGENT] Spawning 'RouteOptimizer' sub-agent to construct volunteer checklists...`, 'agent-think');
  }, 2200);

  setTimeout(() => {
    const route = state.routes.find(r => r.hazard === alert.hazard);
    if (route) {
      addLog(`[ROUTING] Route ${route.routeId} created for ${route.sector}. Sequenced ${route.totalVisits} visits. Nearest-neighbor path plotted from hub.`, 'agent-route');
    }
  }, 2800);
}

// Log writer helper
function addLog(text, className = '') {
  const line = document.createElement('div');
  line.className = `log-line ${className}`;
  line.textContent = `${new Date().toLocaleTimeString()} - ${text}`;
  elConsoleLogsStream.appendChild(line);
  elConsoleLogsStream.scrollTop = elConsoleLogsStream.scrollHeight;
}

// Event Listeners setup
function setupEventListeners() {
  elBtnSimFlood.addEventListener('click', () => triggerSimulation('flood'));
  elBtnSimFreeze.addEventListener('click', () => triggerSimulation('freeze'));
  elBtnSimStorm.addEventListener('click', () => triggerSimulation('storm'));
  elBtnResetPipeline.addEventListener('click', resetSystem);
  
  elResidentSearchInput.addEventListener('input', renderResidentsList);
  elFilterUrgencySelect.addEventListener('change', renderResidentsList);
  
  elBtnClearConsole.addEventListener('click', () => {
    elConsoleLogsStream.innerHTML = '';
  });

  // Quick Filter tags event delegation
  elQuickFiltersContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-tag')) {
      document.querySelectorAll('.filter-tag').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      state.quickFilter = e.target.getAttribute('data-filter');
      renderResidentsList();
      addLog(`[SYSTEM] Filter tags updated. Category selected: ${state.quickFilter}`, 'system-msg');
    }
  });
  
  elBtnCloseModal.addEventListener('click', closeModal);
  elExplanationModal.addEventListener('click', (e) => {
    if (e.target === elExplanationModal) closeModal();
  });
}

// --- RENDERING PIPELINES ---

function renderAll() {
  renderAlertsList();
  renderResidentsList();
  renderRoutesList();
  updateMapLayout();
}

function renderAlertsList() {
  if (state.activeAlerts.length === 0) {
    elAlertFeedList.innerHTML = `<div class="empty-state">No active weather alerts loaded. Select a simulation above to start.</div>`;
    return;
  }

  elAlertFeedList.innerHTML = state.activeAlerts.map(alert => `
    <div class="alert-item severity-${alert.severity}">
      <h4>${alert.severity === 'Red' ? '🚨' : alert.severity === 'Amber' ? '⚠️' : 'ℹ️'} ${alert.hazard}</h4>
      <p>${alert.description}</p>
      <div class="alert-item-meta">
        <span>Postcodes: ${alert.affectedPostcodes.join(', ')}</span>
        <span>Issued: ${new Date(alert.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  `).join('');
}

function renderResidentsList() {
  const searchQuery = elResidentSearchInput.value.trim().toLowerCase();
  const filterUrgency = elFilterUrgencySelect.value;
  
  let list = [...state.triagedResidents];

  // Apply Quick Filter Tag
  if (state.quickFilter === 'DEVICE') {
    list = list.filter(r => r.medicalDeviceDependent);
  } else if (state.quickFilter === 'MOBILITY') {
    list = list.filter(r => r.mobilityScore >= 4);
  } else if (state.quickFilter === 'ISOLATED') {
    list = list.filter(r => r.livesAlone);
  } else if (state.quickFilter === 'COPD') {
    list = list.filter(r => r.condition.includes('COPD'));
  }

  // Apply Search Query Filter
  if (searchQuery) {
    list = list.filter(r => 
      r.residentName.toLowerCase().includes(searchQuery) ||
      r.postcode.toLowerCase().includes(searchQuery) ||
      r.condition.toLowerCase().includes(searchQuery) ||
      r.area.toLowerCase().includes(searchQuery)
    );
  }

  // Apply Urgency Select Filter
  if (filterUrgency === 'CRITICAL') {
    list = list.filter(r => r.urgencyBand.includes('CRITICAL'));
  } else if (filterUrgency === 'HIGH') {
    list = list.filter(r => r.urgencyBand.includes('CRITICAL') || r.urgencyBand.includes('HIGH'));
  }

  if (list.length === 0) {
    elResidentsTriageList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>${state.triagedResidents.length === 0 ? 'No residents matched active alert areas.' : 'No residents match your search filters.'}</p>
      </div>
    `;
    return;
  }

  elResidentsTriageList.innerHTML = list.map(res => {
    const isCritical = res.urgencyBand.includes('CRITICAL');
    const isHigh = res.urgencyBand.includes('HIGH');
    const scoreColorClass = isCritical ? 'critical-score' : '';
    
    let badgeHtml = '';
    if (res.medicalDeviceDependent) badgeHtml += `<span class="card-badge card-badge-device">🔌 Device Dependent</span>`;
    if (res.mobilityScore >= 4) badgeHtml += `<span class="card-badge card-badge-mobility">♿ Mobility ${res.mobilityScore}/5</span>`;
    if (res.livesAlone) badgeHtml += `<span class="card-badge card-badge-isolated">🏠 Isolated</span>`;

    return `
      <div class="resident-card" id="card-${res.residentId}">
        <div class="resident-card-left">
          <div class="resident-name-row">
            <span class="resident-name">${res.residentName}</span>
            <span class="badge ${isCritical ? 'badge-primary' : isHigh ? 'badge-accent' : 'badge-outline'}" style="font-size: 9px; padding: 2px 6px;">
              ${isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : 'MEDIUM'}
            </span>
          </div>
          <div class="resident-details">
            Age: ${res.age} | Postcode: ${res.postcode} (${res.area}) | Phone: ${res.phone}
          </div>
          <div class="resident-details" style="font-style: italic; color: var(--text-primary);">
            Condition: ${res.condition}
          </div>
          <div class="resident-badges">
            ${badgeHtml}
          </div>
        </div>
        <div class="resident-card-right">
          <div class="vscore-display">
            <span class="vscore-val ${scoreColorClass}">${res.vulnerabilityScore}</span>
            <span class="vscore-lbl">Risk Score</span>
          </div>
          <button class="btn-explain" onclick="showExplanation('${res.residentId}')">Explain</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderRoutesList() {
  if (state.routes.length === 0) {
    elDispatchRoutesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📍</div>
        <p>No dispatch routes generated. Trigger an alert simulation above.</p>
      </div>
    `;
    return;
  }

  elDispatchRoutesList.innerHTML = state.routes.map(route => {
    const isExpanded = state.expandedRoutes[route.routeId] !== false;
    const bodyStyle = isExpanded ? '' : 'style="display: none;"';
    const chevron = isExpanded ? '▲' : '▼';

    // Calculate completion progress
    const totalCount = route.tasks.length;
    let completedCount = 0;
    route.tasks.forEach(t => {
      if (state.checkedTasks[`${route.routeId}-${t.residentId}`] === true) {
        completedCount++;
      }
    });
    const progressPercent = Math.round((completedCount / totalCount) * 100) || 0;

    const itemsHtml = route.tasks.map(task => {
      const isChecked = state.checkedTasks[`${route.routeId}-${task.residentId}`] === true;
      const completedClass = isChecked ? 'completed' : '';
      const checkedAttr = isChecked ? 'checked' : '';

      const actionsHtml = task.recommendedActions.map(act => {
        const isCritical = act.startsWith('CRITICAL:');
        const actionClass = isCritical ? 'critical-action' : '';
        return `<li class="${actionClass}">${act}</li>`;
      }).join('');

      return `
        <div class="checklist-item ${completedClass}" id="chk-item-${route.routeId}-${task.residentId}">
          <div class="checklist-main-row">
            <label class="chk-container">
              ${task.sequence}. ${task.name}
              <input type="checkbox" ${checkedAttr} onchange="toggleTaskCheckbox('${route.routeId}', '${task.residentId}', this)">
              <span class="checkmark"></span>
            </label>
            <span class="badge ${task.urgencyBand.includes('CRITICAL') ? 'badge-primary' : 'badge-accent'}" style="font-size: 8px; padding: 1px 4px;">
              ${task.urgencyBand.split(' ')[0]}
            </span>
          </div>
          
          <div class="checklist-item-details">
            <div class="chk-meta-info">
              <span>Postcode: ${task.postcode} | Phone: ${task.phone}</span>
              <span>Score: ${task.vulnerabilityScore}</span>
            </div>
            <div class="chk-recommended-actions">
              <h5>Response Protocols</h5>
              <ul>
                ${actionsHtml}
              </ul>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="route-card" id="route-${route.routeId}">
        <div class="route-header" onclick="toggleRouteCollapse('${route.routeId}')">
          <div class="route-title">
            <span class="route-name">Route: ${route.sector}</span>
            <span class="route-meta">${route.totalVisits} visits | Est. Duration: ${route.estimatedDurationMinutes} mins</span>
            
            <!-- Route Progress Bar UI -->
            <div class="route-progress-container">
              <div class="route-progress-track">
                <div class="route-progress-bar" id="pb-${route.routeId}" style="width: ${progressPercent}%;"></div>
              </div>
              <div class="route-progress-text" id="pt-${route.routeId}">${completedCount}/${totalCount} Visited (${progressPercent}%)</div>
            </div>
          </div>
          <div class="route-badges">
            <span class="badge-route-urgency badge-route-${route.severity}">${route.severity} ${route.hazard.split(' ')[0]}</span>
            <span style="font-size: 12px; color: var(--text-muted); margin-left: 8px;">${chevron}</span>
          </div>
        </div>
        <div class="route-body" id="route-body-${route.routeId}" ${bodyStyle}>
          <div class="route-summary-row">
            <span>Critical Visits: <strong>${route.criticalVisits}</strong></span>
            <span>High Priority: <strong>${route.highVisits}</strong></span>
          </div>
          <div class="route-checklist">
            ${itemsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Collapsible Route UI helper
window.toggleRouteCollapse = function(routeId) {
  const isCurrentlyExpanded = state.expandedRoutes[routeId] !== false;
  state.expandedRoutes[routeId] = !isCurrentlyExpanded;
  
  const body = document.getElementById(`route-body-${routeId}`);
  if (body) {
    if (isCurrentlyExpanded) {
      body.style.display = 'none';
    } else {
      body.style.display = 'flex';
    }
    renderRoutesList();
  }
};

// Checklist check-off event
window.toggleTaskCheckbox = function(routeId, residentId, checkbox) {
  const taskKey = `${routeId}-${residentId}`;
  state.checkedTasks[taskKey] = checkbox.checked;

  const item = document.getElementById(`chk-item-${taskKey}`);
  if (item) {
    if (checkbox.checked) {
      item.classList.add('completed');
    } else {
      item.classList.remove('completed');
    }
  }

  // Animate and update progress bar on route card
  const route = state.routes.find(r => r.routeId === routeId);
  if (route) {
    const totalCount = route.tasks.length;
    let completedCount = 0;
    route.tasks.forEach(t => {
      if (state.checkedTasks[`${route.routeId}-${t.residentId}`] === true) {
        completedCount++;
      }
    });
    const progressPercent = Math.round((completedCount / totalCount) * 100) || 0;

    const bar = document.getElementById(`pb-${routeId}`);
    const text = document.getElementById(`pt-${routeId}`);
    if (bar && text) {
      bar.style.width = `${progressPercent}%`;
      text.textContent = `${completedCount}/${totalCount} Visited (${progressPercent}%)`;
    }

    if (completedCount === totalCount) {
      addLog(`[SYSTEM] Route ${route.sector} completed! All vulnerable residents verified safe.`, 'agent-route');
    }
  }
};

// Update SVG Map pins and alert flashes
function updateMapLayout() {
  const pinG = document.getElementById('map-pins');
  if (!pinG) return;
  
  pinG.innerHTML = '';
  
  // Update Region hazard glows
  document.querySelectorAll('.zone-glow').forEach(el => el.style.opacity = 0);
  
  state.activeAlerts.forEach(alert => {
    let glowId = '';
    if (alert.hazard.toLowerCase().includes('flood')) glowId = 'glow-london';
    else if (alert.hazard.toLowerCase().includes('freeze')) glowId = 'glow-scotland';
    else if (alert.hazard.toLowerCase().includes('wind')) glowId = 'glow-west';
    
    const glowEl = document.getElementById(glowId);
    if (glowEl) {
      glowEl.style.opacity = 1;
    }
  });

  // Plot resident pins onto SVG coordinates
  state.triagedResidents.forEach(res => {
    const postcodeData = FALLBACK_POSTCODES[res.postcode];
    if (postcodeData) {
      const { x, y } = projectLatLngToSvg(postcodeData.lat, postcodeData.lon);
      
      const pin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pin.setAttribute('cx', x);
      pin.setAttribute('cy', y);
      pin.setAttribute('r', res.vulnerabilityScore >= 18 ? 5.5 : 4);
      pin.setAttribute('class', 'map-pin');
      
      // Color pin according to urgency score
      const pinColor = res.vulnerabilityScore >= 18 
        ? 'var(--color-red)' 
        : res.vulnerabilityScore >= 12 
          ? 'var(--color-amber)' 
          : 'var(--color-yellow)';
      pin.setAttribute('fill', pinColor);
      
      // Setup click feedback to scroll to resident card in Triage column
      pin.addEventListener('click', () => {
        const card = document.getElementById(`card-${res.residentId}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.borderColor = 'var(--color-primary)';
          card.style.transform = 'scale(1.02)';
          setTimeout(() => {
            card.style.borderColor = 'var(--border-color)';
            card.style.transform = 'none';
          }, 1500);
          addLog(`[MAP] Selected pin: ${res.residentName} (${res.postcode}). Centered triage detail view.`, 'system-msg');
        }
      });
      
      // Quick tooltip title
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${res.residentName} (${res.postcode})\nScore: ${res.vulnerabilityScore}\nCondition: ${res.condition}`;
      pin.appendChild(title);
      
      pinG.appendChild(pin);
    }
  });
}

// Modal score explain popup
window.showExplanation = function(residentId) {
  const resident = state.triagedResidents.find(r => r.residentId === residentId);
  if (!resident) return;

  elModalTitle.textContent = `Priority Matrix: ${resident.residentName}`;
  
  let explanationRows = resident.breakdown.map(b => {
    const isCritical = b.factor.includes('Device') || b.factor.includes('Level') && resident.severity === 'Red';
    return `
      <div class="explanation-row">
        <div class="explanation-factor">
          <span class="exp-name">${b.factor}</span>
          <span class="exp-desc">${b.detail}</span>
        </div>
        <span class="exp-pts ${isCritical ? 'critical' : ''}">+${b.points}</span>
      </div>
    `;
  }).join('');

  elModalBodyContent.innerHTML = `
    <div class="explanation-title-row">
      <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">
        Postcode District: <strong>${resident.postcode} (${resident.area})</strong>
      </p>
      <p style="font-size: 13px; color: var(--text-muted); line-height: 1.4;">
        A sub-agent ran a multi-attribute triage check matching local conditions with individual health attributes:
      </p>
    </div>
    <div class="explanation-rows-container">
      ${explanationRows}
    </div>
    <div class="total-score-row">
      <span class="total-score-lbl">Cumulative Risk Score</span>
      <span class="total-score-val">${resident.vulnerabilityScore}</span>
    </div>
    <div style="margin-top: 14px; text-align: center;">
      <span class="badge ${resident.urgencyBand.includes('CRITICAL') ? 'badge-primary' : resident.urgencyBand.includes('HIGH') ? 'badge-accent' : 'badge-outline'}">
        ${resident.urgencyBand}
      </span>
    </div>
  `;

  elExplanationModal.style.display = 'flex';
};

function closeModal() {
  elExplanationModal.style.display = 'none';
}

window.addEventListener('DOMContentLoaded', initApp);
