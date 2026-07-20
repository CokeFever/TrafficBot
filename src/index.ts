import dotenv from 'dotenv';
import http from 'http';
import { BotHandlerImpl } from './handlers/bot-handler';
import { SetupHandler } from './handlers/setup-handler';
import { ParkingHandler } from './handlers/parking-handler';
import { TrafficHandler } from './handlers/traffic-handler';
import { TdxApiClientImpl } from './integrations/tdx-client';
import { ParkingServiceImpl } from './services/parking-service';
import { TrafficServiceImpl } from './services/traffic-service';
import { ConfigServiceImpl } from './services/config-service';
import { SupabaseDataStore } from './services/supabase-store';
import { CacheLayer } from './services/cache';
import { LocationParser } from './utils/location-parser';

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

  // Initialize location parser
  const locationParser = new LocationParser();

  // Initialize bot handler
  const botHandler = new BotHandlerImpl(process.env.TELEGRAM_BOT_TOKEN!);

  // Initialize command handlers
  const setupHandler = new SetupHandler(configService);
  const parkingHandler = new ParkingHandler(parkingService, configService, locationParser);
  const trafficHandler = new TrafficHandler(trafficService, configService, locationParser);

  // Register command handlers
  botHandler.registerCommandHandler('setup', (ctx) => setupHandler.handleSetup(ctx));
  botHandler.registerCommandHandler('config', (ctx) => setupHandler.handleConfig(ctx));
  botHandler.registerCommandHandler('reset', (ctx) => setupHandler.handleReset(ctx));
  botHandler.registerCommandHandler('parking', (ctx) => parkingHandler.handleParking(ctx));
  botHandler.registerCommandHandler('traffic', (ctx) => trafficHandler.handleTraffic(ctx));

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

  // Register text message handler
  botHandler.registerTextMessageHandler(async (ctx) => {
    // Route text messages to appropriate handlers based on user state
    await setupHandler.handleMessage(ctx);
    await parkingHandler.handleMessage(ctx);
    await trafficHandler.handleMessage(ctx);
  });

  // Register location handler
  botHandler.registerLocationHandler(async (ctx, location) => {
    // Route location messages to parking and traffic handlers
    await parkingHandler.handleLocation(ctx, location);
    await trafficHandler.handleLocation(ctx, location);
  });

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
