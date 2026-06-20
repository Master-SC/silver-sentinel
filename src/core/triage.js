/**
 * SilverSentinel Triage Algorithm
 * Cross-references vulnerable residents with active weather alerts,
 * computes a Vulnerability Priority Score, and provides explanation logs.
 */

/**
 * Maps Met Office alert severity to triage impact scores
 */
const SEVERITY_SCORES = {
  'Red': 5.0,
  'Amber': 3.0,
  'Yellow': 1.5
};

/**
 * Computes a vulnerability priority score for a single resident given an active alert.
 */
function calculateResidentPriority(resident, alert) {
  let score = 0.0;
  const breakdown = [];

  // Age component (Risk scales significantly after 65)
  if (resident.age > 65) {
    const ageFactor = (resident.age - 65) * 0.4;
    score += ageFactor;
    breakdown.push({ factor: 'Age Vulnerability', points: parseFloat(ageFactor.toFixed(1)), detail: `Age ${resident.age} (>65)` });
  }

  // Mobility component (Score 1 to 5)
  const mobilityFactor = resident.mobilityScore * 1.5;
  score += mobilityFactor;
  breakdown.push({ factor: 'Low Mobility', points: mobilityFactor, detail: `Mobility Index ${resident.mobilityScore}/5` });

  // Medical Device Dependency (Critical life safety issue)
  if (resident.medicalDeviceDependent) {
    const deviceFactor = 6.0;
    score += deviceFactor;
    breakdown.push({ factor: 'Medical Device Dependent', points: deviceFactor, detail: 'Requires active power/equipment' });
  }

  // Live Alone Isolation
  if (resident.livesAlone) {
    const isolationFactor = 2.0;
    score += isolationFactor;
    breakdown.push({ factor: 'Living Isolated', points: isolationFactor, detail: 'Lives alone, no local household support' });
  }

  // Pre-existing Medical Conditions
  if (resident.condition && resident.condition !== 'None') {
    const conditionFactor = 2.0;
    score += conditionFactor;
    breakdown.push({ factor: 'Medical Condition', points: conditionFactor, detail: resident.condition });
  }

  // Alert Severity factor
  const alertSeverityFactor = SEVERITY_SCORES[alert.severity] || 1.0;
  score += alertSeverityFactor;
  breakdown.push({ factor: 'Weather Alert Level', points: alertSeverityFactor, detail: `${alert.severity} ${alert.hazard}` });

  // Synergistic Risk Modifiers:
  // 1. Deep Freeze is hazardous for chronic respiratory conditions (COPD) or very advanced age
  if (alert.hazard.toLowerCase().includes('freeze') && resident.condition.includes('COPD')) {
    const freezeCopdFactor = 3.0;
    score += freezeCopdFactor;
    breakdown.push({ factor: 'Hazard-Condition Symbiosis', points: freezeCopdFactor, detail: 'Cold weather risk to COPD condition' });
  }

  // 2. Flooding is extremely dangerous for individuals with severe mobility issues (mobility score >= 4)
  if (alert.hazard.toLowerCase().includes('flood') && resident.mobilityScore >= 4) {
    const floodMobilityFactor = 3.5;
    score += floodMobilityFactor;
    breakdown.push({ factor: 'Hazard-Mobility Symbiosis', points: floodMobilityFactor, detail: 'Flood hazard risk to low mobility resident' });
  }

  // Round final score to 2 decimal places
  const finalScore = parseFloat(score.toFixed(2));

  // Determine urgency band
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

/**
 * Core triage pipeline. Matches residents with relevant alerts and prioritizes them.
 */
function runTriagePipeline(residents, alerts) {
  const triagedList = [];

  for (const alert of alerts) {
    // Find residents who live in postcodes targeted by this alert
    const affectedResidents = residents.filter(r => alert.affectedPostcodes.includes(r.postcode));
    
    for (const resident of affectedResidents) {
      const evaluation = calculateResidentPriority(resident, alert);
      triagedList.push(evaluation);
    }
  }

  // Sort by vulnerability score descending, then by age descending
  return triagedList.sort((a, b) => {
    if (b.vulnerabilityScore !== a.vulnerabilityScore) {
      return b.vulnerabilityScore - a.vulnerabilityScore;
    }
    return b.age - a.age;
  });
}

module.exports = {
  calculateResidentPriority,
  runTriagePipeline
};
