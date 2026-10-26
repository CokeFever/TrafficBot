// Location resolution for MCP tools.
// Accepts either "lat,lon" coordinates or a place name (geocoded via Google / Nominatim).

import { searchPoi } from '../_shared/geocoding.ts';

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  resolvedName: string;
}

/**
 * Resolve a location string into coordinates.
 * - "25.033,121.564" → parsed directly
 * - "Taipei 101" / "台北101" → geocoded via Nominatim (restricted to Taiwan)
 */
export async function resolveLocation(location: string): Promise<ResolvedLocation | null> {
  const trimmed = location.trim();

  // Case 1: direct "lat,lon" coordinates
  const coordMatch = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    // Basic sanity check for Taiwan bounds
    if (lat >= 21 && lat <= 27 && lon >= 118 && lon <= 122.5) {
      return { latitude: lat, longitude: lon, resolvedName: `${lat},${lon}` };
    }
  }

  // Case 2: place name → Google Maps / Nominatim geocoding (Taiwan only)
  try {
    const poiResult = await searchPoi(trimmed);
    if (poiResult) {
      return {
        latitude: poiResult.latitude,
        longitude: poiResult.longitude,
        resolvedName: poiResult.displayName || trimmed,
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
