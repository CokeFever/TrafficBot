// TDX API Client for Deno runtime
// Based on lessons learned from previous implementation

interface TdxTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface ParkingLot {
  CarParkID: string;
  CarParkName: { Zh_tw: string; En?: string };
  Address?: string;
  Position?: { PositionLat: number; PositionLon: number };
  CarParkPosition?: { PositionLat: number; PositionLon: number };
  TotalSpaces?: number;
  ServiceTime?: string;
  FareDescription?: { Zh_tw: string };
}

interface ParkingAvailability {
  CarParkID: string;
  AvailableSpaces: number;
  UpdateTime: string;
}

export interface ParkingInfo {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance: number;
  totalSpaces: number;
  availableSpaces: number;
  fareInfo: string;
  updateTime: string;
}

export class TdxApiClient {
  private apiKey: string;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async getAccessToken(): Promise<string> {
    // Check cache
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    // Get new token
    const [clientId, clientSecret] = this.apiKey.split(':');
    const tokenUrl =
      'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data: TdxTokenResponse = await response.json();

    // Cache token (expire 5 minutes before actual expiry)
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000,
    };

    return data.access_token;
  }

  async queryNearbyParking(
    latitude: number,
    longitude: number,
    radius: number
  ): Promise<ParkingInfo[]> {
    try {
      const token = await this.getAccessToken();
      const city = this.getCityFromCoordinates(latitude, longitude);

      if (!city) {
        throw new Error('Location is outside supported cities');
      }

      // Step 1: Get nearby parking lots (static data)
      const nearbyLots = await this.getNearbyParkingLots(latitude, longitude, radius, token);

      // Step 2: Get availability data for the city
      const availability = await this.getParkingAvailability(city, token);

      // Step 3: Merge data
      const merged = this.mergeParkingData(nearbyLots, availability, latitude, longitude);

      // Sort by distance
      merged.sort((a, b) => a.distance - b.distance);

      return merged;
    } catch (error) {
      console.error('Error querying parking:', error);
      throw error;
    }
  }

  private async getNearbyParkingLots(
    latitude: number,
    longitude: number,
    radius: number,
    token: string
  ): Promise<ParkingLot[]> {
    // Use NearBy API with spatial filter
    const spatialFilter = `nearby(${latitude},${longitude},${radius})`;
    const url = `https://tdx.transportdata.tw/api/advanced/v1/Parking/OffStreet/CarPark/NearBy?$spatialFilter=${spatialFilter}&$format=JSON`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch nearby parking: ${response.statusText}`);
    }

    return await response.json();
  }

  private async getParkingAvailability(
    city: string,
    token: string
  ): Promise<ParkingAvailability[]> {
    const url = `https://tdx.transportdata.tw/api/basic/v1/Parking/OffStreet/ParkingAvailability/City/${city}?$format=JSON`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch availability for ${city}: ${response.statusText}`);
      return [];
    }

    return await response.json();
  }

  private mergeParkingData(
    lots: ParkingLot[],
    availability: ParkingAvailability[],
    userLat: number,
    userLon: number
  ): ParkingInfo[] {
    const availabilityMap = new Map<string, ParkingAvailability>();
    availability.forEach((a) => availabilityMap.set(a.CarParkID, a));

    return lots
      .map((lot) => {
        // Get position (handle both Position and CarParkPosition)
        const position = lot.Position || lot.CarParkPosition;
        if (!position) return null;

        const avail = availabilityMap.get(lot.CarParkID);
        const distance = this.calculateDistance(
          userLat,
          userLon,
          position.PositionLat,
          position.PositionLon
        );

        return {
          id: lot.CarParkID,
          name: lot.CarParkName?.Zh_tw || 'Unknown',
          address: lot.Address || '地址未提供',
          latitude: position.PositionLat,
          longitude: position.PositionLon,
          distance,
          totalSpaces: lot.TotalSpaces || 0,
          availableSpaces: avail?.AvailableSpaces ?? -1,
          fareInfo: lot.FareDescription?.Zh_tw || '收費資訊未提供',
          updateTime: avail?.UpdateTime || '',
        };
      })
      .filter((p): p is ParkingInfo => p !== null);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private getCityFromCoordinates(latitude: number, longitude: number): string | null {
    // City boundaries (approximate)
    const cities = [
      { name: 'Taipei', bounds: { minLat: 24.95, maxLat: 25.2, minLon: 121.45, maxLon: 121.65 } },
      {
        name: 'NewTaipei',
        bounds: { minLat: 24.6, maxLat: 25.3, minLon: 121.3, maxLon: 122.0 },
      },
      { name: 'Taoyuan', bounds: { minLat: 24.8, maxLat: 25.1, minLon: 121.0, maxLon: 121.5 } },
      {
        name: 'Taichung',
        bounds: { minLat: 24.0, maxLat: 24.35, minLon: 120.5, maxLon: 121.0 },
      },
      { name: 'Tainan', bounds: { minLat: 22.9, maxLat: 23.2, minLon: 120.1, maxLon: 120.5 } },
      {
        name: 'Kaohsiung',
        bounds: { minLat: 22.5, maxLat: 22.8, minLon: 120.2, maxLon: 120.5 },
      },
      { name: 'Hsinchu', bounds: { minLat: 24.7, maxLat: 24.9, minLon: 120.9, maxLon: 121.1 } },
    ];

    for (const city of cities) {
      const { minLat, maxLat, minLon, maxLon } = city.bounds;
      if (
        latitude >= minLat &&
        latitude <= maxLat &&
        longitude >= minLon &&
        longitude <= maxLon
      ) {
        return city.name;
      }
    }

    return null;
  }

  parseGoogleMapsUrl(url: string): { latitude: number; longitude: number } | null {
    try {
      // Handle different Google Maps URL formats
      // 1. maps.app.goo.gl short links - need to follow redirect
      // 2. google.com/maps with @lat,lon
      // 3. google.com/maps/place with coordinates

      // Pattern: @latitude,longitude
      const coordPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const match = url.match(coordPattern);

      if (match) {
        return {
          latitude: parseFloat(match[1]),
          longitude: parseFloat(match[2]),
        };
      }

      // Pattern: !3d<lat>!4d<lon>
      const altPattern = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
      const altMatch = url.match(altPattern);

      if (altMatch) {
        return {
          latitude: parseFloat(altMatch[1]),
          longitude: parseFloat(altMatch[2]),
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing Google Maps URL:', error);
      return null;
    }
  }
}
