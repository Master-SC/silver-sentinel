/**
 * Geographical utilities for SilverSentinel
 * Computes distances between coordinates using the Haversine formula.
 */

const { MOCK_POSTCODES } = require('../mock/mock-generator');

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula. Returns distance in kilometers.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Gets distance between two postcodes in kilometers.
 * Falls back to a default distance if postcode is not found.
 */
function getDistanceBetweenPostcodes(pc1, pc2) {
  const pos1 = MOCK_POSTCODES[pc1];
  const pos2 = MOCK_POSTCODES[pc2];
  
  if (!pos1 || !pos2) {
    return 10.0; // Default fallback distance in km
  }
  
  return haversineDistance(pos1.lat, pos1.lon, pos2.lat, pos2.lon);
}

module.exports = {
  haversineDistance,
  getDistanceBetweenPostcodes
};
