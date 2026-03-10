// Script to set up Telegram Bot Commands
// Run this once to configure the bot's command menu

import * as dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
  process.exit(1);
}

const commands = [
  { command: 'start', description: '開始使用' },
  { command: 'help', description: '查看說明' },
  { command: 'parking', description: '搜尋附近停車位' },
  { command: 'setup', description: '設定 TDX API Key' },
  { command: 'config', description: '查看當前配置' },
  { command: 'reset', description: '重置配置' },
];

async function setupBotCommands() {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });

    const result = await response.json();

    if (result.ok) {
      console.log('✅ Bot commands set successfully!');
      console.log('\nConfigured commands:');
      commands.forEach(cmd => {
        console.log(`  /${cmd.command} - ${cmd.description}`);
      });
    } else {
      console.error('❌ Failed to set bot commands:', result);
    }
  } catch (error) {
    console.error('❌ Error setting bot commands:', error);
  }
}

setupBotCommands();
