import { ParkingInfo } from './tdx-client.ts';

export function formatParkingResults(results: ParkingInfo[], maxResults: number = 10): string {
  if (results.length === 0) {
    return '❌ 附近沒有找到停車場';
  }

  // 智慧篩選：如果結果 >= 3，只顯示最近、空位最多、最便宜各一筆
  let limited: ParkingInfo[];
  let selectionNote = '';
  
  if (results.length >= 3) {
    limited = selectBestParking(results);
    selectionNote = '\n（已為您篩選：最近、空位最多、最便宜）';
  } else {
    limited = results.slice(0, maxResults);
  }

  let message = `🅿️ 找到 ${results.length} 個停車場${selectionNote}\n\n`;

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
    
    // 特殊車位（單行顯示，只有 > 0 才顯示）
    const specialParts: string[] = [];
    
    if (parking.heavyMotorcycleSpaces && parking.heavyMotorcycleSpaces > 0) {
      specialParts.push(`🏍️重機: ${parking.heavyMotorcycleSpaces}`);
    }
    if (parking.chargingSpaces && parking.chargingSpaces > 0) {
      specialParts.push(`⚡充電: ${parking.chargingSpaces}`);
    }
    if (parking.handicapSpaces && parking.handicapSpaces > 0) {
      specialParts.push(`♿殘障: ${parking.handicapSpaces}`);
    }
    if (parking.womenChildrenSpaces && parking.womenChildrenSpaces > 0) {
      specialParts.push(`👶婦幼: ${parking.womenChildrenSpaces}`);
    }
    
    if (specialParts.length > 0) {
      message += specialParts.join(', ') + '\n';
    }
    
    // 收費
    if (parking.fareDescription) {
      message += '收費：';
      if (parking.hourlyRate) {
        message += `${parking.hourlyRate}`;
      } else if (parking.monthlyRate) {
        message += `月租 ${parking.monthlyRate}`;
      } else {
        // 顯示原始說明（簡化版）
        const simpleFare = parking.fareDescription.length > 60 
          ? parking.fareDescription.substring(0, 60) + '...' 
          : parking.fareDescription;
        message += simpleFare;
      }
      message += '\n';
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

  if (results.length > limited.length) {
    message += `\n\n還有 ${results.length - limited.length} 個停車場`;
  }

  // Check message length and truncate if needed
  if (message.length > 4000) {
    message = message.substring(0, 3900) + '\n\n... (訊息過長，已截斷)';
  }

  return message;
}

// 智慧篩選：選出最近、空位最多、最便宜各一筆
function selectBestParking(results: ParkingInfo[]): ParkingInfo[] {
  const selected: ParkingInfo[] = [];
  const selectedIds = new Set<string>();
  
  // 1. 距離最近的
  const nearest = results[0]; // 已經按距離排序
  selected.push(nearest);
  selectedIds.add(nearest.id);
  
  // 2. 空位最多的（只考慮有空位資訊的）
  const withAvailability = results.filter(p => p.availableSpaces >= 0 && p.totalSpaces > 0);
  if (withAvailability.length > 0) {
    const mostAvailable = withAvailability.reduce((max, p) => 
      p.availableSpaces > max.availableSpaces ? p : max
    );
    if (!selectedIds.has(mostAvailable.id)) {
      selected.push(mostAvailable);
      selectedIds.add(mostAvailable.id);
    }
  }
  
  // 3. 最便宜的（只考慮有計時收費的）
  const withHourlyRate = results.filter(p => p.hourlyRate);
  if (withHourlyRate.length > 0) {
    const cheapest = withHourlyRate.reduce((min, p) => {
      const minPrice = extractPrice(min.hourlyRate);
      const pPrice = extractPrice(p.hourlyRate);
      return pPrice < minPrice ? p : min;
    });
    if (!selectedIds.has(cheapest.id)) {
      selected.push(cheapest);
      selectedIds.add(cheapest.id);
    }
  }
  
  // 如果篩選後少於 3 筆，補上距離最近的其他停車場
  if (selected.length < 3) {
    for (const parking of results) {
      if (!selectedIds.has(parking.id)) {
        selected.push(parking);
        selectedIds.add(parking.id);
        if (selected.length >= 3) break;
      }
    }
  }
  
  return selected;
}

// 從收費字串中提取價格數字
function extractPrice(rateStr: string | undefined): number {
  if (!rateStr) return Infinity;
  const match = rateStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : Infinity;
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
  
  if (error.message.includes('trial limit exceeded')) {
    return '❌ 試用次數已達每日上限（2次）\n\n' +
           '請前往 TDX 平台申請免費 API Key：\n' +
           'https://tdx.transportdata.tw/\n\n' +
           '申請後使用 /setup 設定你的 API Key';
  }
  
  return '❌ 查詢失敗，請稍後再試';
}

export function formatRadiusText(radius: number): string {
  if (radius < 1000) {
    return `${radius}m`;
  }
  return `${radius / 1000}km`;
}
