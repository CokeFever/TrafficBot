import { ParkingInfo } from './tdx-client.ts';

export function formatParkingResults(results: ParkingInfo[], maxResults: number = 10): string {
  if (results.length === 0) {
    return '❌ 附近沒有找到停車場';
  }

  const limited = results.slice(0, maxResults);
  let message = `🅿️ 找到 ${results.length} 個停車場\n\n`;

  limited.forEach((parking, index) => {
    message += `📍 ${parking.name}\n`;
    message += `距離：${formatDistance(parking.distance)}\n`;
    
    // 車位
    if (parking.totalSpaces > 0) {
      const availableText = parking.availableSpaces >= 0 
        ? `${parking.availableSpaces} / ${parking.totalSpaces}` 
        : '未提供';
      message += `車位：${availableText}\n`;
    } else {
      message += `車位：未提供\n`;
    }
    
    message += '\n';
    
    // 特殊車位（只有 > 0 才顯示，不加單位）
    const specialLines: string[] = [];
    
    if (parking.heavyMotorcycleSpaces && parking.heavyMotorcycleSpaces > 0) {
      specialLines.push(`🏍️ 重機：${parking.heavyMotorcycleSpaces}`);
    }
    if (parking.chargingSpaces && parking.chargingSpaces > 0) {
      specialLines.push(`⚡ 充電：${parking.chargingSpaces}`);
    }
    if (parking.handicapSpaces && parking.handicapSpaces > 0) {
      specialLines.push(`♿ 殘障：${parking.handicapSpaces}`);
    }
    if (parking.womenChildrenSpaces && parking.womenChildrenSpaces > 0) {
      specialLines.push(`👶 婦幼：${parking.womenChildrenSpaces}`);
    }
    
    if (specialLines.length > 0) {
      message += specialLines.join('\n') + '\n\n';
    }
    
    // 收費
    if (parking.fareDescription) {
      message += '收費：\n';
      if (parking.hourlyRate) {
        message += `- 計時：${parking.hourlyRate}\n`;
      }
      if (parking.monthlyRate) {
        message += `- 月租：${parking.monthlyRate}\n`;
      }
      if (parking.motorcycleMonthlyRate) {
        message += `- 重機月租：${parking.motorcycleMonthlyRate}\n`;
      }
      
      // 如果沒有解析出細節，顯示原始說明（簡化版）
      if (!parking.hourlyRate && !parking.monthlyRate) {
        const simpleFare = parking.fareDescription.length > 100 
          ? parking.fareDescription.substring(0, 100) + '...' 
          : parking.fareDescription;
        message += simpleFare + '\n';
      }
    } else {
      message += '收費：未提供\n';
    }
    
    // 導航連結
    message += `[📍 導航](https://www.google.com/maps/dir/?api=1&destination=${parking.latitude},${parking.longitude})\n`;
    
    // 分隔線（除了最後一個）
    if (index < limited.length - 1) {
      message += '\n---\n\n';
    }
  });

  if (results.length > maxResults) {
    message += `\n\n還有 ${results.length - maxResults} 個停車場...`;
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
