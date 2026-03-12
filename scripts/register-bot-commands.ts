import * as dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

async function registerBotCommands() {
  const commands = [
    { command: 'start', description: '開始使用' },
    { command: 'help', description: '查看說明' },
    { command: 'parking', description: '搜尋附近停車位' },
    { command: 'traffic', description: '查詢附近路況' },
    { command: 'setup', description: '設定 TDX API Key' },
    { command: 'config', description: '查看當前配置' },
    { command: 'reset', description: '重置配置' },
  ];

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`;
    
    console.log('🔄 Registering bot commands...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to register commands: ${error}`);
    }

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Bot commands registered successfully!');
      console.log('\nRegistered commands:');
      commands.forEach(cmd => {
        console.log(`  /${cmd.command} - ${cmd.description}`);
      });
    } else {
      console.error('❌ Failed to register commands:', result);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

registerBotCommands();
