import { Coordinates } from '../models/types';
import {
  TdxParkingResponse,
  TdxOnStreetParkingResponse,
  TdxTrafficResponse,
  TdxEventResponse,
} from '../models/tdx-types';

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TdxApiClient {
  queryParkingFacilities(
    center: Coordinates,
    radius: number,
    apiKey: string,
    city?: string
  ): Promise<TdxParkingResponse>;

  queryOnStreetParking(
    center: Coordinates,
    radius: number,
    apiKey: string,
    city?: string
  ): Promise<TdxOnStreetParkingResponse>;

  queryTrafficFlow(
    bounds: GeoBounds,
    apiKey: string
  ): Promise<TdxTrafficResponse>;

  queryTrafficEvents(
    bounds: GeoBounds,
    apiKey: string
  ): Promise<TdxEventResponse>;

  makeRequest<T>(
    endpoint: string,
    params: Record<string, any>,
    apiKey: string,
    retries?: number
  ): Promise<T>;
}

class ApiError extends Error {
  constructor(
    public statusCode: number,
    public statusText: string
  ) {
    super(`API Error: ${statusCode} ${statusText}`);
    this.name = 'ApiError';
  }
}

class MaxRetriesExceededError extends Error {
  constructor(public lastError: Error) {
    super(`Max retries exceeded. Last error: ${lastError.message}`);
    this.name = 'MaxRetriesExceededError';
  }
}

export class TdxApiClientImpl implements TdxApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number = 10000; // 10 seconds
  private tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  constructor(baseUrl: string = 'https://tdx.transportdata.tw/api/basic') {
    this.baseUrl = baseUrl;
  }

  private async getAccessToken(apiKey: string): Promise<string> {
    // Check cache first
    const cached = this.tokenCache.get(apiKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    // apiKey format: "clientId:clientSecret"
    const [clientId, clientSecret] = apiKey.split(':');
    
    if (!clientId || !clientSecret) {
      throw new Error('Invalid API key format. Expected "clientId:clientSecret"');
    }

    // Get new access token
    const tokenUrl = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
    
    const tokenParams = new URLSearchParams();
    tokenParams.append('grant_type', 'client_credentials');
    tokenParams.append('client_id', clientId);
    tokenParams.append('client_secret', clientSecret);

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get access token: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }

    const tokenData: any = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 3600; // Default 1 hour

    if (!accessToken) {
      throw new Error('No access token in response');
    }

    // Cache token (expire 5 minutes before actual expiry for safety)
    this.tokenCache.set(apiKey, {
      token: accessToken,
      expiresAt: Date.now() + (expiresIn - 300) * 1000,
    });

    return accessToken;
  }

  async queryParkingFacilities(
    center: Coordinates,
    radius: number,
    apiKey: string,
    city?: string
  ): Promise<TdxParkingResponse> {
    // Use provided city or default to Taipei
    const cityName = city || 'Taipei';
    
    console.log(`Querying parking for city: ${cityName}, location: ${center.latitude},${center.longitude}, radius: ${radius}`);
    
    // Step 1: Get nearby parking lots (static data) using Advanced API
    const nearbyEndpoint = 'https://tdx.transportdata.tw/api/advanced/v1/Parking/OffStreet/CarPark/NearBy';
    const nearbyUrl = `${nearbyEndpoint}?$format=JSON&$spatialFilter=nearby(${center.latitude}, ${center.longitude}, ${radius})`;
    
    console.log(`Fetching nearby parking lots: ${nearbyUrl}`);
    
    const accessToken = await this.getAccessToken(apiKey);
    
    // Fetch nearby parking lots
    const nearbyResponse = await fetch(nearbyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept-Encoding': 'gzip',
      },
    });
    
    if (!nearbyResponse.ok) {
      throw new ApiError(nearbyResponse.status, nearbyResponse.statusText);
    }
    
    const nearbyData: any = await nearbyResponse.json();
    const carParks = Array.isArray(nearbyData) ? nearbyData : (nearbyData.CarParks || []);
    
    if (carParks.length === 0) {
      return { ParkingAvailabilities: [] };
    }
    
    console.log(`Found ${carParks.length} nearby parking lots`);
    
    // Step 2: Get availability data using $filter with specific CarParkIDs (instead of fetching entire city)
    const carParkIds = carParks.map((p: any) => p.CarParkID).filter(Boolean);
    
    // TDX $filter supports OData syntax: CarParkID eq 'X' or CarParkID eq 'Y'
    // Limit to 30 IDs per request to avoid URL length issues
    const batchSize = 30;
    const batches = [];
    for (let i = 0; i < carParkIds.length; i += batchSize) {
      batches.push(carParkIds.slice(i, i + batchSize));
    }
    
    let allAvailabilities: any[] = [];
    
    for (const batch of batches) {
      const filterExpr = batch.map((id: string) => `CarParkID eq '${id}'`).join(' or ');
      const availEndpoint = `${this.baseUrl}/v1/Parking/OffStreet/ParkingAvailability/City/${cityName}`;
      const availUrl = `${availEndpoint}?$format=JSON&$filter=${filterExpr}`;
      
      console.log(`Fetching availability for ${batch.length} parking lots`);
      
      const availResponse = await fetch(availUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept-Encoding': 'gzip',
        },
      });
      
      if (!availResponse.ok) {
        console.warn(`Availability fetch failed: ${availResponse.status}, falling back to unfiltered query`);
        // Fallback: fetch all availability for the city
        const fallbackUrl = `${availEndpoint}?$format=JSON`;
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept-Encoding': 'gzip',
          },
        });
        if (fallbackResponse.ok) {
          const fallbackData: any = await fallbackResponse.json();
          allAvailabilities = fallbackData.ParkingAvailabilities || fallbackData || [];
        }
        break;
      }
      
      const availData: any = await availResponse.json();
      const availabilities = availData.ParkingAvailabilities || availData || [];
      allAvailabilities.push(...availabilities);
    }
    
    console.log(`Found ${allAvailabilities.length} availability records`);
    
    // Step 3: Match parking lots with availability data
    const availMap = new Map();
    allAvailabilities.forEach((avail: any) => {
      availMap.set(avail.CarParkID, avail);
    });
    
    // Combine data - merge static info from carParks with availability data
    const combined = carParks
      .map((park: any) => {
        const avail = availMap.get(park.CarParkID);
        if (!avail) return null;
        
        return {
          ...avail,
          CarParkName: park.CarParkName,
          CarParkPosition: park.CarParkPosition,
          Address: park.Address,
          Description: park.Description,  // 加入描述（包含特殊車位資訊）
          FareDescription: park.FareDescription,  // 加入收費說明
          ServiceTime: park.ServiceTime,  // 加入營業時間
        };
      })
      .filter((item: any) => item !== null);
    
    return { ParkingAvailabilities: combined };
  }

  async queryOnStreetParking(
    center: Coordinates,
    radius: number,
    apiKey: string,
    city?: string,
    vehicleType?: string
  ): Promise<TdxOnStreetParkingResponse> {
    const cityName = city || 'Taipei';
    
    console.log(`Querying on-street parking for city: ${cityName}, vehicle: ${vehicleType || 'car'}, location: ${center.latitude},${center.longitude}, radius: ${radius}`);
    
    const accessToken = await this.getAccessToken(apiKey);
    
    // Step 1: Get on-street parking segments for the city
    const segmentUrl = `${this.baseUrl}/v1/Parking/OnStreet/ParkingSegment/City/${cityName}?$format=JSON&$spatialFilter=nearby(${center.latitude},${center.longitude},${radius})`;
    
    console.log(`Fetching on-street segments: ${segmentUrl}`);
    
    const segmentResponse = await fetch(segmentUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept-Encoding': 'gzip',
      },
    });
    
    if (!segmentResponse.ok) {
      // OnStreet API may not be available for all cities, return empty
      console.warn(`OnStreet segment API failed for ${cityName}: ${segmentResponse.status}`);
      return { ParkingSegments: [] };
    }
    
    const segmentData: any = await segmentResponse.json();
    let segments = Array.isArray(segmentData) ? segmentData : (segmentData.ParkingSegments || []);
    
    // Filter by vehicle type if specified
    if (vehicleType === 'motorcycle') {
      segments = segments.filter((s: any) => {
        const parkingType = (s.ParkingType || '').toLowerCase();
        return parkingType.includes('motorcycle') || parkingType.includes('機車') || parkingType.includes('摩托');
      });
    } else if (vehicleType === 'car') {
      // For car, exclude motorcycle-only segments
      segments = segments.filter((s: any) => {
        const parkingType = (s.ParkingType || '').toLowerCase();
        return !parkingType.includes('motorcycle') || parkingType.includes('car') || parkingType === '';
      });
    }
    
    if (segments.length === 0) {
      return { ParkingSegments: [] };
    }
    
    console.log(`Found ${segments.length} on-street parking segments (filtered for ${vehicleType || 'all'})`);
    
    // Step 2: Get on-street parking availability
    const segmentIds = segments.map((s: any) => s.ParkingSegmentID).filter(Boolean);
    const batchSize = 30;
    let allAvailabilities: any[] = [];
    
    for (let i = 0; i < segmentIds.length; i += batchSize) {
      const batch = segmentIds.slice(i, i + batchSize);
      const filterExpr = batch.map((id: string) => `ParkingSegmentID eq '${id}'`).join(' or ');
      const availUrl = `${this.baseUrl}/v1/Parking/OnStreet/ParkingSegmentAvailability/City/${cityName}?$format=JSON&$filter=${filterExpr}`;
      
      const availResponse = await fetch(availUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept-Encoding': 'gzip',
        },
      });
      
      if (!availResponse.ok) {
        console.warn(`OnStreet availability fetch failed: ${availResponse.status}`);
        // Try unfiltered fallback
        const fallbackUrl = `${this.baseUrl}/v1/Parking/OnStreet/ParkingSegmentAvailability/City/${cityName}?$format=JSON`;
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept-Encoding': 'gzip',
          },
        });
        if (fallbackResponse.ok) {
          const fallbackData: any = await fallbackResponse.json();
          allAvailabilities = Array.isArray(fallbackData) ? fallbackData : (fallbackData.ParkingSegmentAvailabilities || []);
        }
        break;
      }
      
      const availData: any = await availResponse.json();
      const availabilities = Array.isArray(availData) ? availData : (availData.ParkingSegmentAvailabilities || []);
      allAvailabilities.push(...availabilities);
    }
    
    // Step 3: Merge segment info with availability
    const availMap = new Map();
    allAvailabilities.forEach((avail: any) => {
      availMap.set(avail.ParkingSegmentID, avail);
    });
    
    const combined = segments.map((segment: any) => {
      const avail = availMap.get(segment.ParkingSegmentID);
      return {
        ...segment,
        AvailableSpaces: avail?.AvailableSpaces ?? -1,
        UpdateTime: avail?.UpdateTime || '',
      };
    });
    
    return { ParkingSegments: combined };
  }

  async queryTrafficFlow(
    bounds: GeoBounds,
    apiKey: string
  ): Promise<TdxTrafficResponse> {
    const endpoint = `${this.baseUrl}/v2/Traffic/Live/City`;
    
    const params = {
      $filter: `PositionLat ge ${bounds.south} and PositionLat le ${bounds.north} and PositionLon ge ${bounds.west} and PositionLon le ${bounds.east}`,
      $format: 'JSON',
    };

    return this.makeRequest<TdxTrafficResponse>(endpoint, params, apiKey);
  }

  async queryTrafficEvents(
    bounds: GeoBounds,
    apiKey: string
  ): Promise<TdxEventResponse> {
    const endpoint = `${this.baseUrl}/v2/Traffic/Live/Incident/City`;
    
    const params = {
      $filter: `PositionLat ge ${bounds.south} and PositionLat le ${bounds.north} and PositionLon ge ${bounds.west} and PositionLon le ${bounds.east}`,
      $format: 'JSON',
    };

    return this.makeRequest<TdxEventResponse>(endpoint, params, apiKey);
  }

  async makeRequest<T>(
    endpoint: string,
    params: Record<string, any>,
    apiKey: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get access token
        const accessToken = await this.getAccessToken(apiKey);
        
        const url = this.buildUrl(endpoint, params);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new ApiError(response.status, response.statusText);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // Exponential backoff: 2^attempt seconds
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new MaxRetriesExceededError(lastError!);
  }

  private buildUrl(endpoint: string, params: Record<string, any>): string {
    // TDX API requires $format, $spatialFilter, $filter, $top, $skip to NOT be URL-encoded
    // Build URL with special handling for these parameters
    let url = endpoint;
    let hasParams = false;
    
    // Add $format first (not encoded)
    if (params.$format) {
      url += `?$format=${params.$format}`;
      hasParams = true;
    }
    
    // Add $top (not encoded)
    if (params.$top) {
      const separator = hasParams ? '&' : '?';
      url += `${separator}$top=${params.$top}`;
      hasParams = true;
    }
    
    // Add $skip (not encoded)
    if (params.$skip) {
      const separator = hasParams ? '&' : '?';
      url += `${separator}$skip=${params.$skip}`;
      hasParams = true;
    }
    
    // Add $spatialFilter (not encoded)
    if (params.$spatialFilter) {
      const separator = hasParams ? '&' : '?';
      url += `${separator}$spatialFilter=${params.$spatialFilter}`;
      hasParams = true;
    }
    
    // Add $filter (not encoded)
    if (params.$filter) {
      const separator = hasParams ? '&' : '?';
      url += `${separator}$filter=${params.$filter}`;
      hasParams = true;
    }
    
    // Add other params (encoded)
    Object.entries(params).forEach(([key, value]) => {
      if (key !== '$format' && key !== '$spatialFilter' && key !== '$filter' && key !== '$top' && key !== '$skip') {
        const separator = hasParams ? '&' : '?';
        url += `${separator}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
        hasParams = true;
      }
    });
    
    console.log(`Built URL: ${url}`);
    return url;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
