#!/usr/bin/env node

/**
 * Script to setup Telegram Webhook
 * 
 * Usage:
 *   npm run setup-webhook
 * 
 * Environment variables required:
 *   - TELEGRAM_BOT_TOKEN: Your Telegram bot token
 *   - SUPABASE_URL: Your Supabase project URL
 */

import * as dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;

if (!BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN environment variable is required');
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error('Error: SUPABASE_URL environment variable is required');
  process.exit(1);
}

const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/telegram-webhook`;

async function setupWebhook() {
  console.log('Setting up Telegram webhook...');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);

  try {
    // Set webhook
    const setWebhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
    const response = await fetch(setWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ['message', 'callback_query'],
      }),
    });

    const result = await response.json() as any;

    if (result.ok) {
      console.log('✅ Webhook set successfully!');
      console.log('Response:', result);

      // Get webhook info
      const getWebhookInfoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
      const infoResponse = await fetch(getWebhookInfoUrl);
      const info = await infoResponse.json() as any;

      console.log('\nWebhook Info:');
      console.log(JSON.stringify(info.result, null, 2));
    } else {
      console.error('❌ Failed to set webhook');
      console.error('Error:', result);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error);
    process.exit(1);
  }
}

async function deleteWebhook() {
  console.log('Deleting Telegram webhook...');

  try {
    const deleteWebhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`;
    const response = await fetch(deleteWebhookUrl, {
      method: 'POST',
    });

    const result = await response.json() as any;

    if (result.ok) {
      console.log('✅ Webhook deleted successfully!');
    } else {
      console.error('❌ Failed to delete webhook');
      console.error('Error:', result);
    }
  } catch (error) {
    console.error('❌ Error deleting webhook:', error);
  }
}

async function getWebhookInfo() {
  console.log('Getting webhook info...');

  try {
    const getWebhookInfoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
    const response = await fetch(getWebhookInfoUrl);
    const result = await response.json() as any;

    if (result.ok) {
      console.log('Webhook Info:');
      console.log(JSON.stringify(result.result, null, 2));
    } else {
      console.error('❌ Failed to get webhook info');
      console.error('Error:', result);
    }
  } catch (error) {
    console.error('❌ Error getting webhook info:', error);
  }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
  case 'set':
  case undefined:
    setupWebhook();
    break;
  case 'delete':
    deleteWebhook();
    break;
  case 'info':
    getWebhookInfo();
    break;
  default:
    console.log('Usage: npm run setup-webhook [set|delete|info]');
    console.log('  set    - Set webhook URL (default)');
    console.log('  delete - Delete webhook');
    console.log('  info   - Get webhook info');
    process.exit(1);
}
