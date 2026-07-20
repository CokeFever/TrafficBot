import { Coordinates, SearchRadius } from '../models/types';
import { TdxApiClientImpl } from '../integrations/tdx-client';
import { CacheLayer } from './cache';
import { LocationParser } from '../utils/location-parser';

export interface TrafficData {
  roadName: string;
  speed: number;
  status: 'smooth' | 'slow' | 'congested';
  distance: number;
  messageText?: string;
  messageType?: number;
  direction?: string;
  roadClass?: number;
}

export interface TrafficService {
  queryNearbyTraffic(location: Coordinates, radius: SearchRadius, apiKey: string): Promise<TrafficData[]>;
  formatTrafficInfo(trafficData: TrafficData[]): string;
}

export class TrafficServiceImpl implements TrafficService {
  private tdxClient: TdxApiClientImpl;
  private cache: CacheLayer;
  private locationParser: LocationParser;

  constructor(tdxClient: TdxApiClientImpl, cache: CacheLayer) {
    this.tdxClient = tdxClient;
    this.cache = cache;
    this.locationParser = new LocationParser();
  }

  async queryNearbyTraffic(location: Coordinates, radius: SearchRadius, apiKey: string): Promise<TrafficData[]> {
    // Generate cache key
    const cacheKey = this.cache.generateKey('traffic', {
      lat: location.latitude,
      lon: location.longitude,
      radius,
    });

    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached as TrafficData[];
    }

    try {
      // Determine city from coordinates
      const city = this.locationParser.getCityFromCoordinates(location);
      if (!city) {
        throw new Error('此位置不在支援的城市範圍內');
      }
      console.log(`Querying traffic for city: ${city}, location: ${location.latitude},${location.longitude}, radius: ${radius}`);
      
      // Query CMS (Changeable Message Signs) for traffic messages
      const cmsData = await this.queryCMSData(location, radius, city, apiKey);
      
      // Query VD (Vehicle Detectors) for traffic flow
      const vdData = await this.queryVDData(location, radius, city, apiKey);
      
      // Combine and sort by distance
      const allData = [...cmsData, ...vdData].sort((a, b) => a.distance - b.distance);
      
      // Cache results (5 minutes)
      await this.cache.set(cacheKey, allData, 300);

      return allData;
    } catch (error) {
      console.error('Traffic query error:', error);
      throw new Error('路況查詢失敗，請稍後再試');
    }
  }

  private async queryCMSData(
    location: Coordinates,
    radius: SearchRadius,
    city: string,
    apiKey: string
  ): Promise<TrafficData[]> {
    try {
      const accessToken = await (this.tdxClient as any).getAccessToken(apiKey);
      
      // Step 1: Get nearby CMS devices
      const nearbyUrl = `https://tdx.transportdata.tw/api/advanced/v2/Road/Traffic/CMS/NearBy?$spatialFilter=nearby(${location.latitude},${location.longitude},${radius})&$format=JSON`;
      
      const nearbyResponse = await fetch(nearbyUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (!nearbyResponse.ok) {
        console.error(`CMS NearBy API failed: ${nearbyResponse.status}`);
        return [];
      }
      
      const cmsDevices = await nearbyResponse.json() as any[];
      if (cmsDevices.length === 0) return [];
      
      // Step 2: Get live messages for the city
      const liveUrl = `https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/Live/CMS/City/${city}?$format=JSON`;
      
      const liveResponse = await fetch(liveUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (!liveResponse.ok) {
        console.error(`CMS Live API failed: ${liveResponse.status}`);
        return [];
      }
      
      const liveData = await liveResponse.json() as any;
      const cmsLives = liveData.CMSLives || [];
      
      // Create a map of live data
      const liveMap = new Map();
      cmsLives.forEach((live: any) => {
        liveMap.set(live.CMSID, live);
      });
      
      // Combine nearby devices with live data
      const trafficData: TrafficData[] = [];
      
      for (const device of cmsDevices) {
        const live = liveMap.get(device.CMSID);
        
        // Skip if no live data or no messages
        if (!live || live.MessageStatus === 0 || !live.Messages || live.Messages.length === 0) {
          continue;
        }
        
        const distance = this.calculateDistance(
          location,
          { latitude: device.PositionLat, longitude: device.PositionLon }
        );
        
        // Filter by radius
        if (distance > radius) continue;
        
        // Get the first message (usually the most important)
        const message = live.Messages[0];
        
        trafficData.push({
          roadName: device.RoadName || '未知路段',
          speed: 0,
          status: this.getStatusFromMessageType(message.Type),
          distance: Math.round(distance),
          messageText: message.Text,
          messageType: message.Type,
          direction: device.RoadDirection,
        });
      }
      
      return trafficData;
    } catch (error) {
      console.error('CMS query error:', error);
      return [];
    }
  }

  private async queryVDData(
    location: Coordinates,
    radius: SearchRadius,
    city: string,
    apiKey: string
  ): Promise<TrafficData[]> {
    try {
      const accessToken = await (this.tdxClient as any).getAccessToken(apiKey);
      
      // Step 1: Get nearby VD devices
      const nearbyUrl = `https://tdx.transportdata.tw/api/advanced/v2/Road/Traffic/VD/NearBy?$spatialFilter=nearby(${location.latitude},${location.longitude},${radius})&$format=JSON`;
      
      const nearbyResponse = await fetch(nearbyUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (!nearbyResponse.ok) {
        console.error(`VD NearBy API failed: ${nearbyResponse.status}`);
        return [];
      }
      
      const vdDevices = await nearbyResponse.json() as any[];
      if (vdDevices.length === 0) return [];
      
      // Step 2: Get live flow data for the city
      const liveUrl = `https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/Live/VD/City/${city}?$format=JSON`;
      
      const liveResponse = await fetch(liveUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (!liveResponse.ok) {
        console.error(`VD Live API failed: ${liveResponse.status}`);
        return [];
      }
      
      const liveData = await liveResponse.json() as any;
      const vdLives = liveData.VDLives || [];
      
      // Create a map of live data
      const liveMap = new Map();
      vdLives.forEach((live: any) => {
        liveMap.set(live.VDID, live);
      });
      
      // Combine nearby devices with live data
      const trafficData: TrafficData[] = [];
      
      for (const device of vdDevices) {
        const live = liveMap.get(device.VDID);
        
        // Skip if no live data
        if (!live || !live.LinkFlows || live.LinkFlows.length === 0) {
          continue;
        }
        
        const distance = this.calculateDistance(
          location,
          { latitude: device.PositionLat, longitude: device.PositionLon }
        );
        
        // Filter by radius
        if (distance > radius) continue;
        
        // Calculate average speed from all lanes
        let totalSpeed = 0;
        let laneCount = 0;
        
        for (const link of live.LinkFlows) {
          if (link.Lanes) {
            for (const lane of link.Lanes) {
              if (lane.Speed > 0 && lane.Speed !== -99) {
                totalSpeed += lane.Speed;
                laneCount++;
              }
            }
          }
        }
        
        if (laneCount === 0) continue;
        
        const avgSpeed = Math.round(totalSpeed / laneCount);
        const roadClass = device.RoadClass || 6;
        
        trafficData.push({
          roadName: device.RoadName || '未知路段',
          speed: avgSpeed,
          status: this.classifySpeedByRoadClass(avgSpeed, roadClass),
          distance: Math.round(distance),
          roadClass,
        });
      }
      
      return trafficData;
    } catch (error) {
      console.error('VD query error:', error);
      return [];
    }
  }

  formatTrafficInfo(trafficData: TrafficData[]): string {
    if (trafficData.length === 0) {
      return '❌ 附近沒有找到路況資訊';
    }

    // Filter out normal traffic (within ±10% of expected speed)
    const abnormalTraffic = trafficData.filter(data => {
      if (data.messageText) return true;
      
      if (data.speed > 0 && data.roadClass !== undefined) {
        const expectedSpeed = this.getExpectedSpeed(data.roadClass);
        const deviation = Math.abs(data.speed - expectedSpeed) / expectedSpeed;
        return deviation > 0.1;
      }
      
      return false;
    });

    if (abnormalTraffic.length === 0) {
      return '✅ 附近路況順暢';
    }

    // Sort by severity
    const sorted = abnormalTraffic.sort((a, b) => {
      const severityA = this.getSeverityScore(a);
      const severityB = this.getSeverityScore(b);
      return severityB - severityA;
    });

    // Group by road name
    const grouped = this.groupByRoadName(sorted);

    // Take top 5
    const top5 = grouped.slice(0, 5);

    const lines = [`🚦 附近路況 (${top5.length}則重要資訊)\n`];
    
    top5.forEach((item, index) => {
      if (item.isGroup) {
        const statusIcon = this.getStatusIcon(item.status);
        const roadInfo = `${item.roadName}${item.direction ? ` ${this.getDirectionText(item.direction)}` : ''}`;
        
        lines.push(`${statusIcon} ${roadInfo} (${item.distances})`);
        lines.push(`   ${this.getStatusText(item.status)} ${item.speedRange}`);
      } else {
        const data = item.data!;
        const statusIcon = this.getStatusIcon(data.status);
        const roadInfo = `${data.roadName}${data.direction ? ` ${this.getDirectionText(data.direction)}` : ''}`;
        
        if (data.messageText) {
          lines.push(`${this.getMessageTypeIcon(data.messageType)} ${roadInfo} (${data.distance}m)`);
          lines.push(`   ${data.messageText}`);
        } else if (data.speed > 0) {
          lines.push(`${statusIcon} ${roadInfo} (${data.distance}m)`);
          lines.push(`   ${this.getStatusText(data.status)} ${data.speed}km/h`);
        }
      }
      
      if (index < top5.length - 1) {
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  private groupByRoadName(traffic: TrafficData[]): Array<{
    isGroup: boolean;
    roadName: string;
    direction?: string;
    status: string;
    distances?: string;
    speedRange?: string;
    data?: TrafficData;
    severity: number;
  }> {
    const groups = new Map<string, TrafficData[]>();
    const singles: TrafficData[] = [];
    
    // Separate CMS messages and VD data
    for (const item of traffic) {
      if (item.messageText) {
        // CMS messages are always kept separate
        singles.push(item);
      } else {
        // Group VD data by road name
        const key = item.roadName;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(item);
      }
    }
    
    const result: Array<{
      isGroup: boolean;
      roadName: string;
      direction?: string;
      status: string;
      distances?: string;
      speedRange?: string;
      data?: TrafficData;
      severity: number;
    }> = [];
    
    // Add CMS messages first (they have higher severity)
    for (const item of singles) {
      result.push({
        isGroup: false,
        roadName: item.roadName,
        direction: item.direction,
        status: item.status,
        data: item,
        severity: this.getSeverityScore(item),
      });
    }
    
    // Add grouped VD data
    for (const [roadName, items] of groups.entries()) {
      if (items.length === 1) {
        // Single item, don't group
        result.push({
          isGroup: false,
          roadName: items[0].roadName,
          direction: items[0].direction,
          status: items[0].status,
          data: items[0],
          severity: this.getSeverityScore(items[0]),
        });
      } else {
        // Multiple items - only include abnormal ones (congested or slow)
        const abnormalItems = items.filter(i => i.status === 'congested' || i.status === 'slow');
        
        if (abnormalItems.length === 0) {
          // All items are smooth, skip
          continue;
        } else if (abnormalItems.length === 1) {
          // Only one abnormal item
          result.push({
            isGroup: false,
            roadName: abnormalItems[0].roadName,
            direction: abnormalItems[0].direction,
            status: abnormalItems[0].status,
            data: abnormalItems[0],
            severity: this.getSeverityScore(abnormalItems[0]),
          });
        } else {
          // Multiple abnormal items, group them
          const distances = abnormalItems.map(i => i.distance).sort((a, b) => a - b);
          const speeds = abnormalItems.map(i => i.speed).filter(s => s > 0).sort((a, b) => a - b);
          
          const minDistance = distances[0];
          const maxDistance = distances[distances.length - 1];
          const minSpeed = speeds[0];
          const maxSpeed = speeds[speeds.length - 1];
          
          // Use the most severe status
          const mostSevere = abnormalItems.reduce((max, item) => 
            this.getSeverityScore(item) > this.getSeverityScore(max) ? item : max
          );
          
          result.push({
            isGroup: true,
            roadName,
            direction: abnormalItems[0].direction,
            status: mostSevere.status,
            distances: this.formatDistanceRange(minDistance, maxDistance),
            speedRange: `${minSpeed}~${maxSpeed}km/h`,
            severity: this.getSeverityScore(mostSevere),
          });
        }
      }
    }
    
    // Sort by severity again after grouping
    result.sort((a, b) => b.severity - a.severity);
    
    return result;
  }

  private formatDistanceRange(min: number, max: number): string {
    if (min === max) {
      return `${Math.round(min)}m`;
    }
    
    if (max < 1000) {
      return `${Math.round(min)} - ${Math.round(max)}m`;
    }
    
    if (min < 1000) {
      return `${Math.round(min)}m - ${(max / 1000).toFixed(1)}km`;
    }
    
    return `${(min / 1000).toFixed(1)} - ${(max / 1000).toFixed(1)}km`;
  }

  private getExpectedSpeed(roadClass: number): number {
    // Return expected normal speed for each road class
    switch (roadClass) {
      case 0: return 100; // 國道
      case 1:
      case 2: return 70;  // 快速道路
      case 7: return 60;  // 匝道
      default: return 50; // 一般道路
    }
  }

  private getSeverityScore(data: TrafficData): number {
    // Higher score = more severe
    
    // CMS messages have priority
    if (data.messageType !== undefined) {
      switch (data.messageType) {
        case 3: return 100; // 事故 - highest priority
        case 4: return 80;  // 施工
        case 2: return 90;  // 壅塞
        default: return 70; // 其他訊息
      }
    }
    
    // VD data - score based on status
    switch (data.status) {
      case 'congested': return 60; // 塞車
      case 'slow': return 40;      // 車多
      case 'smooth': return 20;    // 順暢
      default: return 0;
    }
  }

  private getStatusFromMessageType(type?: number): 'smooth' | 'slow' | 'congested' {
    // Message types: 1=travel time, 2=congestion, 3=accident, 4=construction, 5=parking, 6=announcement, 7=other
    if (type === 2 || type === 3) return 'congested';
    if (type === 4) return 'slow';
    return 'smooth';
  }

  private classifySpeedByRoadClass(speed: number, roadClass: number): 'smooth' | 'slow' | 'congested' {
    // Handle invalid speed
    if (speed === -99 || speed < 0) return 'smooth';
    
    let thresholds: { smooth: number; slow: number };
    
    switch (roadClass) {
      case 0: // 國道
        thresholds = { smooth: 80, slow: 50 };
        break;
      case 1: // 快速道路
      case 2: // 市區快速道路
        thresholds = { smooth: 60, slow: 40 };
        break;
      case 7: // 匝道
        thresholds = { smooth: 50, slow: 30 };
        break;
      default: // 一般道路
        thresholds = { smooth: 40, slow: 25 };
        break;
    }
    
    if (speed >= thresholds.smooth) return 'smooth';
    if (speed >= thresholds.slow) return 'slow';
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
        return '車多';
      case 'congested':
        return '塞車';
      default:
        return '未知';
    }
  }

  private getMessageTypeIcon(type?: number): string {
    switch (type) {
      case 2: return '⚠️'; // 壅塞
      case 3: return '🚨'; // 事故
      case 4: return '🚧'; // 施工
      case 5: return '🅿️'; // 停車
      default: return 'ℹ️';
    }
  }

  private getDirectionText(direction: string): string {
    const dirMap: Record<string, string> = {
      'N': '北向',
      'S': '南向',
      'E': '東向',
      'W': '西向',
      'NE': '東北向',
      'NW': '西北向',
      'SE': '東南向',
      'SW': '西南向',
    };
    return dirMap[direction] || direction;
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
