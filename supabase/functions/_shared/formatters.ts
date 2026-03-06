import { ParkingInfo } from './tdx-client.ts';

export function formatParkingResults(results: ParkingInfo[], maxResults: number = 10): string {
  if (results.length === 0) {
    return '❌ 附近沒有找到停車場';
  }

  const limited = results.slice(0, maxResults);
  let message = `🅿️ 找到 ${results.length} 個停車場（顯示前 ${limited.length} 個）\n\n`;

  limited.forEach((parking, index) => {
    const availableText =
      parking.availableSpaces >= 0
        ? `${parking.availableSpaces}/${parking.totalSpaces}`
        : '未提供';

    const statusEmoji = getAvailabilityEmoji(parking.availableSpaces, parking.totalSpaces);

    message += `${index + 1}. ${statusEmoji} ${parking.name}\n`;
    message += `   📍 ${formatDistance(parking.distance)} | 🚗 ${availableText}\n`;
    message += `   💰 ${truncateText(parking.fareInfo, 30)}\n`;
    message += `   🗺️ [導航](https://www.google.com/maps/dir/?api=1&destination=${parking.latitude},${parking.longitude})\n\n`;
  });

  if (results.length > maxResults) {
    message += `... 還有 ${results.length - maxResults} 個停車場`;
  }

  // Check message length and truncate if needed
  if (message.length > 4000) {
    message = message.substring(0, 3900) + '\n\n... (訊息過長，已截斷)';
  }

  return message;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function getAvailabilityEmoji(available: number, total: number): string {
  if (available < 0) return '❓';
  if (available === 0) return '🔴';
  
  const ratio = available / total;
  if (ratio > 0.3) return '🟢';
  if (ratio > 0.1) return '🟡';
  return '🔴';
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatError(error: Error): string {
  console.error('Error:', error);
  
  if (error.message.includes('access token')) {
    return '❌ TDX API 認證失敗\n\n請檢查你的 API Key 是否正確\n使用 /setup 重新設定';
  }
  
  if (error.message.includes('outside supported cities')) {
    return '❌ 此位置不在支援的城市範圍內\n\n目前支援：台北、新北、桃園、台中、台南、高雄、新竹';
  }
  
  return '❌ 查詢失敗，請稍後再試';
}

export function formatRadiusText(radius: number): string {
  if (radius < 1000) {
    return `${radius}m`;
  }
  return `${radius / 1000}km`;
}
