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
  FareDescription?: { Zh_tw: string } | string;
  Description?: string;
}

interface ParkingAvailability {
  CarParkID: string;
  CarParkName?: { Zh_tw: string; En?: string };
  TotalSpaces?: number;
  AvailableSpaces: number;
  UpdateTime?: string;
  CarParkPosition?: { PositionLat: number; PositionLon: number };
  Address?: string;
  Description?: string;
  FareDescription?: string;
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
  
  // 特殊車位資訊
  heavyMotorcycleSpaces?: number;
  chargingSpaces?: number;
  handicapSpaces?: number;
  womenChildrenSpaces?: number;
  
  // 收費細節
  hourlyRate?: string;
  monthlyRate?: string;
  motorcycleMonthlyRate?: string;
  
  // 原始資料
  description?: string;
  fareDescription?: string;
}

export class TdxApiClient {
  private apiKey: string;
  private tokenCache: { token: string; expiresAt: number } | null = null;
  
  // 預設試用 API Key
  static readonly DEFAULT_TRIAL_KEY = 'cokefever-7f3a77c1-84ba-47d9:09f2e5f0-4aed-4c18-bdb2-8af94416e568';
  static readonly TRIAL_DAILY_LIMIT = 2;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  isTrialKey(): boolean {
    return this.apiKey === TdxApiClient.DEFAULT_TRIAL_KEY;
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

    const data = await response.json();
    return Array.isArray(data) ? data : [];
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

    const data = await response.json();
    const availabilities = Array.isArray(data) ? data : (data.ParkingAvailabilities || []);
    console.log(`Fetched ${availabilities.length} availability records from API`);
    return availabilities;
  }

  private mergeParkingData(
    lots: ParkingLot[],
    availability: ParkingAvailability[],
    userLat: number,
    userLon: number
  ): ParkingInfo[] {
    console.log(`Merging data: ${lots.length} lots, ${availability.length} availability records`);
    
    const availabilityMap = new Map<string, ParkingAvailability>();
    
    // Handle case where availability might not be an array
    if (Array.isArray(availability)) {
      availability.forEach((a) => availabilityMap.set(a.CarParkID, a));
      console.log(`Availability map size: ${availabilityMap.size}`);
    } else {
      console.warn('Availability data is not an array:', availability);
    }

    return lots
      .map((lot) => {
        // Get position (handle both Position and CarParkPosition)
        const position = lot.Position || lot.CarParkPosition;
        if (!position) {
          console.warn(`No position for lot: ${lot.CarParkID}`);
          return null;
        }

        const avail = availabilityMap.get(lot.CarParkID);
        if (!avail) {
          console.log(`No availability data for: ${lot.CarParkID} (${lot.CarParkName?.Zh_tw})`);
        }
        
        const distance = this.calculateDistance(
          userLat,
          userLon,
          position.PositionLat,
          position.PositionLon
        );

        // 取得描述和收費資訊（優先使用 availability 的資料，因為它更完整）
        const description = avail?.Description || lot.Description || '';
        const fareDescription = avail?.FareDescription || 
          (typeof lot.FareDescription === 'string' ? lot.FareDescription : (lot.FareDescription?.Zh_tw || ''));
        
        // 解析特殊車位
        const specialSpaces = this.parseSpecialSpaces(description);
        
        // 解析收費資訊
        const fareInfo = this.parseFareInfo(fareDescription);

        // 優先使用 availability 的 TotalSpaces，因為它是即時資料
        const totalSpaces = avail?.TotalSpaces ?? lot.TotalSpaces ?? 0;
        const availableSpaces = avail?.AvailableSpaces ?? -1;

        return {
          id: lot.CarParkID,
          name: lot.CarParkName?.Zh_tw || lot.CarParkName?.En || 'Unknown',
          address: avail?.Address || lot.Address || '地址未提供',
          latitude: position.PositionLat,
          longitude: position.PositionLon,
          distance,
          totalSpaces,
          availableSpaces,
          fareInfo: fareDescription || '收費資訊未提供',
          updateTime: avail?.UpdateTime || '',
          
          // 特殊車位
          heavyMotorcycleSpaces: specialSpaces.heavyMotorcycle,
          chargingSpaces: specialSpaces.charging,
          handicapSpaces: specialSpaces.handicap,
          womenChildrenSpaces: specialSpaces.womenChildren,
          
          // 收費細節
          hourlyRate: fareInfo.hourlyRate,
          monthlyRate: fareInfo.monthlyRate,
          motorcycleMonthlyRate: fareInfo.motorcycleMonthlyRate,
          
          // 原始資料
          description,
          fareDescription,
        };
      })
      .filter((p): p is ParkingInfo => p !== null);
  }

  private parseSpecialSpaces(description: string): {
    heavyMotorcycle?: number;
    charging?: number;
    handicap?: number;
    womenChildren?: number;
  } {
    const result: any = {};
    
    if (!description) return result;
    
    // 大型重機
    const motorcycleMatch = description.match(/大[型重]?重?機[：:]?(\d+)格/);
    if (motorcycleMatch) {
      const count = parseInt(motorcycleMatch[1]);
      if (count > 0) result.heavyMotorcycle = count;
    }
    
    // 充電格位
    const chargingMatch = description.match(/充電格?位[：:]?(\d+)[格個]/);
    if (chargingMatch) {
      const count = parseInt(chargingMatch[1]);
      if (count > 0) result.charging = count;
    }
    
    // 身心障礙停車位
    const handicapMatch = description.match(/身心障礙停車位(\d+)格/);
    if (handicapMatch) {
      const count = parseInt(handicapMatch[1]);
      if (count > 0) result.handicap = count;
    }
    
    // 孕婦、育有六歲以下兒童停車位
    const womenChildrenMatch = description.match(/孕婦、育有六歲以下兒童停車位(\d+)格/);
    if (womenChildrenMatch) {
      const count = parseInt(womenChildrenMatch[1]);
      if (count > 0) result.womenChildren = count;
    }
    
    return result;
  }

  private parseFareInfo(fareDescription: string): {
    hourlyRate?: string;
    monthlyRate?: string;
    motorcycleMonthlyRate?: string;
  } {
    const result: any = {};
    
    if (!fareDescription) return result;
    
    // 計時收費
    const hourlyMatch = fareDescription.match(/(\d+)元[/／]時/);
    if (hourlyMatch) {
      result.hourlyRate = `${hourlyMatch[1]}元/時`;
    }
    
    // 月租（小型車）
    const monthlyMatch = fareDescription.match(/月租[^0-9]*?(\d+,?\d*)元/);
    if (monthlyMatch) {
      result.monthlyRate = `${monthlyMatch[1]}元/月`;
    }
    
    // 重機月租
    const motorcycleMonthlyMatch = fareDescription.match(/大[型重]?重?機[^0-9]*?(\d+,?\d*)元/);
    if (motorcycleMonthlyMatch) {
      result.motorcycleMonthlyRate = `${motorcycleMonthlyMatch[1]}元/月`;
    }
    
    return result;
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
      { name: 'Keelung', bounds: { minLat: 25.1, maxLat: 25.2, minLon: 121.7, maxLon: 121.8 } },
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
      // 1. Short links (maps.app.goo.gl) - need to extract from redirect or parameters
      // 2. google.com/maps with @lat,lon
      // 3. google.com/maps/place with coordinates
      // 4. google.com/maps?q=lat,lon
      // 5. google.com/maps/search with coordinates
      // 6. goo.gl short links

      // Pattern 1: @latitude,longitude (most common)
      const coordPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const match = url.match(coordPattern);

      if (match) {
        return {
          latitude: parseFloat(match[1]),
          longitude: parseFloat(match[2]),
        };
      }

      // Pattern 2: !3d<lat>!4d<lon> (embedded in URL)
      const altPattern = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
      const altMatch = url.match(altPattern);

      if (altMatch) {
        return {
          latitude: parseFloat(altMatch[1]),
          longitude: parseFloat(altMatch[2]),
        };
      }

      // Pattern 3: ?q=lat,lon or &q=lat,lon
      const qPattern = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const qMatch = url.match(qPattern);

      if (qMatch) {
        return {
          latitude: parseFloat(qMatch[1]),
          longitude: parseFloat(qMatch[2]),
        };
      }

      // Pattern 4: /place/name/@lat,lon
      const placePattern = /\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const placeMatch = url.match(placePattern);

      if (placeMatch) {
        return {
          latitude: parseFloat(placeMatch[1]),
          longitude: parseFloat(placeMatch[2]),
        };
      }

      // Pattern 5: ll=lat,lon
      const llPattern = /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const llMatch = url.match(llPattern);

      if (llMatch) {
        return {
          latitude: parseFloat(llMatch[1]),
          longitude: parseFloat(llMatch[2]),
        };
      }
      
      // Pattern 6: center=lat,lon
      const centerPattern = /[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const centerMatch = url.match(centerPattern);

      if (centerMatch) {
        return {
          latitude: parseFloat(centerMatch[1]),
          longitude: parseFloat(centerMatch[2]),
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing Google Maps URL:', error);
      return null;
    }
  }

  async parseGoogleMapsUrlWithRedirect(url: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // First try direct parsing
      const directResult = this.parseGoogleMapsUrl(url);
      if (directResult) {
        return directResult;
      }

      // If it's a short link, try to follow redirect
      if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
        console.log('Detected short link, following redirect...');
        
        // Follow redirect to get full URL
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
        });
        
        const fullUrl = response.url;
        console.log('Redirected to:', fullUrl);
        
        // Try parsing the full URL
        return this.parseGoogleMapsUrl(fullUrl);
      }

      return null;
    } catch (error) {
      console.error('Error parsing Google Maps URL with redirect:', error);
      return null;
    }
  }
}
