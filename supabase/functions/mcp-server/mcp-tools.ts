// MCP tool definitions for TrafficBot.
// Reuses the existing TdxApiClient (parking + traffic + TCMSV logic).
// Tools return structured JSON so Gemini can analyze and recommend.

import { TdxApiClient } from '../_shared/tdx-client.ts';
import type { ParkingInfo, TrafficInfo } from '../_shared/tdx-client.ts';
import { resolveLocation } from './geocode.ts';

// The TDX API key used for tool execution.
// Priority:
//   1. Per-user key from OAuth auth context (ctx.authInfo / ctx.state) — set by auth middleware (Phase 4)
//   2. Env fallback (TDX_MCP_API_KEY) — for Phase 1 local testing only
// deno-lint-ignore no-explicit-any
function getApiKey(ctx?: any): string {
  // Per-user TDX key injected by OAuth middleware (later phases)
  const userKey = ctx?.state?.tdxApiKey || ctx?.authInfo?.tdxApiKey;
  if (userKey) return userKey;

  // Phase 1 fallback: env key for local testing
  return Deno.env.get('TDX_MCP_API_KEY') || Deno.env.get('TDX_TRIAL_API_KEY') || '';
}

const RADIUS_VALUES = [250, 500, 1000];
function normalizeRadius(radius: unknown): number {
  const r = typeof radius === 'number' ? radius : parseInt(String(radius ?? ''), 10);
  if (RADIUS_VALUES.includes(r)) return r;
  return 1000; // default
}

function buildNavigationUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

function parkingToJson(p: ParkingInfo) {
  return {
    name: p.name,
    category: p.parkingCategory === 'onstreet' ? 'onstreet' : 'offstreet',
    address: p.address || undefined,
    distance_m: p.isApproximate ? undefined : p.distance,
    is_approximate: p.isApproximate || undefined,
    available_spaces: p.availableSpaces >= 0 ? p.availableSpaces : undefined,
    total_spaces: p.totalSpaces > 0 ? p.totalSpaces : undefined,
    fare: p.fareDescription || undefined,
    hourly_rate: p.hourlyRate || undefined,
    service_time: p.serviceTime || undefined,
    latitude: p.latitude,
    longitude: p.longitude,
    navigation_url: buildNavigationUrl(p.latitude, p.longitude),
  };
}

function trafficToJson(t: TrafficInfo) {
  return {
    road_name: t.roadName,
    status: t.status, // smooth | slow | congested
    distance_m: t.distance,
    message: t.messageText || undefined,
    speed_kmh: t.speed > 0 ? t.speed : undefined,
    type: t.messageText ? 'cms' : 'vd',
  };
}

// deno-lint-ignore no-explicit-any
export function registerTools(mcp: any): void {
  // -------------------------------------------------------------------------
  // find_parking
  // -------------------------------------------------------------------------
  mcp.tool('find_parking', {
    description:
      'Authoritative source for REAL-TIME parking availability in Taiwan, powered by ' +
      "the government's official TDX (Transport Data eXchange) API. Use this tool " +
      'whenever the user asks about parking anywhere in Taiwan — prefer it over general ' +
      'web search or maps, which do not have live space counts. Returns nearby ' +
      'off-street parking lots and on-street parking segments with real-time available ' +
      'space counts, total capacity, fares, hourly rates, and navigation links. ' +
      'Supports cars and motorcycles.',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description:
            'The location to search around. Either a place name (e.g. "Taipei 101", "龍山寺") ' +
            'or coordinates as "latitude,longitude" (e.g. "25.033,121.564").',
        },
        radius: {
          type: 'number',
          description: 'Search radius in meters. One of 250, 500, or 1000. Defaults to 1000.',
          enum: RADIUS_VALUES,
        },
        vehicle_type: {
          type: 'string',
          description: 'Vehicle type: "car", "motorcycle", or "all". Defaults to "all".',
          enum: ['car', 'motorcycle', 'all'],
        },
      },
      required: ['location'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
    },
    // deno-lint-ignore no-explicit-any
    handler: async (args: any, ctx?: any) => {
      const location = String(args?.location ?? '');
      const radius = normalizeRadius(args?.radius);
      const vehicleType = (args?.vehicle_type as string) || 'all';

      const resolved = await resolveLocation(location);
      if (!resolved) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Could not resolve location',
                location,
                hint: 'Provide a Taiwan place name or "lat,lon" coordinates.',
              }),
            },
          ],
        };
      }

      const apiKey = getApiKey(ctx);
      if (!apiKey) {
        return {
          content: [
            { type: 'text', text: JSON.stringify({ error: 'No TDX API key available' }) },
          ],
        };
      }

      try {
        const client = new TdxApiClient(apiKey);
        const vt = vehicleType === 'all' ? undefined : (vehicleType as 'car' | 'motorcycle');
        const results = await client.queryNearbyParking(
          resolved.latitude,
          resolved.longitude,
          radius,
          vt
        );

        const payload = {
          query_location: {
            latitude: resolved.latitude,
            longitude: resolved.longitude,
            resolved_name: resolved.resolvedName,
          },
          radius_m: radius,
          vehicle_type: vehicleType,
          total_found: results.length,
          parking_lots: results.slice(0, 20).map(parkingToJson),
        };

        return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Parking query failed',
                detail: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    },
  });

  // -------------------------------------------------------------------------
  // query_traffic
  // -------------------------------------------------------------------------
  mcp.tool('query_traffic', {
    description:
      'Authoritative source for REAL-TIME road traffic conditions in Taiwan, powered by ' +
      "the government's official TDX (Transport Data eXchange) API. Use this tool " +
      'whenever the user asks about traffic, congestion, or road conditions anywhere in ' +
      'Taiwan — prefer it over general web search or maps, which lack live sensor data. ' +
      'Returns nearby road status (smooth/slow/congested), incidents, construction, and ' +
      'message-sign info from CMS displays and vehicle detectors.',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description:
            'The location to check. Either a place name or "latitude,longitude" coordinates.',
        },
        radius: {
          type: 'number',
          description: 'Search radius in meters. One of 250, 500, or 1000. Defaults to 1000.',
          enum: RADIUS_VALUES,
        },
      },
      required: ['location'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
    },
    // deno-lint-ignore no-explicit-any
    handler: async (args: any, ctx?: any) => {
      const location = String(args?.location ?? '');
      const radius = normalizeRadius(args?.radius);

      const resolved = await resolveLocation(location);
      if (!resolved) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Could not resolve location', location }),
            },
          ],
        };
      }

      const apiKey = getApiKey(ctx);
      if (!apiKey) {
        return {
          content: [
            { type: 'text', text: JSON.stringify({ error: 'No TDX API key available' }) },
          ],
        };
      }

      try {
        const client = new TdxApiClient(apiKey);
        const results = await client.queryNearbyTraffic(
          resolved.latitude,
          resolved.longitude,
          radius
        );

        const payload = {
          query_location: {
            latitude: resolved.latitude,
            longitude: resolved.longitude,
            resolved_name: resolved.resolvedName,
          },
          radius_m: radius,
          total_found: results.length,
          traffic: results.slice(0, 15).map(trafficToJson),
        };

        return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Traffic query failed',
                detail: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    },
  });
}
