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
