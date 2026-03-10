// Script to verify Telegram Bot Commands are set correctly
import * as dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
  process.exit(1);
}

async function verifyBotCommands() {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands`;
    
    const response = await fetch(url);
    const result = await response.json() as any;

    if (result.ok) {
      console.log('✅ Bot commands retrieved successfully!\n');
      
      if (result.result && result.result.length > 0) {
        console.log('📋 Current commands:');
        result.result.forEach((cmd: any) => {
          console.log(`  /${cmd.command} - ${cmd.description}`);
        });
        console.log(`\n✅ Total: ${result.result.length} commands`);
      } else {
        console.log('⚠️  No commands are currently set');
        console.log('\nRun this to set commands:');
        console.log('  npx ts-node scripts/setup-bot-commands.ts');
      }
    } else {
      console.error('❌ Failed to get bot commands:', result);
    }
  } catch (error) {
    console.error('❌ Error getting bot commands:', error);
  }
}

verifyBotCommands();
