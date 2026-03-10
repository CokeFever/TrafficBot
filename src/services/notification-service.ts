import { RoutineRoute, TrafficInfo, TrafficEvent, NotificationRecord } from '../models/types';
import { DataStore } from './data-store';
import { TrafficService } from './traffic-service';

export interface NotificationService {
  runMonitoringTask(): Promise<void>;
  checkRoute(route: RoutineRoute, apiKey: string): Promise<void>;
  shouldNotify(
    currentTraffic: TrafficInfo,
    events: TrafficEvent[],
    lastNotification?: NotificationRecord
  ): boolean;
  sendNotification(
    userId: string,
    route: RoutineRoute,
    traffic: TrafficInfo,
    events: TrafficEvent[]
  ): Promise<void>;
}

export class NotificationServiceImpl implements NotificationService {
  private dataStore: DataStore;
  // Kept for future implementation
  // private trafficService: TrafficService;
  private sendTelegramMessage: (userId: string, message: string) => Promise<void>;
  private readonly NOTIFICATION_COOLDOWN = 30 * 60 * 1000; // 30 minutes
  private readonly HISTORY_RETENTION = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(
    dataStore: DataStore,
    _trafficService: TrafficService,
    sendTelegramMessage: (userId: string, message: string) => Promise<void>
  ) {
    this.dataStore = dataStore;
    // this.trafficService = trafficService;
    this.sendTelegramMessage = sendTelegramMessage;
  }

  async runMonitoringTask(): Promise<void> {
    try {
      // Get all users with routine routes
      const userKeys = await this.dataStore.listKeys('route:');
      const uniqueUsers = new Set<string>();

      userKeys.forEach((key) => {
        const parts = key.split(':');
        if (parts.length >= 2) {
          uniqueUsers.add(parts[1]);
        }
      });

      // Check each user's routes
      for (const userId of uniqueUsers) {
        const apiKey = await this.getUserApiKey(userId);
        if (!apiKey) continue;

        const routes = await this.getUserRoutes(userId);
        for (const route of routes) {
          await this.checkRoute(route, apiKey);
        }
      }

      // Cleanup old notifications
      await this.cleanupOldNotifications();
    } catch (error) {
      console.error('Monitoring task failed:', error);
    }
  }

  async checkRoute(route: RoutineRoute, _apiKey: string): Promise<void> {
    try {
      // Check notification time preferences
      if (!this.isWithinNotificationTime(route)) {
        return;
      }

      // TODO: Implement traffic monitoring for routes
      // Current traffic service only supports location-based queries
      // Need to implement route-based traffic monitoring
      console.log(`Monitoring route ${route.id} - not yet implemented`);
      
      // Get last notification
      // const lastNotification = await this.getLastNotification(route.id);

      // Check if notification needed
      // if (this.shouldNotify(traffic, events, lastNotification)) {
      //   await this.sendNotification(route.userId, route, traffic, events);
      // }
    } catch (error) {
      console.error(`Failed to check route ${route.id}:`, error);
    }
  }

  shouldNotify(
    _currentTraffic: TrafficInfo,
    events: TrafficEvent[],
    lastNotification?: NotificationRecord
  ): boolean {
    // Check cooldown period
    if (lastNotification) {
      const timeSinceLastNotification = Date.now() - lastNotification.sentAt.getTime();
      if (timeSinceLastNotification < this.NOTIFICATION_COOLDOWN) {
        return false;
      }
    }

    // Check for heavy congestion
    // Note: This is a placeholder for future implementation
    // if (currentTraffic.status === 'congested') {
    //   return true;
    // }
    return false;

    // Check for major accidents
    const majorAccidents = events.filter(
      (e) => e.type === 'accident' && e.estimatedImpact >= 15
    );
    if (majorAccidents.length > 0) {
      // Check if these are new events
      if (lastNotification?.eventIds) {
        const newEvents = majorAccidents.filter(
          (e) => !lastNotification!.eventIds.includes(e.id)
        );
        return newEvents.length > 0;
      }
      return true;
    }

    return false;
  }

  async sendNotification(
    userId: string,
    route: RoutineRoute,
    traffic: TrafficInfo,
    events: TrafficEvent[]
  ): Promise<void> {
    const message = this.formatNotificationMessage(route, traffic, events);

    try {
      await this.sendTelegramMessage(userId, message);

      // Record notification
      const record: NotificationRecord = {
        id: `${route.id}-${Date.now()}`,
        routeId: route.id,
        userId,
        trafficStatus: 'unknown', // Placeholder for future implementation
        eventIds: events.map((e) => e.id),
        sentAt: new Date(),
      };

      const key = `notification:${route.id}:${Date.now()}`;
      await this.dataStore.set(key, record);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  private formatNotificationMessage(
    route: RoutineRoute,
    _traffic: TrafficInfo,
    events: TrafficEvent[]
  ): string {
    const lines = ['⚠️ 路線異常通知\n'];
    lines.push(`您的經常性路線「${route.name}」出現異常：\n`);

    // Note: This is a placeholder for future implementation
    // if (traffic.status === 'congested') {
    //   lines.push('🔴 嚴重壅塞');
    //   lines.push(`速度：${traffic.speed || 0} km/h\n`);
    // }

    if (events.length > 0) {
      lines.push('🚨 交通事故');
      events.forEach((event) => {
        lines.push(`類型：${this.getEventTypeText(event.type)}`);
        lines.push(`說明：${event.description}`);
      });
      lines.push('\n建議改道或延後出發');
    }

    return lines.join('\n');
  }

  private async getUserApiKey(userId: string): Promise<string | null> {
    const config = await this.dataStore.get(`config:${userId}`);
    return config?.tdxApiKey || null;
  }

  private async getUserRoutes(userId: string): Promise<RoutineRoute[]> {
    const prefix = `route:${userId}:`;
    const keys = await this.dataStore.listKeys(prefix);
    if (keys.length === 0) return [];

    const routes = await this.dataStore.batchGet(keys);
    return Object.values(routes).filter((r) => r !== null) as RoutineRoute[];
  }

  // Kept for future implementation
  // private async getLastNotification(routeId: string): Promise<NotificationRecord | undefined> {
  //   const prefix = `notification:${routeId}:`;
  //   const keys = await this.dataStore.listKeys(prefix);
  //   if (keys.length === 0) return undefined;
  //   const sortedKeys = keys.sort().reverse();
  //   const lastKey = sortedKeys[0];
  //   return await this.dataStore.get(lastKey);
  // }

  private isWithinNotificationTime(route: RoutineRoute): boolean {
    if (!route.notificationPreferences?.enabled) {
      return false;
    }

    const timeRanges = route.notificationPreferences.timeRanges;
    if (!timeRanges || timeRanges.length === 0) {
      return true; // No time restrictions
    }

    const now = new Date();
    const currentHour = now.getHours();

    return timeRanges.some(
      (range) => currentHour >= range.startHour && currentHour <= range.endHour
    );
  }

  private async cleanupOldNotifications(): Promise<void> {
    const keys = await this.dataStore.listKeys('notification:');
    const cutoffTime = Date.now() - this.HISTORY_RETENTION;

    for (const key of keys) {
      const notification = await this.dataStore.get(key);
      if (notification && notification.sentAt.getTime() < cutoffTime) {
        await this.dataStore.delete(key);
      }
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
