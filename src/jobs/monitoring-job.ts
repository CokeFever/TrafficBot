import { NotificationService } from '../services/notification-service';

export class MonitoringJob {
  private notificationService: NotificationService;
  private isRunning: boolean = false;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  async execute(): Promise<void> {
    if (this.isRunning) {
      console.log('Monitoring job already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('[Monitoring Job] Starting monitoring task...');
      await this.notificationService.runMonitoringTask();
      
      const duration = Date.now() - startTime;
      console.log(`[Monitoring Job] Completed successfully in ${duration}ms`);
    } catch (error) {
      console.error('[Monitoring Job] Failed:', error);
      
      // Log error details for debugging
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    } finally {
      this.isRunning = false;
    }
  }

  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}

// Export a factory function for creating monitoring job instances
export function createMonitoringJob(
  notificationService: NotificationService
): MonitoringJob {
  return new MonitoringJob(notificationService);
}
