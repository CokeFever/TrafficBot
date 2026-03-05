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

export function transformTdxParking(
  tdxData: TdxParkingResponse,
  referencePoint: Coordinates
): ParkingFacility[] {
  return tdxData.ParkingAvailabilities.map((item) => {
    // Handle both Position (availability API) and CarParkPosition (nearby API)
    const position = (item as any).Position || (item as any).CarParkPosition;
    const lat = position?.PositionLat;
    const lon = position?.PositionLon;
    
    if (!lat || !lon) {
      console.warn(`Missing position for parking lot: ${item.CarParkID}`);
      return null;
    }
    
    const location = { latitude: lat, longitude: lon };
    
    return {
      id: item.CarParkID,
      name: typeof item.CarParkName === 'string' ? item.CarParkName : (item.CarParkName?.Zh_tw || item.CarParkName?.En || item.CarParkID),
      address: typeof item.Address === 'string' ? item.Address : (item.Address as any)?.Zh_tw || '',
      location,
      totalSpaces: item.TotalSpaces || 0,
      availableSpaces: item.AvailableSpaces || 0,
      fee: typeof item.ChargeDescription === 'string' ? item.ChargeDescription : (item.ChargeDescription?.Zh_tw || '資訊未提供'),
      distance: calculateDistance(referencePoint, location),
      type: 'parking_lot',
    };
  }).filter((item): item is ParkingFacility => item !== null);
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
