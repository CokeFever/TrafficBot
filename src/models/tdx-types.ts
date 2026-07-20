// TDX API response models

export interface TdxParkingResponse {
  ParkingAvailabilities: Array<{
    CarParkID: string;
    CarParkName: {
      Zh_tw: string;
      En: string;
    };
    Address: string;
    Position: {
      PositionLat: number;
      PositionLon: number;
    };
    TotalSpaces: number;
    AvailableSpaces: number;
    ChargeDescription: {
      Zh_tw: string;
    };
    UpdateTime: string;
  }>;
}

export interface TdxOnStreetParkingResponse {
  ParkingSegments: Array<{
    ParkingSegmentID: string;
    ParkingSegmentName?: { Zh_tw: string; En?: string };
    RoadName?: string;
    RoadSection?: string;
    Direction?: string;
    Position?: { PositionLat: number; PositionLon: number };
    ParkingSegmentPosition?: { PositionLat: number; PositionLon: number };
    TotalSpaces?: number;
    ParkingType?: string; // 'Car' | 'Motorcycle' | 'HeavyMotorcycle'
    FareDescription?: { Zh_tw: string } | string;
    ServiceTime?: string;
    AvailableSpaces?: number;
    UpdateTime?: string;
  }>;
}

export interface TdxTrafficResponse {
  LiveTraffics: Array<{
    RoadID: string;
    RoadName: string;
    Speed: number;
    TravelTime: number;
    Geometry: string; // WKT format
    UpdateTime: string;
  }>;
}

export interface TdxEventResponse {
  Alerts: Array<{
    AlertID: string;
    AlertType: string;
    Description: string;
    Position: {
      PositionLat: number;
      PositionLon: number;
    };
    StartTime: string;
    EndTime?: string;
  }>;
}

// Data transformation functions
import { ParkingFacility, TrafficEvent, Coordinates } from './types';

// 解析特殊車位資訊
interface SpecialSpaces {
  heavyMotorcycle?: number;
  charging?: number;
  handicap?: number;
  womenChildren?: number;
}

function parseSpecialSpaces(description: string): SpecialSpaces {
  const result: SpecialSpaces = {};
  
  if (!description) return result;
  
  // 大型重機
  const motorcycleMatch = description.match(/大[型重]?重?機[：:]?(\d+)格/);
  if (motorcycleMatch) {
    const count = parseInt(motorcycleMatch[1]);
    if (count > 0) {
      result.heavyMotorcycle = count;
    }
  }
  
  // 充電格位
  const chargingMatch = description.match(/充電格?位[：:]?(\d+)[格個]/);
  if (chargingMatch) {
    const count = parseInt(chargingMatch[1]);
    if (count > 0) {
      result.charging = count;
    }
  }
  
  // 身心障礙停車位
  const handicapMatch = description.match(/身心障礙停車位(\d+)格/);
  if (handicapMatch) {
    const count = parseInt(handicapMatch[1]);
    if (count > 0) {
      result.handicap = count;
    }
  }
  
  // 孕婦、育有六歲以下兒童停車位
  const womenChildrenMatch = description.match(/孕婦、育有六歲以下兒童停車位(\d+)格/);
  if (womenChildrenMatch) {
    const count = parseInt(womenChildrenMatch[1]);
    if (count > 0) {
      result.womenChildren = count;
    }
  }
  
  return result;
}

// 解析收費資訊
interface FareInfo {
  hourlyRate?: string;
  monthlyRate?: string;
  motorcycleMonthlyRate?: string;
}

function parseFareInfo(fareDescription: string): FareInfo {
  const result: FareInfo = {};
  
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

export function transformTdxParking(
  tdxData: TdxParkingResponse,
  referencePoint: Coordinates
): ParkingFacility[] {
  const results = tdxData.ParkingAvailabilities.map((item): ParkingFacility | null => {
    // Handle both Position (availability API) and CarParkPosition (nearby API)
    const position = (item as any).Position || (item as any).CarParkPosition;
    const lat = position?.PositionLat;
    const lon = position?.PositionLon;
    
    if (!lat || !lon) {
      console.warn(`Missing position for parking lot: ${item.CarParkID}`);
      return null;
    }
    
    const location = { latitude: lat, longitude: lon };
    
    // 取得描述和收費資訊
    const description = (item as any).Description || '';
    const fareDescription = typeof item.ChargeDescription === 'string' 
      ? item.ChargeDescription 
      : (item.ChargeDescription?.Zh_tw || (item as any).FareDescription || '');
    
    // 解析特殊車位
    const specialSpaces = parseSpecialSpaces(description);
    
    // 解析收費資訊
    const fareInfo = parseFareInfo(fareDescription);
    
    return {
      id: item.CarParkID,
      name: typeof item.CarParkName === 'string' ? item.CarParkName : (item.CarParkName?.Zh_tw || item.CarParkName?.En || item.CarParkID),
      address: typeof item.Address === 'string' ? item.Address : (item.Address as any)?.Zh_tw || '',
      location,
      totalSpaces: item.TotalSpaces || 0,
      availableSpaces: item.AvailableSpaces || 0,
      fee: fareDescription || '資訊未提供',
      distance: calculateDistance(referencePoint, location),
      type: 'parking_lot',
      
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
      serviceTime: (item as any).ServiceTime,
    };
  });
  
  return results.filter((item): item is ParkingFacility => item !== null);
}

export function transformTdxOnStreetParking(
  tdxData: TdxOnStreetParkingResponse,
  referencePoint: Coordinates
): ParkingFacility[] {
  const results = tdxData.ParkingSegments.map((segment): ParkingFacility | null => {
    const position = segment.Position || segment.ParkingSegmentPosition;
    const lat = position?.PositionLat;
    const lon = position?.PositionLon;
    
    if (!lat || !lon) {
      return null;
    }
    
    const location = { latitude: lat, longitude: lon };
    
    // Build name from road info
    const segmentName = segment.ParkingSegmentName?.Zh_tw || '';
    const roadName = segment.RoadName || '';
    const roadSection = segment.RoadSection || '';
    const name = segmentName || `${roadName}${roadSection ? ` (${roadSection})` : ''}` || segment.ParkingSegmentID;
    
    // Parse fare description
    const fareDescription = typeof segment.FareDescription === 'string' 
      ? segment.FareDescription 
      : segment.FareDescription?.Zh_tw || '';
    const fareInfo = parseFareInfo(fareDescription);
    
    return {
      id: segment.ParkingSegmentID,
      name,
      address: `${roadName}${roadSection ? ` ${roadSection}` : ''}`,
      location,
      totalSpaces: segment.TotalSpaces || 0,
      availableSpaces: segment.AvailableSpaces ?? -1,
      fee: fareDescription || '資訊未提供',
      distance: calculateDistance(referencePoint, location),
      type: 'street_parking',
      
      // Fare details
      hourlyRate: fareInfo.hourlyRate,
      monthlyRate: fareInfo.monthlyRate,
      motorcycleMonthlyRate: fareInfo.motorcycleMonthlyRate,
      
      // Raw data
      fareDescription,
      serviceTime: segment.ServiceTime,
    };
  });
  
  return results.filter((item): item is ParkingFacility => item !== null);
}

export function transformTdxEvents(tdxData: TdxEventResponse): TrafficEvent[] {
  return tdxData.Alerts.map((alert) => ({
    id: alert.AlertID,
    type: mapAlertType(alert.AlertType),
    location: {
      latitude: alert.Position.PositionLat,
      longitude: alert.Position.PositionLon,
    },
    description: alert.Description,
    estimatedImpact: 15, // Default estimate
    startTime: new Date(alert.StartTime),
  }));
}

function mapAlertType(alertType: string): 'accident' | 'construction' | 'congestion' {
  const type = alertType.toLowerCase();
  if (type.includes('accident') || type.includes('事故')) return 'accident';
  if (type.includes('construction') || type.includes('施工')) return 'construction';
  return 'congestion';
}

// Haversine formula for distance calculation
function calculateDistance(point1: Coordinates, point2: Coordinates): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (point1.latitude * Math.PI) / 180;
  const φ2 = (point2.latitude * Math.PI) / 180;
  const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
}
