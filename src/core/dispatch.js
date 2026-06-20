/**
 * SilverSentinel Dispatch & Routing Engine
 * Groups triaged residents by geographic sector and constructs optimized
 * step-by-step checklists and routes for crisis response volunteers.
 */

const { getDistanceBetweenPostcodes } = require('../utils/geo');

/**
 * Maps hazards to specific volunteer action recommendations
 */
const HAZARD_ACTIONS = {
  'Deep Freeze': [
    'Deliver high-thermal emergency blanket and emergency heater.',
    'Verify main indoor heating is active; if failed, report immediately.',
    'Ensure warm fluids and shelf-stable food are accessible.',
    'Check medical equipment backup battery charge.'
  ],
  'Flash Flooding': [
    'Assess immediate flood water level at property entry.',
    'If water is near threshold, prepare for evacuation to local hub.',
    'Relocate critical medical devices and medication to upper floors.',
    'Check drinking water access and shut off main power if flooded.'
  ],
  'Gale Force Winds': [
    'Secure loose outdoor items that could impact windows.',
    'Check backup lighting (torches) and radio status.',
    'Confirm power status and emergency contact numbers.',
    'Assess roof/window damage if safe to do so.'
  ]
};

/**
 * Gets action checklist items matching the hazard type
 */
function getActionsForHazard(hazard, resident) {
  let recommendations = [];
  
  // Find key hazard matches
  const hazardLower = hazard.toLowerCase();
  if (hazardLower.includes('freeze') || hazardLower.includes('ice') || hazardLower.includes('cold')) {
    recommendations = [...HAZARD_ACTIONS['Deep Freeze']];
  } else if (hazardLower.includes('flood') || hazardLower.includes('rain')) {
    recommendations = [...HAZARD_ACTIONS['Flash Flooding']];
  } else if (hazardLower.includes('wind') || hazardLower.includes('storm')) {
    recommendations = [...HAZARD_ACTIONS['Gale Force Winds']];
  } else {
    recommendations = ['Conduct wellness check and report status to dashboard.'];
  }

  // Add resident-specific flags
  if (resident.medicalDeviceDependent) {
    recommendations.unshift('CRITICAL: Verify and test auxiliary battery backup for medical equipment.');
  }
  if (resident.mobilityScore >= 4) {
    recommendations.push('Verify evacuation exit path is completely clear of obstacles.');
  }

  return recommendations;
}

/**
 * Groups triaged residents by geographical area/postcode prefix
 * and generates optimized routing instructions.
 */
function generateDispatchRoutes(triagedResidents) {
  if (!triagedResidents || triagedResidents.length === 0) {
    return [];
  }

  // Group by sector area (e.g., Westminster, Edinburgh Royal Mile, etc.)
  const sectors = {};
  
  for (const resident of triagedResidents) {
    const key = resident.area || 'Unknown Sector';
    if (!sectors[key]) {
      sectors[key] = [];
    }
    sectors[key].push(resident);
  }

  const dispatchRoutes = [];
  let routeCounter = 1;

  for (const [sectorName, residentsInSector] of Object.entries(sectors)) {
    // Determine the "hub" (use the postcode of the resident with the highest priority score in this sector)
    const sortedResidents = [...residentsInSector].sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);
    const primaryHubPostcode = sortedResidents[0].postcode;
    const hazardType = sortedResidents[0].hazard;

    // Nearest Neighbor Routing Optimization
    // Start from hub postcode, find nearest, visit, make that the new reference, and repeat.
    // Ensure critical residents remain highly prioritized.
    const unvisited = [...sortedResidents];
    const optimizedRoute = [];
    let currentPostcode = primaryHubPostcode;

    while (unvisited.length > 0) {
      let nearestIdx = -1;
      let minDistance = Infinity;

      // Prioritize CRITICAL/HIGH urgency bands first, then closest distance
      for (let i = 0; i < unvisited.length; i++) {
        const candidate = unvisited[i];
        const dist = getDistanceBetweenPostcodes(currentPostcode, candidate.postcode);
        
        // Custom weight: penalize distance, prioritize vulnerability score
        // scoreWeight subtracts distance to make higher vulnerability more attractive
        const scoreWeight = candidate.vulnerabilityScore * 2; 
        const priorityScore = scoreWeight - dist;

        // We want to maximize priorityScore, which means we minimize -priorityScore
        const costMetric = -priorityScore;

        if (costMetric < minDistance) {
          minDistance = costMetric;
          nearestIdx = i;
        }
      }

      if (nearestIdx !== -1) {
        const nextResident = unvisited.splice(nearestIdx, 1)[0];
        optimizedRoute.push(nextResident);
        currentPostcode = nextResident.postcode;
      } else {
        break;
      }
    }

    // Build the final volunteer dispatch checklist for this sector
    const checklistTasks = optimizedRoute.map((res, index) => {
      return {
        sequence: index + 1,
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
        recommendedActions: getActionsForHazard(hazardType, res)
      };
    });

    const criticalCount = checklistTasks.filter(t => t.urgencyBand.includes('CRITICAL')).length;
    const highCount = checklistTasks.filter(t => t.urgencyBand.includes('HIGH')).length;

    dispatchRoutes.push({
      routeId: `ROUTE-SEC-${String(routeCounter++).padStart(3, '0')}`,
      sector: sectorName,
      hazard: hazardType,
      severity: sortedResidents[0].severity,
      totalVisits: checklistTasks.length,
      criticalVisits: criticalCount,
      highVisits: highCount,
      estimatedDurationMinutes: checklistTasks.length * 25 + 15, // 25m visit + 15m routing buffer
      tasks: checklistTasks
    });
  }

  return dispatchRoutes;
}

module.exports = {
  generateDispatchRoutes,
  getActionsForHazard
};
