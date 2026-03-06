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
}

export type SearchRadius = 500 | 1000 | 2000; // in meters

export interface TrafficInfo {
  status: 'smooth' | 'congested' | 'heavy_congestion';
  estimatedDuration: number; // in minutes
  distance: number; // in kilometers
}

export interface TrafficEvent {
  id: string;
  type: 'accident' | 'construction' | 'congestion';
  location: Coordinates;
  description: string;
  estimatedImpact: number; // in minutes
  startTime: Date;
}

export interface TimeRange {
  startHour: number; // 0-23
  endHour: number; // 0-23
}

export interface NotificationPreferences {
  enabled: boolean;
  timeRanges?: TimeRange[];
}

export interface RoutineRoute {
  id: string;
  userId: string;
  name: string;
  origin: Coordinates;
  destination: Coordinates;
  createdAt: Date;
  updatedAt: Date;
  notificationPreferences?: NotificationPreferences;
}

export interface NotificationRecord {
  id: string;
  routeId: string;
  userId: string;
  trafficStatus: string;
  eventIds: string[];
  sentAt: Date;
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
