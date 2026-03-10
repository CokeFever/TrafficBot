import dotenv from 'dotenv';
import http from 'http';
import { BotHandlerImpl } from './handlers/bot-handler';
import { SetupHandler } from './handlers/setup-handler';
import { ParkingHandler } from './handlers/parking-handler';
import { TrafficHandler } from './handlers/traffic-handler';
import { RoutesHandler } from './handlers/routes-handler';
import { TdxApiClientImpl } from './integrations/tdx-client';
import { ParkingServiceImpl } from './services/parking-service';
import { TrafficServiceImpl } from './services/traffic-service';
import { RouteServiceImpl } from './services/route-service';
// import { NotificationServiceImpl } from './services/notification-service';
import { ConfigServiceImpl } from './services/config-service';
import { SupabaseDataStore } from './services/supabase-store';
import { CacheLayer } from './services/cache';
import { LocationParser } from './utils/location-parser';
// import { createMonitoringJob } from './jobs/monitoring-job';

// Load environment variables
dotenv.config();

async function main() {
  console.log('Telegram Parking Bot starting...');

  // Validate required environment variables
  const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_KEY'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Initialize data store
  const dataStore = new SupabaseDataStore(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );

  // Initialize cache
  const cache = new CacheLayer(dataStore);

  // Initialize TDX API client
  const tdxClient = new TdxApiClientImpl();

  // Initialize services
  const configService = new ConfigServiceImpl(dataStore);
  const parkingService = new ParkingServiceImpl(tdxClient, cache);
  const trafficService = new TrafficServiceImpl(tdxClient, cache);
  const routeService = new RouteServiceImpl(dataStore);

  // Initialize location parser
  const locationParser = new LocationParser();

  // Initialize bot handler
  const botHandler = new BotHandlerImpl(process.env.TELEGRAM_BOT_TOKEN!);

  // Initialize command handlers
  const setupHandler = new SetupHandler(configService);
  const parkingHandler = new ParkingHandler(parkingService, configService, locationParser);
  const trafficHandler = new TrafficHandler(trafficService, configService, locationParser);
  const routesHandler = new RoutesHandler(routeService, configService, locationParser);

  // Register command handlers
  botHandler.registerCommandHandler('setup', (ctx) => setupHandler.handleSetup(ctx));
  botHandler.registerCommandHandler('config', (ctx) => setupHandler.handleConfig(ctx));
  botHandler.registerCommandHandler('reset', (ctx) => setupHandler.handleReset(ctx));
  botHandler.registerCommandHandler('parking', (ctx) => parkingHandler.handleParking(ctx));
  botHandler.registerCommandHandler('traffic', (ctx) => trafficHandler.handleTraffic(ctx));
  botHandler.registerCommandHandler('routes', (ctx) => routesHandler.handleRoutes(ctx));

  // Register callback handlers
  botHandler.registerCallbackHandler('config', (ctx, data) => {
    if (data === 'reset') {
      return setupHandler.handleReset(ctx);
    }
    return Promise.resolve();
  });

  botHandler.registerCallbackHandler('reset', (ctx, data) => {
    if (data === 'confirm') {
      return setupHandler.handleResetConfirm(ctx);
    }
    return Promise.resolve();
  });

  botHandler.registerCallbackHandler('parking', (ctx, data) => {
    const [action, value] = data.split(':');
    if (action === 'radius') {
      return parkingHandler.handleRadiusSelection(ctx, value);
    } else if (action === 'restart') {
      return parkingHandler.handleRestart(ctx);
    }
    return Promise.resolve();
  });

  botHandler.registerCallbackHandler('traffic', (ctx, data) => {
    if (data === 'restart') {
      return trafficHandler.handleRestart(ctx);
    }
    return Promise.resolve();
  });

  botHandler.registerCallbackHandler('routes', (ctx, data) => {
    const [action, value] = data.split(':');
    if (action === 'action') {
      return routesHandler.handleAction(ctx, value);
    } else if (action === 'notification') {
      return routesHandler.handleNotificationPreference(ctx, value === 'yes');
    } else if (action === 'edit') {
      return routesHandler.handleEditRouteSelection(ctx, value);
    } else if (action === 'delete') {
      return routesHandler.handleDeleteRoute(ctx, value);
    } else if (action === 'delete_confirm') {
      return routesHandler.handleDeleteConfirm(ctx, value);
    } else if (action === 'cancel') {
      return routesHandler.handleCancel(ctx);
    }
    return Promise.resolve();
  });

  // Register text message handler
  botHandler.registerTextMessageHandler(async (ctx) => {
    // Route text messages to appropriate handlers based on user state
    await setupHandler.handleMessage(ctx);
    await parkingHandler.handleMessage(ctx);
    await trafficHandler.handleMessage(ctx);
    await routesHandler.handleMessage(ctx);
  });

  // Register location handler
  botHandler.registerLocationHandler(async (ctx, location) => {
    // Route location messages to parking and traffic handlers
    await parkingHandler.handleLocation(ctx, location);
    await trafficHandler.handleLocation(ctx, location);
  });

  // Initialize notification service with Telegram message sender (for future monitoring features)
  // const sendTelegramMessage = async (userId: string, message: string) => {
  //   await botHandler.sendMessage(userId, message);
  // };
  // const notificationService = new NotificationServiceImpl(
  //   dataStore,
  //   trafficService,
  //   sendTelegramMessage
  // );

  // Initialize monitoring job (for future use with scheduled tasks)
  // const monitoringJob = createMonitoringJob(notificationService);

  // Start bot
  botHandler.launch();

  // Create HTTP server for Render health check
  const PORT = process.env.PORT || 3000;
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'Bot is running' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Telegram Parking Bot is running');
    }
  });

  server.listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
  });

  // Graceful shutdown
  process.once('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
    server.close();
    botHandler.stop();
  });
  process.once('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    server.close();
    botHandler.stop();
  });

  console.log('Bot is running!');
}

main().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
