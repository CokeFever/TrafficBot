// TDX API Client for Deno runtime
// Based on lessons learned from previous implementation

// Deno global type declaration for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

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
  ServiceTime?: string;
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
  parkingCategory?: 'offstreet' | 'onstreet'; // 路外停車場 vs 路邊停車格
  isApproximate?: boolean; // true when position is not exact (fallback mode)
  
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
  serviceTime?: string;
}

export interface TrafficInfo {
  roadName: string;
  distance: number;
  speed: number;
  status: 'smooth' | 'slow' | 'congested';
  messageText?: string;
  messageType?: number;
  direction?: string;
  roadClass?: number;
}

export class TdxApiClient {
  private apiKey: string;
  private tokenCache: { token: string; expiresAt: number } | null = null;
  
  // 預設試用 API Key - 從環境變數讀取
  // 注意：試用 Key 應該在 Supabase Dashboard 的 Edge Function Secrets 中設定
  static readonly DEFAULT_TRIAL_KEY = Deno.env.get('TDX_TRIAL_API_KEY') || '';
  static readonly TRIAL_DAILY_LIMIT = 5;

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
    radius: number,
    vehicleType?: 'car' | 'motorcycle'
  ): Promise<ParkingInfo[]> {
    try {
      const token = await this.getAccessToken();
      const city = this.getCityFromCoordinates(latitude, longitude);

      if (!city) {
        throw new Error('Location is outside supported cities');
      }

      // Step 1: Get nearby parking lots (static data - OffStreet)
      let nearbyLots = await this.getNearbyParkingLots(latitude, longitude, radius, token);

      // Step 2: Get availability data
      let offStreetResults: ParkingInfo[];
      
      if (nearbyLots.length > 0) {
        // Normal flow: NearBy found lots, get their availability
        const carParkIds = nearbyLots.map(lot => lot.CarParkID).filter(Boolean);
        const availability = await this.getParkingAvailability(city, token, carParkIds);
        offStreetResults = this.mergeParkingData(nearbyLots, availability, latitude, longitude);
      } else {
        // Fallback: NearBy returned empty (e.g., Taipei)
        // Use full city ParkingAvailability + reverse geocode for positions
        console.log(`NearBy returned 0 for ${city}, using fallback strategy`);
        offStreetResults = await this.fallbackParkingQuery(latitude, longitude, radius, city, token);
      }
      
      // For motorcycle queries, filter OffStreet to only show those with motorcycle spaces
      if (vehicleType === 'motorcycle') {
        offStreetResults = offStreetResults.filter(f => 
          f.heavyMotorcycleSpaces && f.heavyMotorcycleSpaces > 0
        );
      }

      // Step 3: Get OnStreet (路邊停車) data
      let onStreetResults: ParkingInfo[] = [];
      try {
        onStreetResults = await this.queryOnStreetParking(latitude, longitude, radius, city, token, vehicleType);
      } catch (error) {
        console.warn('OnStreet parking query failed, using OffStreet only:', error);
      }

      // Combine and sort by distance
      const merged = [...offStreetResults, ...onStreetResults];
      merged.sort((a, b) => a.distance - b.distance);

      return merged;
    } catch (error) {
      console.error('Error querying parking:', error);
      throw error;
    }
  }

  /**
   * Fallback when NearBy API returns empty:
   * 1. Reverse-geocode user location to get district name
   * 2. Fetch full city ParkingAvailability
   * 3. Filter by CarParkName containing district/area keyword
   * 4. Return matches with approximate position (use district center)
   */
  private async fallbackParkingQuery(
    latitude: number,
    longitude: number,
    radius: number,
    city: string,
    token: string
  ): Promise<ParkingInfo[]> {
    try {
      // Step 1: Reverse geocode to get area/district name
      const areaKeywords = await this.reverseGeocodeForArea(latitude, longitude);
      console.log(`Fallback: area keywords = [${areaKeywords.join(', ')}]`);
      
      // Step 2: Fetch full city availability
      const availability = await this.getParkingAvailability(city, token);
      if (availability.length === 0) return [];
      
      console.log(`Fallback: ${availability.length} total availability records for ${city}`);
      
      // Step 3: Filter by area keywords in CarParkName or Address
      let candidates: ParkingAvailability[] = [];
      
      // Try each keyword from most specific to broadest
      for (const kw of areaKeywords) {
        const matches = availability.filter(a => {
          const name = a.CarParkName?.Zh_tw || '';
          const addr = a.Address || '';
          return name.includes(kw) || addr.includes(kw);
        });
        if (matches.length > 0) {
          const existingIds = new Set(candidates.map(c => c.CarParkID));
          for (const m of matches) {
            if (!existingIds.has(m.CarParkID)) {
              candidates.push(m);
              existingIds.add(m.CarParkID);
            }
          }
        }
      }
      
      // If only a few matches, try broader district-level matching
      if (candidates.length < 5) {
        const districtKw = areaKeywords.find(kw => kw.endsWith('區') || kw.endsWith('里'));
        if (districtKw) {
          const districtBase = districtKw.replace(/(區|里)$/, '');
          const broadMatches = availability.filter(a => {
            const name = a.CarParkName?.Zh_tw || '';
            return name.includes(districtBase) || name.includes(districtKw);
          });
          const existingIds = new Set(candidates.map(c => c.CarParkID));
          for (const m of broadMatches) {
            if (!existingIds.has(m.CarParkID) && candidates.length < 20) {
              candidates.push(m);
              existingIds.add(m.CarParkID);
            }
          }
        }
      }
      
      // If still too few, add top available spaces
      if (candidates.length < 3) {
        const remaining = availability
          .filter(a => a.AvailableSpaces > 0 && !candidates.some(c => c.CarParkID === a.CarParkID))
          .slice(0, 10);
        candidates.push(...remaining);
      }
      
      // Limit to 20 results
      candidates = candidates.slice(0, 20);
      console.log(`Fallback: ${candidates.length} candidates matched`);
      
      // Step 4: Build results - use user's position as approximate location
      // (since we can't get exact coords, we use a small offset for sorting purposes)
      const results: ParkingInfo[] = candidates.map((avail, index) => {
        const name = avail.CarParkName?.Zh_tw || avail.CarParkID;
        const fareDescription = avail.FareDescription || '';
        const fareInfo = this.parseFareInfo(fareDescription);
        const description = avail.Description || '';
        const specialSpaces = this.parseSpecialSpaces(description);
        
        return {
          id: avail.CarParkID,
          name,
          address: avail.Address || '',
          // Use user's position as approximation (parking is "nearby" by name match)
          latitude,
          longitude,
          distance: index * 50, // Approximate ordering by match relevance
          totalSpaces: avail.TotalSpaces || 0,
          availableSpaces: avail.AvailableSpaces ?? -1,
          fareInfo: fareDescription || '收費資訊未提供',
          updateTime: avail.UpdateTime || '',
          parkingCategory: 'offstreet' as const,
          isApproximate: true,
          heavyMotorcycleSpaces: specialSpaces.heavyMotorcycle,
          chargingSpaces: specialSpaces.charging,
          handicapSpaces: specialSpaces.handicap,
          womenChildrenSpaces: specialSpaces.womenChildren,
          hourlyRate: fareInfo.hourlyRate,
          monthlyRate: fareInfo.monthlyRate,
          motorcycleMonthlyRate: fareInfo.motorcycleMonthlyRate,
          description,
          fareDescription,
          serviceTime: avail.ServiceTime,
        };
      });
      
      console.log(`Fallback: returning ${results.length} parking lots`);
      return results;
    } catch (error) {
      console.error('Fallback parking query failed:', error);
      return [];
    }
  }

  private async reverseGeocodeForArea(latitude: number, longitude: number): Promise<string[]> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=16&accept-language=zh-TW`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'TrafficBot/1.0' },
      });
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const address = data.address || {};
      
      // Extract useful area keywords (from specific to broad)
      const keywords: string[] = [];
      
      // Road name (most specific for parking lot matching)
      if (address.road) {
        keywords.push(address.road);
        // Try base name without suffixes
        const roadBase = address.road.replace(/(路|街|大道|段|巷|弄)$/g, '');
        if (roadBase.length >= 2 && roadBase !== address.road) {
          keywords.push(roadBase);
        }
      }
      
      // Neighbourhood / area
      if (address.neighbourhood) keywords.push(address.neighbourhood);
      
      // District (區) - broader match
      if (address.suburb) keywords.push(address.suburb);
      if (address.city_district) keywords.push(address.city_district);
      
      // Known landmarks in the area
      if (address.amenity) keywords.push(address.amenity);
      
      return keywords.filter(k => k && k.length >= 2);
    } catch (error) {
      console.error('Reverse geocode failed:', error);
      return [];
    }
  }

  private async queryOnStreetParking(
    latitude: number,
    longitude: number,
    radius: number,
    city: string,
    token: string,
    vehicleType?: 'car' | 'motorcycle'
  ): Promise<ParkingInfo[]> {
    // Get on-street parking segments
    const segmentUrl = `https://tdx.transportdata.tw/api/basic/v1/Parking/OnStreet/ParkingSegment/City/${city}?$format=JSON&$spatialFilter=nearby(${latitude},${longitude},${radius})`;
    
    const segmentResponse = await fetch(segmentUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!segmentResponse.ok) {
      console.warn(`OnStreet segment API failed for ${city}: ${segmentResponse.status}`);
      return [];
    }
    
    const segmentData = await segmentResponse.json();
    let segments = Array.isArray(segmentData) ? segmentData : (segmentData.ParkingSegments || []);
    
    // Filter by vehicle type
    if (vehicleType === 'motorcycle') {
      segments = segments.filter((s: any) => {
        const parkingType = (s.ParkingType || '').toLowerCase();
        return parkingType.includes('motorcycle') || parkingType.includes('機車') || parkingType.includes('摩托');
      });
    } else if (vehicleType === 'car') {
      segments = segments.filter((s: any) => {
        const parkingType = (s.ParkingType || '').toLowerCase();
        return !parkingType.includes('motorcycle') || parkingType.includes('car') || parkingType === '';
      });
    }
    
    if (segments.length === 0) return [];
    
    console.log(`Found ${segments.length} on-street parking segments (filtered for ${vehicleType || 'all'})`);
    
    // Get availability for these segments
    const segmentIds = segments.map((s: any) => s.ParkingSegmentID).filter(Boolean);
    const batchSize = 30;
    let allAvailabilities: any[] = [];
    
    for (let i = 0; i < segmentIds.length; i += batchSize) {
      const batch = segmentIds.slice(i, i + batchSize);
      const filterExpr = batch.map((id: string) => `ParkingSegmentID eq '${id}'`).join(' or ');
      const availUrl = `https://tdx.transportdata.tw/api/basic/v1/Parking/OnStreet/ParkingSegmentAvailability/City/${city}?$format=JSON&$filter=${filterExpr}`;
      
      const availResponse = await fetch(availUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (availResponse.ok) {
        const availData = await availResponse.json();
        const avails = Array.isArray(availData) ? availData : (availData.ParkingSegmentAvailabilities || []);
        allAvailabilities.push(...avails);
      }
    }
    
    // Merge segments with availability
    const availMap = new Map();
    allAvailabilities.forEach((avail: any) => {
      availMap.set(avail.ParkingSegmentID, avail);
    });
    
    return segments.map((segment: any) => {
      const position = segment.Position || segment.ParkingSegmentPosition;
      if (!position) return null;
      
      const avail = availMap.get(segment.ParkingSegmentID);
      const distance = this.calculateDistance(latitude, longitude, position.PositionLat, position.PositionLon);
      
      if (distance > radius) return null;
      
      const segmentName = segment.ParkingSegmentName?.Zh_tw || '';
      const roadName = segment.RoadName || '';
      const roadSection = segment.RoadSection || '';
      const name = segmentName || `${roadName}${roadSection ? ` (${roadSection})` : ''}` || segment.ParkingSegmentID;
      
      const fareDescription = typeof segment.FareDescription === 'string' 
        ? segment.FareDescription 
        : segment.FareDescription?.Zh_tw || '';
      const fareInfo = this.parseFareInfo(fareDescription);
      
      return {
        id: segment.ParkingSegmentID,
        name: `${name}`,
        address: `${roadName}${roadSection ? ` ${roadSection}` : ''}`,
        latitude: position.PositionLat,
        longitude: position.PositionLon,
        distance: Math.round(distance),
        totalSpaces: segment.TotalSpaces || 0,
        availableSpaces: avail?.AvailableSpaces ?? -1,
        fareInfo: fareDescription || '收費資訊未提供',
        updateTime: avail?.UpdateTime || '',
        parkingCategory: 'onstreet' as const,
        hourlyRate: fareInfo.hourlyRate,
        monthlyRate: fareInfo.monthlyRate,
        fareDescription,
        serviceTime: segment.ServiceTime,
      } as ParkingInfo;
    }).filter((p: any): p is ParkingInfo => p !== null);
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

    console.log(`Fetching OffStreet NearBy: ${url}`);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error(`OffStreet NearBy API failed: ${response.status} ${response.statusText}`);
      // Don't throw - return empty so OnStreet can still be queried
      return [];
    }

    const data = await response.json();
    
    // Handle multiple possible response formats from TDX
    let lots: ParkingLot[];
    if (Array.isArray(data)) {
      lots = data;
    } else if (data.CarParks && Array.isArray(data.CarParks)) {
      lots = data.CarParks;
    } else if (data.CarParkList && Array.isArray(data.CarParkList)) {
      lots = data.CarParkList;
    } else {
      // Try to find any array property in the response
      const arrayProp = Object.values(data).find(v => Array.isArray(v));
      lots = (arrayProp as ParkingLot[]) || [];
    }
    
    console.log(`OffStreet NearBy returned ${lots.length} parking lots`);
    return lots;
  }

  private async getParkingAvailability(
    city: string,
    token: string,
    carParkIds?: string[]
  ): Promise<ParkingAvailability[]> {
    // Use $filter with specific CarParkIDs for better performance
    if (carParkIds && carParkIds.length > 0) {
      const batchSize = 30;
      const allAvailabilities: ParkingAvailability[] = [];
      
      for (let i = 0; i < carParkIds.length; i += batchSize) {
        const batch = carParkIds.slice(i, i + batchSize);
        const filterExpr = batch.map(id => `CarParkID eq '${id}'`).join(' or ');
        const url = `https://tdx.transportdata.tw/api/basic/v1/Parking/OffStreet/ParkingAvailability/City/${city}?$format=JSON&$filter=${filterExpr}`;
        
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!response.ok) {
          console.warn(`Filtered availability fetch failed: ${response.status}, falling back to full city query`);
          return this.getParkingAvailability(city, token); // Fallback without filter
        }
        
        const data = await response.json();
        const availabilities = Array.isArray(data) ? data : (data.ParkingAvailabilities || []);
        allAvailabilities.push(...availabilities);
      }
      
      console.log(`Fetched ${allAvailabilities.length} filtered availability records from API`);
      return allAvailabilities;
    }
    
    // Fallback: fetch all availability for the city
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
          serviceTime: lot.ServiceTime,
          parkingCategory: 'offstreet' as const,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null) as ParkingInfo[];
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
    // City boundaries ordered from most specific (small) to broadest (large)
    // to avoid overlap issues. TDX API city name values.

    // Keelung
    if (latitude >= 25.09 && latitude <= 25.18 && longitude >= 121.69 && longitude <= 121.80) {
      return 'Keelung';
    }

    // Taipei City
    if (latitude >= 24.96 && latitude <= 25.21 && longitude >= 121.43 && longitude <= 121.67) {
      return 'Taipei';
    }

    // Hsinchu City
    if (latitude >= 24.73 && latitude <= 24.84 && longitude >= 120.89 && longitude <= 121.05) {
      return 'Hsinchu';
    }

    // Chiayi City
    if (latitude >= 23.43 && latitude <= 23.51 && longitude >= 120.39 && longitude <= 120.50) {
      return 'Chiayi';
    }

    // New Taipei City
    if (latitude >= 24.67 && latitude <= 25.30 && longitude >= 121.28 && longitude <= 122.01) {
      return 'NewTaipei';
    }

    // Taoyuan
    if (latitude >= 24.73 && latitude <= 25.12 && longitude >= 121.01 && longitude <= 121.40) {
      return 'Taoyuan';
    }

    // Hsinchu County
    if (latitude >= 24.53 && latitude <= 24.85 && longitude >= 120.85 && longitude <= 121.35) {
      return 'HssinchuCounty';
    }

    // Miaoli County
    if (latitude >= 24.30 && latitude <= 24.68 && longitude >= 120.62 && longitude <= 121.25) {
      return 'MiaoliCounty';
    }

    // Taichung
    if (latitude >= 24.03 && latitude <= 24.47 && longitude >= 120.47 && longitude <= 121.06) {
      return 'Taichung';
    }

    // Changhua County
    if (latitude >= 23.82 && latitude <= 24.18 && longitude >= 120.25 && longitude <= 120.68) {
      return 'ChanghuaCounty';
    }

    // Nantou County
    if (latitude >= 23.63 && latitude <= 24.11 && longitude >= 120.38 && longitude <= 121.32) {
      return 'NantouCounty';
    }

    // Yunlin County
    if (latitude >= 23.50 && latitude <= 23.82 && longitude >= 120.15 && longitude <= 120.73) {
      return 'YunlinCounty';
    }

    // Chiayi County
    if (latitude >= 23.24 && latitude <= 23.60 && longitude >= 120.30 && longitude <= 120.77) {
      return 'ChiayiCounty';
    }

    // Tainan
    if (latitude >= 22.88 && latitude <= 23.40 && longitude >= 120.04 && longitude <= 120.65) {
      return 'Tainan';
    }

    // Kaohsiung
    if (latitude >= 22.47 && latitude <= 23.47 && longitude >= 120.15 && longitude <= 120.86) {
      return 'Kaohsiung';
    }

    // Pingtung County
    if (latitude >= 21.90 && latitude <= 22.88 && longitude >= 120.36 && longitude <= 120.93) {
      return 'PingtungCounty';
    }

    // Yilan County
    if (latitude >= 24.30 && latitude <= 24.82 && longitude >= 121.35 && longitude <= 121.98) {
      return 'YilanCounty';
    }

    // Hualien County
    if (latitude >= 23.30 && latitude <= 24.35 && longitude >= 121.10 && longitude <= 121.75) {
      return 'HualienCounty';
    }

    // Taitung County
    if (latitude >= 22.30 && latitude <= 23.45 && longitude >= 120.75 && longitude <= 121.55) {
      return 'TaitungCounty';
    }

    // Penghu County
    if (latitude >= 23.20 && latitude <= 23.80 && longitude >= 119.30 && longitude <= 119.72) {
      return 'PenghuCounty';
    }

    // Kinmen County
    if (latitude >= 24.38 && latitude <= 24.52 && longitude >= 118.20 && longitude <= 118.45) {
      return 'KinmenCounty';
    }

    // Lienchiang County (Matsu)
    if (latitude >= 25.94 && latitude <= 26.38 && longitude >= 119.88 && longitude <= 120.51) {
      return 'LienchiangCounty';
    }

    return null;
  }

  parseGoogleMapsUrl(url: string): { latitude: number; longitude: number } | null {
    try {
      // Pattern 1: @latitude,longitude (most common)
      const coordPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const match = url.match(coordPattern);
      if (match) {
        return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
      }

      // Pattern 2: !3d<lat>!4d<lon> (embedded in URL or HTML)
      const altPattern = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
      const altMatch = url.match(altPattern);
      if (altMatch) {
        return { latitude: parseFloat(altMatch[1]), longitude: parseFloat(altMatch[2]) };
      }

      // Pattern 3: ?q=lat,lon or &q=lat,lon
      const qPattern = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const qMatch = url.match(qPattern);
      if (qMatch) {
        return { latitude: parseFloat(qMatch[1]), longitude: parseFloat(qMatch[2]) };
      }

      // Pattern 4: ll=lat,lon
      const llPattern = /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const llMatch = url.match(llPattern);
      if (llMatch) {
        return { latitude: parseFloat(llMatch[1]), longitude: parseFloat(llMatch[2]) };
      }
      
      // Pattern 5: center=lat,lon
      const centerPattern = /[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const centerMatch = url.match(centerPattern);
      if (centerMatch) {
        return { latitude: parseFloat(centerMatch[1]), longitude: parseFloat(centerMatch[2]) };
      }

      // Pattern 6: [null,null,lat,lon] in Google Maps JS data (common in HTML source)
      const jsArrayPattern = /\[null,null,(-?\d+\.\d{4,}),(-?\d+\.\d{4,})\]/;
      const jsArrayMatch = url.match(jsArrayPattern);
      if (jsArrayMatch) {
        return { latitude: parseFloat(jsArrayMatch[1]), longitude: parseFloat(jsArrayMatch[2]) };
      }

      // Pattern 7: "lat":22.995,"lng":120.196 or similar JSON patterns
      const jsonPattern = /"lat(?:itude)?":\s*(-?\d+\.\d+).*?"lng|lon(?:gitude)?":\s*(-?\d+\.\d+)/;
      const jsonMatch = url.match(jsonPattern);
      if (jsonMatch) {
        return { latitude: parseFloat(jsonMatch[1]), longitude: parseFloat(jsonMatch[2]) };
      }

      // Pattern 8: Google Maps APP_INITIALIZATION_STATE with coordinates like [0,0,lat,lon]
      const appInitPattern = /APP_INITIALIZATION_STATE.*?\[\d+[^[]*\[[\d.e-]+,[\d.e-]+,(-?\d+\.\d{4,}),(-?\d+\.\d{4,})\]/s;
      const appInitMatch = url.match(appInitPattern);
      if (appInitMatch) {
        return { latitude: parseFloat(appInitMatch[1]), longitude: parseFloat(appInitMatch[2]) };
      }

      return null;
    } catch (error) {
      console.error('Error parsing Google Maps URL:', error);
      return null;
    }
  }

  async parseGoogleMapsUrlWithRedirect(url: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // Remove query parameters from short links (e.g., ?g_st=ac)
      const cleanUrl = url.split('?')[0];
      console.log('parseGoogleMapsUrlWithRedirect input:', url, '-> clean:', cleanUrl);
      
      // First try direct parsing
      const directResult = this.parseGoogleMapsUrl(cleanUrl);
      if (directResult) {
        return directResult;
      }

      // If it's a short link, try to follow redirect
      if (cleanUrl.includes('maps.app.goo.gl') || cleanUrl.includes('goo.gl/maps')) {
        console.log('Detected short link, following redirect...');
        
        // Use manual redirect to capture intermediate URLs
        let currentUrl = cleanUrl;
        let lastRedirectUrl = '';
        for (let i = 0; i < 5; i++) {
          const response = await fetch(currentUrl, {
            method: 'GET',
            redirect: 'manual',
          });
          
          const location = response.headers.get('location');
          console.log(`Redirect step ${i}: status=${response.status}, location=${location?.substring(0, 200)}`);
          
          if (location) {
            // Try parsing the redirect location URL
            const locationResult = this.parseGoogleMapsUrl(location);
            if (locationResult) {
              console.log('Parsed coordinates from redirect location');
              return locationResult;
            }
            lastRedirectUrl = location;
            currentUrl = location;
          } else {
            // No more redirects, try parsing the final URL and body
            const finalUrl = response.url || currentUrl;
            console.log('Final URL:', finalUrl.substring(0, 200));
            
            const finalResult = this.parseGoogleMapsUrl(finalUrl);
            if (finalResult) {
              return finalResult;
            }
            
            // Parse HTML body for coordinates
            const html = await response.text();
            console.log('HTML body length:', html.length);
            
            const htmlResult = this.parseGoogleMapsUrl(html);
            if (htmlResult) {
              console.log('Parsed coordinates from HTML body');
              return htmlResult;
            }
            break;
          }
        }

        // Last resort: extract address from the redirect URL and geocode it
        const addressUrl = lastRedirectUrl || currentUrl;
        const geocodeResult = await this.geocodeFromMapsUrl(addressUrl);
        if (geocodeResult) {
          console.log('Parsed coordinates from geocoding address');
          return geocodeResult;
        }
      }

      return null;
    } catch (error) {
      console.error('Error parsing Google Maps URL with redirect:', error);
      return null;
    }
  }

  private async geocodeFromMapsUrl(url: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // Extract address from Google Maps place URL
      // Format: /maps/place/ENCODED_ADDRESS/data=...
      const placeMatch = url.match(/\/maps\/place\/([^/?]+)/);
      if (!placeMatch) return null;

      const encodedAddress = placeMatch[1];
      const rawAddress = decodeURIComponent(encodedAddress);
      console.log('Raw address from URL:', rawAddress);

      // Parse Taiwan address: [postal]City+District+Street+Number+StoreName
      // Example: "700臺南市中西區忠明街23號四季恬鑫溫體牛肉鍋忠明店"
      // Example: "114臺北市內湖區堤頂大道二段251號"
      let address = rawAddress;
      
      // Remove leading postal code
      address = address.replace(/^\d{3,6}/, '');
      
      // Parse structured address: city(市) + district(區) + street + number(號)
      const twAddressMatch = address.match(/^(.+?[市縣])(.+?[區鄉鎮市])(.+?)(\d+號)/);
      
      if (twAddressMatch) {
        const city = twAddressMatch[1];
        const district = twAddressMatch[2];
        const street = twAddressMatch[3];
        const number = twAddressMatch[4].replace('號', '');
        
        console.log(`Parsed address: city=${city}, district=${district}, street=${street}, number=${number}`);
        
        // Use Nominatim structured query for precise geocoding
        const params = new URLSearchParams({
          street: `${number} ${street}`,
          city: city,
          county: district,
          format: 'json',
          limit: '1',
          countrycodes: 'tw',
        });
        
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
        const response = await fetch(nominatimUrl, {
          headers: { 'User-Agent': 'TrafficBot/1.0' },
        });

        if (response.ok) {
          const results = await response.json();
          if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            console.log('Geocoded coordinates (structured):', lat, lon);
            return { latitude: lat, longitude: lon };
          }
        }
        
        // Fallback: try with just city + street (without house number)
        const fallbackParams = new URLSearchParams({
          q: `${city}${district}${street}`,
          format: 'json',
          limit: '1',
          countrycodes: 'tw',
        });
        
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?${fallbackParams.toString()}`;
        const fallbackResponse = await fetch(fallbackUrl, {
          headers: { 'User-Agent': 'TrafficBot/1.0' },
        });

        if (fallbackResponse.ok) {
          const fallbackResults = await fallbackResponse.json();
          if (fallbackResults && fallbackResults.length > 0) {
            const lat = parseFloat(fallbackResults[0].lat);
            const lon = parseFloat(fallbackResults[0].lon);
            console.log('Geocoded coordinates (fallback):', lat, lon);
            return { latitude: lat, longitude: lon };
          }
        }
      }

      console.log('Nominatim returned no results');
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  async queryNearbyTraffic(
    latitude: number,
    longitude: number,
    radius: number
  ): Promise<TrafficInfo[]> {
    try {
      const token = await this.getAccessToken();
      const city = this.getCityFromCoordinates(latitude, longitude);

      if (!city) {
        throw new Error('Location is outside supported cities');
      }

      // Query CMS (Changeable Message Signs) for traffic messages
      const cmsData = await this.queryCMSData(latitude, longitude, radius, city, token);
      
      // Query VD (Vehicle Detectors) for traffic flow
      const vdData = await this.queryVDData(latitude, longitude, radius, city, token);
      
      // Combine and sort by distance
      const allData = [...cmsData, ...vdData].sort((a, b) => a.distance - b.distance);

      return allData;
    } catch (error) {
      console.error('Error querying traffic:', error);
      throw error;
    }
  }

  private async queryCMSData(
    latitude: number,
    longitude: number,
    radius: number,
    city: string,
    token: string
  ): Promise<TrafficInfo[]> {
    try {
      // Step 1: Get nearby CMS devices
      const nearbyUrl = `https://tdx.transportdata.tw/api/advanced/v2/Road/Traffic/CMS/NearBy?$spatialFilter=nearby(${latitude},${longitude},${radius})&$format=JSON`;
      
      const nearbyResponse = await fetch(nearbyUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!nearbyResponse.ok) {
        console.error(`CMS NearBy API failed: ${nearbyResponse.status}`);
        return [];
      }
      
      const cmsDevices = await nearbyResponse.json();
      if (!Array.isArray(cmsDevices) || cmsDevices.length === 0) return [];
      
      // Step 2: Get live messages for the city
      const liveUrl = `https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/Live/CMS/City/${city}?$format=JSON`;
      
      const liveResponse = await fetch(liveUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!liveResponse.ok) {
        console.error(`CMS Live API failed: ${liveResponse.status}`);
        return [];
      }
      
      const liveData = await liveResponse.json();
      const cmsLives = liveData.CMSLives || [];
      
      // Create a map of live data
      const liveMap = new Map();
      cmsLives.forEach((live: any) => {
        liveMap.set(live.CMSID, live);
      });
      
      // Combine nearby devices with live data
      const trafficData: TrafficInfo[] = [];
      
      for (const device of cmsDevices) {
        const live = liveMap.get(device.CMSID);
        
        // Skip if no live data or no messages
        if (!live || live.MessageStatus === 0 || !live.Messages || live.Messages.length === 0) {
          continue;
        }
        
        const distance = this.calculateDistance(
          latitude,
          longitude,
          device.PositionLat,
          device.PositionLon
        );
        
        // Filter by radius
        if (distance > radius) continue;
        
        // Get the first message (usually the most important)
        const message = live.Messages[0];
        
        trafficData.push({
          roadName: device.RoadName || '未知路段',
          distance: Math.round(distance),
          speed: 0,
          status: this.getStatusFromMessageType(message.Type),
          messageText: message.Text,
          messageType: message.Type,
          direction: device.RoadDirection,
        });
      }
      
      return trafficData;
    } catch (error) {
      console.error('CMS query error:', error);
      return [];
    }
  }

  private async queryVDData(
    latitude: number,
    longitude: number,
    radius: number,
    city: string,
    token: string
  ): Promise<TrafficInfo[]> {
    try {
      // Step 1: Get nearby VD devices
      const nearbyUrl = `https://tdx.transportdata.tw/api/advanced/v2/Road/Traffic/VD/NearBy?$spatialFilter=nearby(${latitude},${longitude},${radius})&$format=JSON`;
      
      const nearbyResponse = await fetch(nearbyUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!nearbyResponse.ok) {
        console.error(`VD NearBy API failed: ${nearbyResponse.status}`);
        return [];
      }
      
      const vdDevices = await nearbyResponse.json();
      if (!Array.isArray(vdDevices) || vdDevices.length === 0) return [];
      
      // Step 2: Get live flow data for the city
      const liveUrl = `https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/Live/VD/City/${city}?$format=JSON`;
      
      const liveResponse = await fetch(liveUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!liveResponse.ok) {
        console.error(`VD Live API failed: ${liveResponse.status}`);
        return [];
      }
      
      const liveData = await liveResponse.json();
      const vdLives = liveData.VDLives || [];
      
      // Create a map of live data
      const liveMap = new Map();
      vdLives.forEach((live: any) => {
        liveMap.set(live.VDID, live);
      });
      
      // Combine nearby devices with live data
      const trafficData: TrafficInfo[] = [];
      
      for (const device of vdDevices) {
        const live = liveMap.get(device.VDID);
        
        // Skip if no live data
        if (!live || !live.LinkFlows || live.LinkFlows.length === 0) {
          continue;
        }
        
        const distance = this.calculateDistance(
          latitude,
          longitude,
          device.PositionLat,
          device.PositionLon
        );
        
        // Filter by radius
        if (distance > radius) continue;
        
        // Calculate average speed from all lanes
        let totalSpeed = 0;
        let laneCount = 0;
        
        for (const link of live.LinkFlows) {
          if (link.Lanes) {
            for (const lane of link.Lanes) {
              if (lane.Speed > 0 && lane.Speed !== -99) {
                totalSpeed += lane.Speed;
                laneCount++;
              }
            }
          }
        }
        
        if (laneCount === 0) continue;
        
        const avgSpeed = Math.round(totalSpeed / laneCount);
        const roadClass = device.RoadClass || 6;
        
        trafficData.push({
          roadName: device.RoadName || '未知路段',
          distance: Math.round(distance),
          speed: avgSpeed,
          status: this.classifySpeedByRoadClass(avgSpeed, roadClass),
          roadClass,
        });
      }
      
      return trafficData;
    } catch (error) {
      console.error('VD query error:', error);
      return [];
    }
  }

  private getStatusFromMessageType(type?: number): 'smooth' | 'slow' | 'congested' {
    // Message types: 1=travel time, 2=congestion, 3=accident, 4=construction, 5=parking, 6=announcement, 7=other
    if (type === 2 || type === 3) return 'congested';
    if (type === 4) return 'slow';
    return 'smooth';
  }

  private classifySpeedByRoadClass(speed: number, roadClass: number): 'smooth' | 'slow' | 'congested' {
    // Handle invalid speed
    if (speed === -99 || speed < 0) return 'smooth';
    
    let thresholds: { smooth: number; slow: number };
    
    switch (roadClass) {
      case 0: // 國道
        thresholds = { smooth: 80, slow: 50 };
        break;
      case 1: // 快速道路
      case 2: // 市區快速道路
        thresholds = { smooth: 60, slow: 40 };
        break;
      case 7: // 匝道
        thresholds = { smooth: 50, slow: 30 };
        break;
      default: // 一般道路
        thresholds = { smooth: 40, slow: 25 };
        break;
    }
    
    if (speed >= thresholds.smooth) return 'smooth';
    if (speed >= thresholds.slow) return 'slow';
    return 'congested';
  }
}
