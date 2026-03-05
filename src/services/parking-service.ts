import { Coordinates, ParkingFacility, SearchRadius } from '../models/types';
import { TdxApiClientImpl } from '../integrations/tdx-client';
import { transformTdxParking } from '../models/tdx-types';
import { CacheLayer } from './cache';
import { LocationParser } from '../utils/location-parser';

export interface ParkingService {
  searchNearby(
    location: Coordinates,
    radius: SearchRadius,
    apiKey: string
  ): Promise<ParkingFacility[]>;

  formatParkingInfo(facilities: ParkingFacility[]): string;

  generateNavigationLink(facility: ParkingFacility): string;
}

export class ParkingServiceImpl implements ParkingService {
  private tdxClient: TdxApiClientImpl;
  private cache: CacheLayer;
  private locationParser: LocationParser;

  constructor(tdxClient: TdxApiClientImpl, cache: CacheLayer) {
    this.tdxClient = tdxClient;
    this.cache = cache;
    this.locationParser = new LocationParser();
  }

  async searchNearby(
    location: Coordinates,
    radius: SearchRadius,
    apiKey: string
  ): Promise<ParkingFacility[]> {
    // Generate cache key
    const cacheKey = this.cache.generateKey('parking', {
      lat: location.latitude,
      lon: location.longitude,
      radius,
    });

    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached as ParkingFacility[];
    }

    try {
      // Determine city from coordinates
      const city = this.locationParser.getCityFromCoordinates(location);
      console.log(`Querying parking for city: ${city}, location: ${location.latitude},${location.longitude}, radius: ${radius}`);
      
      // Query TDX API
      const response = await this.tdxClient.queryParkingFacilities(
        location,
        radius,
        apiKey,
        city
      );

      // Transform results
      const facilities = transformTdxParking(response, location);
      
      // Filter by radius (since API doesn't support $spatialFilter reliably)
      const filtered = facilities.filter(f => f.distance <= radius);
      
      // Sort by distance
      const sorted = this.sortByDistance(filtered);

      // Cache results
      await this.cache.set(cacheKey, sorted);

      return sorted;
    } catch (error) {
      console.error('Parking query error:', error);
      throw new Error('停車位查詢失敗，請稍後再試');
    }
  }

  formatParkingInfo(facilities: ParkingFacility[]): string {
    if (facilities.length === 0) {
      return '❌ 附近沒有找到停車場';
    }

    const lines = [`🅿️ 找到 ${facilities.length} 個停車場\n`];

    facilities.slice(0, 10).forEach((facility) => {
      lines.push(`📍 ${facility.name}`);
      lines.push(`距離：${facility.distance} 公尺`);
      lines.push(
        `剩餘車位：${facility.availableSpaces} / ${facility.totalSpaces}`
      );
      lines.push(`收費：${facility.fee || '資訊未提供'}`);
      lines.push(`[📍 導航](${this.generateNavigationLink(facility)})\n`);
    });

    if (facilities.length > 10) {
      lines.push(`\n還有 ${facilities.length - 10} 個停車場...`);
    }

    return lines.join('\n');
  }

  generateNavigationLink(facility: ParkingFacility): string {
    const { latitude, longitude } = facility.location;
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }

  private sortByDistance(facilities: ParkingFacility[]): ParkingFacility[] {
    return facilities.sort((a, b) => a.distance - b.distance);
  }
}
