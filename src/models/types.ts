// Core data models and interfaces

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  coordinates: Coordinates;
  address?: string;
  placeId?: string;
}

export interface Route {
  origin: Coordinates;
  destination: Coordinates;
  waypoints?: Coordinates[];
}

export interface ParkingFacility {
  id: string;
  name: string;
  address: string;
  location: Coordinates;
  totalSpaces: number;
  availableSpaces: number;
  fee: string;
  distance: number; // in meters
  type: 'parking_lot' | 'street_parking';
  
  // 特殊車位資訊
  heavyMotorcycleSpaces?: number;
  chargingSpaces?: number;
  handicapSpaces?: number;
  womenChildrenSpaces?: number;
  
  // 收費細節
  hourlyRate?: string;
  monthlyRate?: string;
  motorcycleMonthlyRate?: string;
  
  // 原始資料（用於解析）
  description?: string;
  fareDescription?: string;
  serviceTime?: string;
}

export type SearchRadius = 500 | 1000 | 2000; // in meters

export type VehicleType = 'car' | 'motorcycle' | 'all';

export interface TrafficInfo {
  id: string;
  type: 'message' | 'flow';
  location: Coordinates;
  distance: number; // in meters
  road: {
    name: string;
    direction?: string;
    class?: number;
  };
  message?: {
    text: string;
    messageType?: number;
    priority?: number;
  };
  flow?: {
    speed: number;
    occupancy: number;
    volume: number;
    level: TrafficLevel;
  };
  updateTime: string;
}

export enum TrafficLevel {
  SMOOTH = 'smooth',
  BUSY = 'busy',
  CONGESTED = 'congested',
  SEVERE = 'severe',
  UNKNOWN = 'unknown'
}

export interface TrafficEvent {
  id: string;
  type: 'accident' | 'construction' | 'congestion';
  location: Coordinates;
  description: string;
  estimatedImpact: number; // in minutes
  startTime: Date;
}

export interface BackendConfig {
  type: 'supabase';
  connectionString: string;
}

export interface UserConfig {
  userId: string;
  tdxApiKey: string; // encrypted
  backendConfig?: BackendConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigSummary {
  hasApiKey: boolean;
  backendType: string;
  configuredAt: Date;
}
