/**
 * SilverSentinel Local Execution Harness & Server
 * 
 * Command options:
 *   node run-sentinel.js           - Runs a console-based simulation report
 *   node run-sentinel.js --test    - Runs automated unit assertions on triage & geo logic
 *   node run-sentinel.js --serve   - Launches the local HTTP dashboard server on port 3000
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Imports
const { generateVulnerableResidents, generateMetOfficeAlerts, MOCK_POSTCODES } = require('./src/mock/mock-generator');
const { runTriagePipeline } = require('./src/core/triage');
const { generateDispatchRoutes } = require('./src/core/dispatch');
const { getDistanceBetweenPostcodes } = require('./src/utils/geo');

// Global Database State for the Live Server
let activeAlerts = [];
let vulnerableResidents = generateVulnerableResidents(50);
let triagedResidents = [];
let dispatchRoutes = [];

// Command Route Handlers
const args = process.argv.slice(2);

if (args.includes('--test')) {
  runUnitTests();
} else if (args.includes('--serve')) {
  startHttpServer();
} else {
  runConsoleSimulation();
}

/**
 * ----------------------------------------------------
 * 1. CLI CONSOLE SIMULATION MODE
 * ----------------------------------------------------
 */
function runConsoleSimulation() {
  console.log('================================================================');
  console.log('🛡️  SILVERSENTINEL - WEATHER EMERGENCY DISPATCH SIMULATION 🛡️');
  console.log('================================================================\n');

  console.log(`[Phase 1] Intake: Generating mock resident database...`);
  console.log(`Loaded ${vulnerableResidents.length} vulnerable resident profiles.`);
  
  console.log(`[Phase 1] Intake: Fetching Met Office weather alerts...`);
  const alerts = generateMetOfficeAlerts();
  console.log(`Active alerts ingested: ${alerts.length}`);
  alerts.forEach(a => console.log(`  - [${a.severity}] ${a.hazard} affecting ${a.affectedPostcodes.join(', ')}`));

  console.log(`\n[Phase 2] Triage & Matching: Running sub-agent risk matrices...`);
  const triaged = runTriagePipeline(vulnerableResidents, alerts);
  console.log(`Matched ${triaged.length} residents inside hazard sectors.`);

  console.log('\n--- Risk Priority Table (Top 10) ---');
  console.table(triaged.slice(0, 10).map(r => ({
    ID: r.residentId,
    Name: r.residentName,
    Age: r.age,
    Postcode: r.postcode,
    Urgency: r.urgencyBand.split(' ')[0],
    Score: r.vulnerabilityScore,
    Condition: r.condition,
    Device: r.medicalDeviceDependent ? 'YES' : 'NO'
  })));

  console.log(`\n[Phase 3] Dispatch & Routing: Spawning route optimizations...`);
  const routes = generateDispatchRoutes(triaged);
  console.log(`Generated ${routes.length} regional rescue/visit routes.\n`);

  routes.forEach(route => {
    console.log(`----------------------------------------------------------------`);
    console.log(`📍 Route: ${route.sector} | Status: ${route.severity} ${route.hazard}`);
    console.log(`   Visits: ${route.totalVisits} (Critical: ${route.criticalVisits}, High: ${route.highVisits}) | Est. Duration: ${route.estimatedDurationMinutes} mins`);
    console.log(`----------------------------------------------------------------`);
    route.tasks.forEach(task => {
      console.log(`  ${task.sequence}. [${task.urgencyBand.split(' ')[0]}] ${task.name} (${task.postcode}) - Phone: ${task.phone}`);
      console.log(`     Medical: ${task.conditions} | Device Dependency: ${task.deviceDependent ? 'YES' : 'NO'}`);
      console.log(`     Protocols:`);
      task.recommendedActions.forEach(act => console.log(`       - ${act}`));
    });
    console.log('');
  });

  // Save report to disk
  const reportPath = path.join(__dirname, 'triage-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ triaged, routes }, null, 2));
  console.log(`✔️ Report saved successfully to: ${reportPath}`);
  console.log('\nTo launch the interactive dashboard, run: node run-sentinel.js --serve');
}

/**
 * ----------------------------------------------------
 * 2. TEST SUITE MODE
 * ----------------------------------------------------
 */
function runUnitTests() {
  console.log('🤖 Running SilverSentinel System Assertions...');
  let failures = 0;

  function assert(assertion, name) {
    if (assertion) {
      console.log(`  ✅ PASS: ${name}`);
    } else {
      console.log(`  ❌ FAIL: ${name}`);
      failures++;
    }
  }

  // Test 1: Mock Generator
  const resList = generateVulnerableResidents(10);
  assert(resList.length === 10, 'Generator produces correct number of residents');
  assert(resList[0].id.startsWith('RES-'), 'Residents have correct ID prefix');

  // Test 2: Geo routing distances
  const distSame = getDistanceBetweenPostcodes('SW1A 1AA', 'SW1A 1AA');
  const distDiff = getDistanceBetweenPostcodes('SW1A 1AA', 'EH1 1YT'); // London to Edinburgh
  assert(distSame === 0, 'Distance between identical postcodes is 0');
  assert(distDiff > 400, 'Distance between London and Edinburgh is > 400km');

  // Test 3: Triage Scoring Algorithm
  // Create dummy resident
  const dummyRes = {
    id: 'RES-TEST-01',
    name: 'Test Elder',
    age: 85, // Age factor: (85-65)*0.4 = 8.0 points
    postcode: 'SW1A 1AA',
    mobilityScore: 4, // Mobility factor: 4 * 1.5 = 6.0 points
    medicalDeviceDependent: true, // Device factor = 6.0 points
    condition: 'Chronic COPD', // Condition factor = 2.0 points
    livesAlone: true, // Isolation factor = 2.0 points
    phone: '07700 900123'
  };

  const dummyAlert = {
    id: 'MET-ALERT-TEST',
    hazard: 'Deep Freeze & Black Ice',
    severity: 'Red', // Severity score = 5.0 points
    affectedPostcodes: ['SW1A 1AA'],
    issuedAt: new Date().toISOString()
  };

  // Plus Hazard-Condition Symbiosis (Deep Freeze + COPD) = 3.0 points
  // Total expected = 8.0 + 6.0 + 6.0 + 2.0 + 2.0 + 5.0 + 3.0 = 32.0 points
  
  const triaged = runTriagePipeline([dummyRes], [dummyAlert]);
  assert(triaged.length === 1, 'Triage matching identifies affected postcode');
  assert(triaged[0].vulnerabilityScore === 32.0, `Vulnerability score calculated correctly (Expected 32.0, got ${triaged[0].vulnerabilityScore})`);
  assert(triaged[0].urgencyBand.startsWith('CRITICAL'), 'Correct urgency band assigned');

  // Test 4: Dispatch checklist routing
  const routes = generateDispatchRoutes(triaged);
  assert(routes.length === 1, 'Generates correct route count');
  assert(routes[0].tasks[0].residentId === 'RES-TEST-01', 'Route task links to correct resident ID');
  assert(routes[0].tasks[0].recommendedActions.some(a => a.includes('battery backup')), 'High-risk device actions added to protocols');

  if (failures === 0) {
    console.log('\n🌟 ALL SYSTEM ASSERTIONS PASSED SUCCESSFULLY.');
    process.exit(0);
  } else {
    console.error(`\n❌ TEST SUITE FAILED with ${failures} errors.`);
    process.exit(1);
  }
}

/**
 * ----------------------------------------------------
 * 3. LOCAL HTTP DASHBOARD SERVER
 * ----------------------------------------------------
 */
function startHttpServer() {
  const PORT = 3000;
  
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    let pathname = parsedUrl.pathname;
    
    // API endpoints
    if (pathname === '/api/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        activeAlertsCount: activeAlerts.length,
        vulnerableResidentsCount: vulnerableResidents.length,
        triagedCount: triagedResidents.length
      }));
      return;
    }
    
    if (pathname === '/api/alerts' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(activeAlerts));
      return;
    }

    if (pathname === '/api/residents' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(vulnerableResidents));
      return;
    }

    if (pathname === '/api/triage' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(triagedResidents));
      return;
    }

    if (pathname === '/api/dispatch' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(dispatchRoutes));
      return;
    }

    if (pathname === '/api/simulate' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { hazardKey } = JSON.parse(body);
          const allMockAlerts = generateMetOfficeAlerts();
          
          let alertToSimulate;
          if (hazardKey === 'flood') alertToSimulate = allMockAlerts.find(a => a.hazard.includes('Flood'));
          else if (hazardKey === 'freeze') alertToSimulate = allMockAlerts.find(a => a.hazard.includes('Freeze'));
          else if (hazardKey === 'storm') alertToSimulate = allMockAlerts.find(a => a.hazard.includes('Wind'));
          
          if (alertToSimulate) {
            // Add alert if not already active
            if (!activeAlerts.some(a => a.id === alertToSimulate.id)) {
              activeAlerts.push(alertToSimulate);
            }
            // Recalculate pipeline
            triagedResidents = runTriagePipeline(vulnerableResidents, activeAlerts);
            dispatchRoutes = generateDispatchRoutes(triagedResidents);
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
      });
      return;
    }

    if (pathname === '/api/reset' && req.method === 'POST') {
      activeAlerts = [];
      triagedResidents = [];
      dispatchRoutes = [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Static files serving
    if (pathname === '/') pathname = '/index.html';
    
    const filePath = path.join(__dirname, 'public', pathname);
    
    // Safety check - prevent directory traversal outside public
    const relativePath = path.relative(path.join(__dirname, 'public'), filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      // Read file and serve
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('500 Internal Server Error');
          return;
        }

        const ext = path.extname(filePath);
        let contentType = 'text/plain';
        if (ext === '.html') contentType = 'text/html';
        else if (ext === '.css') contentType = 'text/css';
        else if (ext === '.js') contentType = 'application/javascript';
        else if (ext === '.json') contentType = 'application/json';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });
  });

  server.listen(PORT, () => {
    console.log('================================================================');
    console.log(`🚀 SILVERSENTINEL EMERGENCY DASHBOARD RUNNING ON PORT ${PORT} 🚀`);
    console.log(`👉 Access dashboard at: http://localhost:${PORT}`);
    console.log('================================================================');
    console.log('Press Ctrl+C to terminate this server.');
  });
}
