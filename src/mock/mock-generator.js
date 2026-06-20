/**
 * SilverSentinel Mock Data Generator
 * Generates simulated UK Postcodes, Met Office severe weather alerts, 
 * and a vulnerable resident database for disaster response testing.
 */

// A curated list of UK postcodes representing different regions
const MOCK_POSTCODES = {
  // London / South
  'SW1A 1AA': { area: 'Westminster', lat: 51.501, lon: -0.141 },
  'SW1V 2BP': { area: 'Pimlico', lat: 51.491, lon: -0.138 },
  'SE1 9SG': { area: 'Southwark', lat: 51.503, lon: -0.096 },
  'E1 6AN': { area: 'Spitalfields', lat: 51.520, lon: -0.076 },
  'WC2N 5DN': { area: 'Charing Cross', lat: 51.508, lon: -0.127 },
  
  // North / Manchester / Liverpool
  'M1 1AE': { area: 'Manchester Piccadilly', lat: 53.480, lon: -2.230 },
  'M15 4FN': { area: 'Hulme', lat: 53.468, lon: -2.247 },
  'L1 0AB': { area: 'Liverpool Centre', lat: 53.401, lon: -2.983 },
  'L3 4FP': { area: 'Albert Dock', lat: 53.398, lon: -2.992 },
  
  // Scotland / Edinburgh / Glasgow
  'EH1 1YT': { area: 'Edinburgh Royal Mile', lat: 55.950, lon: -3.189 },
  'EH3 9QQ': { area: 'Tollcross', lat: 55.943, lon: -3.205 },
  'G1 1QX': { area: 'Glasgow George Square', lat: 55.862, lon: -4.249 },
  
  // Wales / Cardiff
  'CF10 1EP': { area: 'Cardiff City Centre', lat: 51.481, lon: -3.178 },
  'CF11 9HB': { area: 'Canton', lat: 51.478, lon: -3.201 },
  
  // Northern Ireland / Belfast
  'BT1 5GS': { area: 'Belfast City Hall', lat: 54.597, lon: -5.930 }
};

// Seeded random number generator for reproducibility
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate a mock database of vulnerable residents
function generateVulnerableResidents(count = 50, seed = 42) {
  const firstNames = [
    'Arthur', 'Beatrice', 'Charles', 'Dorothy', 'Edward', 'Florence', 'George', 'Gwendolyn',
    'Harold', 'Irene', 'James', 'Kathleen', 'Leonard', 'Margaret', 'Norman', 'Patricia',
    'Ronald', 'Sybil', 'Thomas', 'Winfred', 'Albert', 'Evelyn', 'Stanley', 'Mildred', 'Walter'
  ];
  const lastNames = [
    'Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies',
    'Robinson', 'Wright', 'Thompson', 'Evans', 'Walker', 'White', 'Roberts', 'Green',
    'Hall', 'Wood', 'Jackson', 'Clarke', 'Hughes', 'Edwards', 'Lewis', 'Harrison', 'Turner'
  ];
  
  const postcodes = Object.keys(MOCK_POSTCODES);
  const residents = [];
  
  for (let i = 0; i < count; i++) {
    const fIdx = Math.floor(seededRandom(seed + i * 3) * firstNames.length);
    const lIdx = Math.floor(seededRandom(seed + i * 7 + 1) * lastNames.length);
    const name = `${firstNames[fIdx]} ${lastNames[lIdx]}`;
    
    // Vulnerable age group: 65 - 98
    const age = Math.floor(65 + seededRandom(seed + i * 11 + 2) * 33);
    
    // Mobility score: 1 (fully mobile) to 5 (bedridden / wheelchair dependent)
    const mobilityScore = Math.floor(1 + seededRandom(seed + i * 13 + 3) * 5);
    
    // Medical device dependency: e.g., oxygen concentrator, dialysis, ventilators (approx 15% rate)
    const medicalDeviceDependent = seededRandom(seed + i * 17 + 4) < 0.18;
    
    // Medical conditions
    const conditionsList = ['Chronic COPD', 'Advanced Dementia', 'Arthritis', 'Cardiovascular Disease', 'Type 1 Diabetes', 'Parkinsons'];
    const hasCondition = seededRandom(seed + i * 19 + 5) < 0.7;
    const condition = hasCondition 
      ? conditionsList[Math.floor(seededRandom(seed + i * 23) * conditionsList.length)] 
      : 'None';
      
    // Lives alone
    const livesAlone = seededRandom(seed + i * 29) < 0.65;
    
    // Postcode assignment
    const postcode = postcodes[Math.floor(seededRandom(seed + i * 31 + 6) * postcodes.length)];
    
    residents.push({
      id: `RES-${1000 + i}`,
      name,
      age,
      postcode,
      area: MOCK_POSTCODES[postcode].area,
      mobilityScore,
      medicalDeviceDependent,
      condition,
      livesAlone,
      phone: `07700 900${Math.floor(100 + seededRandom(seed + i * 37) * 900)}`
    });
  }
  
  return residents;
}

// Generate active Met Office weather alerts
function generateMetOfficeAlerts() {
  return [
    {
      id: 'MET-AL-001',
      hazard: 'Deep Freeze & Black Ice',
      severity: 'Amber', // Yellow, Amber, Red
      description: 'Temperatures projected to fall below -6°C overnight with extensive black ice accumulation.',
      affectedPostcodes: ['EH1 1YT', 'EH3 9QQ', 'G1 1QX'],
      issuedAt: new Date().toISOString()
    },
    {
      id: 'MET-AL-002',
      hazard: 'Severe Flash Flooding',
      severity: 'Red',
      description: 'Rapidly rising river levels. Threat to life. Property flooding expected.',
      affectedPostcodes: ['SW1A 1AA', 'SW1V 2BP', 'SE1 9SG'],
      issuedAt: new Date().toISOString()
    },
    {
      id: 'MET-AL-003',
      hazard: 'Gale Force Winds & Storm Surge',
      severity: 'Yellow',
      description: 'Winds up to 65mph expected. High risk of power grid disruption.',
      affectedPostcodes: ['L1 0AB', 'L3 4FP', 'CF11 9HB'],
      issuedAt: new Date().toISOString()
    }
  ];
}

module.exports = {
  MOCK_POSTCODES,
  generateVulnerableResidents,
  generateMetOfficeAlerts
};
