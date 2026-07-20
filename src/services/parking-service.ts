import { Coordinates, ParkingFacility, SearchRadius, VehicleType } from '../models/types';
import { TdxApiClientImpl } from '../integrations/tdx-client';
import { transformTdxParking, transformTdxOnStreetParking } from '../models/tdx-types';
import { CacheLayer } from './cache';
import { LocationParser } from '../utils/location-parser';

export interface ParkingService {
  searchNearby(
    location: Coordinates,
    radius: SearchRadius,
    apiKey: string,
    vehicleType?: VehicleType
  ): Promise<ParkingFacility[]>;

  formatParkingInfo(facilities: ParkingFacility[]): string;

  generateNavigationLink(facility: ParkingFacility): string;
}

export class ParkingServiceImpl implements ParkingService {
  private tdxClient: TdxApiClientImpl;
  private cache: CacheLayer;
  private locationParser: LocationParser;

  // Cache TTLs
  private static readonly STATIC_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for static data (lot info, location, fare)
  private static readonly AVAILABILITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for availability data

  constructor(tdxClient: TdxApiClientImpl, cache: CacheLayer) {
    this.tdxClient = tdxClient;
    this.cache = cache;
    this.locationParser = new LocationParser();
  }

  async searchNearby(
    location: Coordinates,
    radius: SearchRadius,
    apiKey: string,
    vehicleType: VehicleType = 'all'
  ): Promise<ParkingFacility[]> {
    // Cache key for final combined result (short TTL - includes availability)
    const resultCacheKey = this.cache.generateKey('parking:result', {
      lat: location.latitude,
      lon: location.longitude,
      radius,
      vehicleType,
    });

    // Check availability cache first (short-lived)
    const cachedResult = await this.cache.get(resultCacheKey);
    if (cachedResult) {
      return cachedResult as ParkingFacility[];
    }

    try {
      // Determine city from coordinates
      const city = this.locationParser.getCityFromCoordinates(location);
      if (!city) {
        throw new Error('此位置不在支援的城市範圍內');
      }
      console.log(`Querying parking for city: ${city}, vehicle: ${vehicleType}, location: ${location.latitude},${location.longitude}, radius: ${radius}`);
      
      // Query TDX API - OffStreet (路外停車場)
      const offStreetResponse = await this.tdxClient.queryParkingFacilities(
        location,
        radius,
        apiKey,
        city
      );

      // Transform OffStreet results
      let offStreetFacilities = transformTdxParking(offStreetResponse, location);
      
      // For motorcycle queries, filter OffStreet to only show those with motorcycle spaces
      if (vehicleType === 'motorcycle') {
        offStreetFacilities = offStreetFacilities.filter(f => 
          f.heavyMotorcycleSpaces && f.heavyMotorcycleSpaces > 0
        );
      }
      
      // Query TDX API - OnStreet (路邊停車)
      let onStreetFacilities: ParkingFacility[] = [];
      try {
        const onStreetResponse = await this.tdxClient.queryOnStreetParking(
          location,
          radius,
          apiKey,
          city,
          vehicleType
        );
        onStreetFacilities = transformTdxOnStreetParking(onStreetResponse, location);
      } catch (error) {
        // OnStreet data may not be available for all cities, continue with OffStreet only
        console.warn('OnStreet parking query failed, using OffStreet only:', error);
      }
      
      // Combine both results
      const allFacilities = [...offStreetFacilities, ...onStreetFacilities];
      
      // Filter by radius (since API doesn't support $spatialFilter reliably)
      const filtered = allFacilities.filter(f => f.distance <= radius);
      
      // Sort by distance
      const sorted = this.sortByDistance(filtered);

      // Cache combined result with short TTL (availability data changes frequently)
      await this.cache.set(resultCacheKey, sorted, ParkingServiceImpl.AVAILABILITY_CACHE_TTL);
      
      // Also cache static info separately with long TTL for future optimization
      const staticCacheKey = this.cache.generateKey('parking:static', {
        lat: location.latitude,
        lon: location.longitude,
        radius,
      });
      const staticData = sorted.map(f => ({
        id: f.id,
        name: f.name,
        address: f.address,
        location: f.location,
        type: f.type,
        fee: f.fee,
        fareDescription: f.fareDescription,
        serviceTime: f.serviceTime,
        description: f.description,
        distance: f.distance,
        heavyMotorcycleSpaces: f.heavyMotorcycleSpaces,
        chargingSpaces: f.chargingSpaces,
        handicapSpaces: f.handicapSpaces,
        womenChildrenSpaces: f.womenChildrenSpaces,
        hourlyRate: f.hourlyRate,
        monthlyRate: f.monthlyRate,
        motorcycleMonthlyRate: f.motorcycleMonthlyRate,
      }));
      await this.cache.set(staticCacheKey, staticData, ParkingServiceImpl.STATIC_CACHE_TTL);

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

    // Count by category
    const offStreetCount = facilities.filter(f => f.type !== 'street_parking').length;
    const onStreetCount = facilities.filter(f => f.type === 'street_parking').length;
    let countDetail = '';
    if (offStreetCount > 0 && onStreetCount > 0) {
      countDetail = `（🅿️停車場 ${offStreetCount} + 🛣️路邊 ${onStreetCount}）`;
    }

    const lines = [`🅿️ 找到 ${facilities.length} 個停車位${countDetail}\n`];

    facilities.slice(0, 10).forEach((facility, index) => {
      // 類型標示
      const categoryIcon = facility.type === 'street_parking' ? '🛣️' : '🅿️';
      const categoryLabel = facility.type === 'street_parking' ? '路邊' : '停車場';
      lines.push(`${categoryIcon} ${facility.name}（${categoryLabel}）`);
      
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
      
      // 營業時間
      if (facility.serviceTime) {
        lines.push(`🕐 ${facility.serviceTime}`);
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
