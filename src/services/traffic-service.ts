import { Coordinates } from '../models/types';
import { TdxApiClientImpl } from '../integrations/tdx-client';

export interface TrafficData {
  roadName: string;
  speed: number;
  status: 'smooth' | 'slow' | 'congested';
  distance: number;
}

export interface TrafficService {
  queryNearbyTraffic(location: Coordinates, radius: number, apiKey: string): Promise<TrafficData[]>;
  formatTrafficInfo(trafficData: TrafficData[]): string;
}

export class TrafficServiceImpl implements TrafficService {
  private tdxClient: TdxApiClientImpl;

  constructor(tdxClient: TdxApiClientImpl) {
    this.tdxClient = tdxClient;
  }

  async queryNearbyTraffic(location: Coordinates, _radius: number, apiKey: string): Promise<TrafficData[]> {
    try {
      // Try basic API first - VD (Vehicle Detector) data
      // Endpoint: /api/basic/v2/Traffic/Live/VD/City/{City}
      const city = this.getCityFromCoordinates(location);
      const endpoint = `https://tdx.transportdata.tw/api/basic/v2/Traffic/Live/VD/City/${city}`;
      const url = `${endpoint}?$format=JSON&$top=100`;
      
      console.log(`Querying traffic for city: ${city}, location: ${location.latitude},${location.longitude}`);
      console.log(`Traffic API URL: ${url}`);
      
      const accessToken = await (this.tdxClient as any).getAccessToken(apiKey);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept-Encoding': 'gzip',
        },
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const data: any = await response.json();
      const vdData = Array.isArray(data) ? data : (data.VDs || data.LiveTraffics || []);
      
      console.log(`Found ${vdData.length} traffic detection points`);
      
      // Filter by distance and transform
      const trafficData: TrafficData[] = vdData
        .map((vd: any) => {
          const pos = vd.VDPosition || vd.Position || vd.LinkGeometry;
          if (!pos || !pos.PositionLat || !pos.PositionLon) return null;
          
          const distance = this.calculateDistance(
            location,
            { latitude: pos.PositionLat, longitude: pos.PositionLon }
          );
          
          // Filter by 2km radius
          if (distance > 2000) return null;
          
          const speed = vd.Speed || vd.AverageSpeed || vd.SpeedLimit || 0;
          const roadName = vd.RoadName || vd.LinkID || vd.RoadSectionID || '未知路段';
          
          return {
            roadName: typeof roadName === 'string' ? roadName : roadName.Zh_tw || roadName.En || '未知路段',
            speed,
            status: this.classifySpeed(speed),
            distance: Math.round(distance),
          };
        })
        .filter((item: any) => item !== null)
        .sort((a: TrafficData, b: TrafficData) => a.distance - b.distance)
        .slice(0, 10); // Top 10 closest
      
      return trafficData;
    } catch (error) {
      console.error('Traffic query error:', error);
      throw new Error('車流查詢失敗，請稍後再試');
    }
  }
  
  private getCityFromCoordinates(coords: Coordinates): string {
    const { latitude, longitude } = coords;

    // Taiwan major cities boundaries (same as location-parser)
    if (latitude >= 25.0 && latitude <= 25.2 && longitude >= 121.4 && longitude <= 121.7) {
      return 'Taipei';
    }
    if (latitude >= 24.6 && latitude <= 25.3 && longitude >= 121.2 && longitude <= 122.0) {
      return 'NewTaipei';
    }
    if (latitude >= 24.8 && latitude <= 25.1 && longitude >= 121.0 && longitude <= 121.5) {
      return 'Taoyuan';
    }
    if (latitude >= 24.0 && latitude <= 24.3 && longitude >= 120.5 && longitude <= 121.0) {
      return 'Taichung';
    }
    if (latitude >= 22.9 && latitude <= 23.2 && longitude >= 120.1 && longitude <= 120.5) {
      return 'Tainan';
    }
    if (latitude >= 22.5 && latitude <= 22.8 && longitude >= 120.2 && longitude <= 120.5) {
      return 'Kaohsiung';
    }
    if (latitude >= 24.7 && latitude <= 24.9 && longitude >= 120.9 && longitude <= 121.1) {
      return 'Hsinchu';
    }
    return 'Taipei';
  }

  formatTrafficInfo(trafficData: TrafficData[]): string {
    if (trafficData.length === 0) {
      return '😔 附近 2 公里內找不到車流偵測點';
    }

    const lines = [`🚗 附近車流狀況（2 公里內）\n`];
    
    trafficData.forEach((data, index) => {
      const statusIcon = this.getStatusIcon(data.status);
      lines.push(`${index + 1}. ${data.roadName}`);
      lines.push(`   ${statusIcon} ${this.getStatusText(data.status)} - ${data.speed} km/h`);
      lines.push(`   距離：${data.distance} 公尺\n`);
    });
    
    lines.push('💡 資料來源：交通部 TDX 即時車流偵測');
    
    return lines.join('\n');
  }

  private classifySpeed(speed: number): 'smooth' | 'slow' | 'congested' {
    if (speed >= 50) return 'smooth';
    if (speed >= 30) return 'slow';
    return 'congested';
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'smooth':
        return '🟢';
      case 'slow':
        return '🟡';
      case 'congested':
        return '🔴';
      default:
        return '⚪';
    }
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'smooth':
        return '順暢';
      case 'slow':
        return '緩慢';
      case 'congested':
        return '壅塞';
      default:
        return '未知';
    }
  }

  private calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
