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

    facilities.slice(0, 10).forEach((facility, index) => {
      lines.push(`📍 ${facility.name}`);
      
      // 距離
      lines.push(`距離：${facility.distance}m`);
      
      // 車位
      if (facility.totalSpaces > 0) {
        lines.push(`車位：${facility.availableSpaces} / ${facility.totalSpaces}`);
      } else {
        lines.push(`車位：未提供`);
      }
      
      lines.push(''); // 空行
      
      // 特殊車位（只有 > 0 才顯示，不加單位）
      const specialLines: string[] = [];
      
      if (facility.heavyMotorcycleSpaces && facility.heavyMotorcycleSpaces > 0) {
        specialLines.push(`🏍️ 重機：${facility.heavyMotorcycleSpaces}`);
      }
      if (facility.chargingSpaces && facility.chargingSpaces > 0) {
        specialLines.push(`⚡ 充電：${facility.chargingSpaces}`);
      }
      if (facility.handicapSpaces && facility.handicapSpaces > 0) {
        specialLines.push(`♿ 殘障：${facility.handicapSpaces}`);
      }
      if (facility.womenChildrenSpaces && facility.womenChildrenSpaces > 0) {
        specialLines.push(`👶 婦幼：${facility.womenChildrenSpaces}`);
      }
      
      if (specialLines.length > 0) {
        lines.push(...specialLines);
        lines.push(''); // 空行
      }
      
      // 收費
      if (facility.fareDescription) {
        lines.push('收費：');
        if (facility.hourlyRate) {
          lines.push(`- 計時：${facility.hourlyRate}`);
        }
        if (facility.monthlyRate) {
          lines.push(`- 月租：${facility.monthlyRate}`);
        }
        if (facility.motorcycleMonthlyRate) {
          lines.push(`- 重機月租：${facility.motorcycleMonthlyRate}`);
        }
        
        // 如果沒有解析出細節，顯示原始說明（簡化版）
        if (!facility.hourlyRate && !facility.monthlyRate) {
          // 簡化收費說明（最多顯示前 100 字）
          const simpleFare = facility.fareDescription.length > 100 
            ? facility.fareDescription.substring(0, 100) + '...' 
            : facility.fareDescription;
          lines.push(simpleFare);
        }
      } else {
        lines.push('收費：未提供');
      }
      
      // 導航連結
      lines.push(`[📍 導航](${this.generateNavigationLink(facility)})`);
      
      // 分隔線（除了最後一個）
      if (index < Math.min(facilities.length, 10) - 1) {
        lines.push('\n---\n');
      }
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
