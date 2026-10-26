---
name: tdx-traffic-parking
description: Query and troubleshoot TDX parking and traffic APIs, test API quotas, handle trial mode, and reference parking/traffic specifications.
---

# TDX Traffic & Parking Skill

This skill contains guidelines and reference specifications for TDX (Transport Data eXchange) parking and traffic query features originally specified in Kiro (`.kiro/specs/`).

## Specifications Reference

- **Parking Queries**:
  - Distance radiuses supported: `500m`, `1km`, `2km`.
  - Vehicle types: Car, Motorcycle.
  - TDX endpoints used:
    - `/v2/Parking/OffStreet/ParkingAvailability/NearBy`
    - `/v2/Parking/OffStreet/CarParkSpec/NearBy`
  - Quota & Trial Mode:
    - Users without TDX API key fall back to `DEFAULT_TRIAL_KEY` (`TDX_TRIAL_API_KEY` secret).
    - Trial mode daily limit is 5 queries per user (tracked in `trial_usage` table).
- **Traffic Queries**:
  - Live traffic status by coordinate radius.
  - TDX endpoints used:
    - `/v2/Road/Traffic/Live/VD/NearBy`
    - Congestion level determination (Green, Yellow, Red).

## Implementation Architecture

- Production logic runs in `supabase/functions/` (Deno Edge Functions).
- Core handler: `supabase/functions/_shared/core-handler.ts`.
- TDX client: `supabase/functions/_shared/tdx-client.ts`.
- Note: `src/` contains legacy Node.js/Telegraf implementations. Do not edit `src/` expecting live deployment.
