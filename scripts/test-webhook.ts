#!/usr/bin/env node

/**
 * Script to test Telegram Webhook locally
 * 
 * Usage:
 *   npm run test-webhook
 */

import * as dotenv from 'dotenv';

dotenv.config();

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:54321/functions/v1/telegram-webhook';

// Sample Telegram update (message)
const sampleMessage = {
  update_id: 123456789,
  message: {
    message_id: 1,
    from: {
      id: 123456,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser',
    },
    chat: {
      id: 123456,
      first_name: 'Test',
      username: 'testuser',
      type: 'private',
    },
    date: Math.floor(Date.now() / 1000),
    text: '/start',
  },
};

// Sample location message
const sampleLocation = {
  update_id: 123456790,
  message: {
    message_id: 2,
    from: {
      id: 123456,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser',
    },
    chat: {
      id: 123456,
      first_name: 'Test',
      username: 'testuser',
      type: 'private',
    },
    date: Math.floor(Date.now() / 1000),
    location: {
      latitude: 25.0330,
      longitude: 121.5654,
    },
  },
};

async function testWebhook(update: any, description: string) {
  console.log(`\nTesting: ${description}`);
  console.log('Sending update:', JSON.stringify(update, null, 2));

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Test passed');
    } else {
      console.log('❌ Test failed');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  console.log('Testing Telegram Webhook');
  console.log('Webhook URL:', WEBHOOK_URL);

  // Test /start command
  await testWebhook(sampleMessage, '/start command');

  // Test location message
  await testWebhook(sampleLocation, 'Location message');

  console.log('\n✅ All tests completed');
}

main();
