import { Coordinates } from '../models/types';
import {
  TdxParkingResponse,
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
    apiKey: string
  ): Promise<TdxParkingResponse>;

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

  constructor(baseUrl: string = 'https://tdx.transportdata.tw/api/basic') {
    this.baseUrl = baseUrl;
  }

  async queryParkingFacilities(
    center: Coordinates,
    radius: number,
    apiKey: string
  ): Promise<TdxParkingResponse> {
    const endpoint = `${this.baseUrl}/v2/Parking/OffStreet/ParkingAvailability/City`;
    
    const params = {
      $spatialFilter: `nearby(${center.latitude},${center.longitude},${radius})`,
      $format: 'JSON',
    };

    return this.makeRequest<TdxParkingResponse>(endpoint, params, apiKey);
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
        const url = this.buildUrl(endpoint, params);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
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
    const url = new URL(endpoint);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
    return url.toString();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
