import { Route, TrafficInfo, TrafficEvent } from '../models/types';
import { TdxApiClientImpl, GeoBounds } from '../integrations/tdx-client';
import { transformTdxEvents } from '../models/tdx-types';

export interface TrafficService {
  queryRouteTraffic(route: Route, apiKey: string): Promise<TrafficInfo>;
  queryTrafficEvents(route: Route, apiKey: string): Promise<TrafficEvent[]>;
  formatTrafficInfo(info: TrafficInfo, events: TrafficEvent[]): string;
}

export class TrafficServiceImpl implements TrafficService {
  private tdxClient: TdxApiClientImpl;

  constructor(tdxClient: TdxApiClientImpl) {
    this.tdxClient = tdxClient;
  }

  async queryRouteTraffic(route: Route, apiKey: string): Promise<TrafficInfo> {
    const bounds = this.calculateBounds(route);

    try {
      const response = await this.tdxClient.queryTrafficFlow(bounds, apiKey);

      // Analyze traffic data
      const avgSpeed = this.calculateAverageSpeed(response.LiveTraffics);
      const status = this.classifyTrafficStatus(avgSpeed);
      const distance = this.calculateDistance(route.origin, route.destination);
      const estimatedDuration = this.estimateDuration(distance, avgSpeed);

      return {
        status,
        estimatedDuration,
        distance,
      };
    } catch (error) {
      throw new Error('車流查詢失敗，請稍後再試');
    }
  }

  async queryTrafficEvents(
    route: Route,
    apiKey: string
  ): Promise<TrafficEvent[]> {
    const bounds = this.calculateBounds(route);

    try {
      const response = await this.tdxClient.queryTrafficEvents(bounds, apiKey);
      return transformTdxEvents(response);
    } catch (error) {
      return []; // Return empty array if events query fails
    }
  }

  formatTrafficInfo(info: TrafficInfo, events: TrafficEvent[]): string {
    const lines = ['🚗 路線車流狀況\n'];

    lines.push(`距離：${info.distance.toFixed(1)} 公里`);
    lines.push(`預估時間：${info.estimatedDuration} 分鐘\n`);

    const statusIcon = this.getStatusIcon(info.status);
    const statusText = this.getStatusText(info.status);
    lines.push(`整體狀況：${statusIcon} ${statusText}\n`);

    if (events.length > 0) {
      lines.push('⚠️ 交通事故');
      events.forEach((event) => {
        lines.push(`類型：${this.getEventTypeText(event.type)}`);
        lines.push(`說明：${event.description}`);
        lines.push(`預估影響：+${event.estimatedImpact} 分鐘\n`);
      });
    }

    return lines.join('\n');
  }

  private calculateBounds(route: Route): GeoBounds {
    const lats = [route.origin.latitude, route.destination.latitude];
    const lons = [route.origin.longitude, route.destination.longitude];

    if (route.waypoints) {
      route.waypoints.forEach((wp) => {
        lats.push(wp.latitude);
        lons.push(wp.longitude);
      });
    }

    // Add buffer of 0.1 degrees (~11km)
    const buffer = 0.1;
    return {
      north: Math.max(...lats) + buffer,
      south: Math.min(...lats) - buffer,
      east: Math.max(...lons) + buffer,
      west: Math.min(...lons) - buffer,
    };
  }

  private calculateAverageSpeed(traffics: any[]): number {
    if (traffics.length === 0) return 60; // Default speed

    const totalSpeed = traffics.reduce((sum, t) => sum + (t.Speed || 60), 0);
    return totalSpeed / traffics.length;
  }

  private classifyTrafficStatus(
    avgSpeed: number
  ): 'smooth' | 'congested' | 'heavy_congestion' {
    if (avgSpeed >= 50) return 'smooth';
    if (avgSpeed >= 30) return 'congested';
    return 'heavy_congestion';
  }

  private calculateDistance(from: any, to: any): number {
    const R = 6371; // Earth radius in km
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private estimateDuration(distanceKm: number, avgSpeed: number): number {
    return Math.round((distanceKm / avgSpeed) * 60);
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'smooth':
        return '🟢';
      case 'congested':
        return '🟡';
      case 'heavy_congestion':
        return '🔴';
      default:
        return '⚪';
    }
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'smooth':
        return '順暢';
      case 'congested':
        return '壅塞';
      case 'heavy_congestion':
        return '嚴重壅塞';
      default:
        return '未知';
    }
  }

  private getEventTypeText(type: string): string {
    switch (type) {
      case 'accident':
        return '車輛事故';
      case 'construction':
        return '道路施工';
      case 'congestion':
        return '交通壅塞';
      default:
        return '其他';
    }
  }
}
