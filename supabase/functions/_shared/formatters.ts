import { ParkingInfo, TrafficInfo } from './tdx-client.ts';

export function formatParkingResults(results: ParkingInfo[], maxResults: number = 10): string {
  if (results.length === 0) {
    return '❌ 附近沒有找到停車場';
  }

  // 智慧篩選：如果結果 >= 3，只顯示最近、空位最多、最便宜各一筆
  let limited: ParkingInfo[];
  let selectionNote = '';
  
  if (results.length >= 3) {
    limited = selectBestParking(results);
    selectionNote = '\n（優先序：最近、空位最多、最便宜）';
  } else {
    limited = results.slice(0, maxResults);
  }

  // Count by category
  const offStreetCount = results.filter(r => r.parkingCategory !== 'onstreet').length;
  const onStreetCount = results.filter(r => r.parkingCategory === 'onstreet').length;
  let countDetail = '';
  if (offStreetCount > 0 && onStreetCount > 0) {
    countDetail = `（🅿️停車場 ${offStreetCount} + 🛣️路邊 ${onStreetCount}）`;
  }

  let message = `🅿️ 找到 ${results.length} 個停車位${countDetail}${selectionNote}\n\n`;

  limited.forEach((parking, index) => {
    // 類型標示
    const categoryIcon = parking.parkingCategory === 'onstreet' ? '🛣️' : '🅿️';
    const categoryLabel = parking.parkingCategory === 'onstreet' ? '路邊' : '停車場';
    message += `${categoryIcon} ${parking.name}（${categoryLabel}）\n`;
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
    
    // 營業時間
    if (parking.serviceTime) {
      message += `🕐 ${parking.serviceTime}\n`;
    }
    
    // 路邊停車標示（OnStreet 的 name 已帶有 🛣️ 前綴，這裡可選加標註）
    
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
    return '❌ 試用次數已達每日上限（5次）\n\n' +
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

export function formatTrafficResults(results: TrafficInfo[], maxResults: number = 5): string {
  if (results.length === 0) {
    return '❌ 附近沒有找到路況資訊';
  }

  // Filter out normal traffic (within ±10% of expected speed)
  const abnormalTraffic = results.filter(traffic => {
    // Always include CMS messages
    if (traffic.messageText) return true;
    
    // For VD data, check if speed deviation is significant
    if (traffic.speed > 0 && traffic.roadClass !== undefined) {
      const expectedSpeed = getExpectedSpeed(traffic.roadClass);
      const deviation = Math.abs(traffic.speed - expectedSpeed) / expectedSpeed;
      return deviation > 0.1; // More than 10% deviation
    }
    
    return false;
  });

  if (abnormalTraffic.length === 0) {
    return '✅ 附近路況順暢';
  }

  // Sort by severity first
  const sorted = abnormalTraffic.sort((a, b) => {
    const severityA = getSeverityScore(a);
    const severityB = getSeverityScore(b);
    return severityB - severityA;
  });

  // Group by road name (for VD data only, keep CMS separate)
  const grouped = groupByRoadName(sorted);

  // Take top 5
  const top5 = grouped.slice(0, maxResults);

  let message = `🚦 附近路況 (${top5.length}則重要資訊)\n\n`;
  
  top5.forEach((item, index) => {
    if (item.isGroup) {
      // Grouped VD data
      const statusIcon = getStatusIcon(item.status);
      const roadInfo = `${item.roadName}${item.direction ? ` ${getDirectionText(item.direction)}` : ''}`;
      
      message += `${statusIcon} ${roadInfo} (${item.distances})\n`;
      message += `   ${getStatusText(item.status)} ${item.speedRange}\n`;
    } else {
      // Single item (CMS message or single VD)
      const traffic = item.data;
      const statusIcon = getStatusIcon(traffic.status);
      const roadInfo = `${traffic.roadName}${traffic.direction ? ` ${getDirectionText(traffic.direction)}` : ''}`;
      
      // CMS messages
      if (traffic.messageText) {
        message += `${getMessageTypeIcon(traffic.messageType)} ${roadInfo} (${formatDistance(traffic.distance)})\n`;
        message += `   ${traffic.messageText}\n`;
      }
      // VD data
      else if (traffic.speed > 0) {
        message += `${statusIcon} ${roadInfo} (${formatDistance(traffic.distance)})\n`;
        message += `   ${getStatusText(traffic.status)} ${traffic.speed}km/h\n`;
      }
    }
    
    if (index < top5.length - 1) {
      message += '\n';
    }
  });

  return message;
}

interface GroupedTraffic {
  isGroup: boolean;
  roadName: string;
  direction?: string;
  status: string;
  distances?: string;
  speedRange?: string;
  data?: TrafficInfo;
  severity: number;
}

function groupByRoadName(traffic: TrafficInfo[]): GroupedTraffic[] {
  const groups = new Map<string, TrafficInfo[]>();
  const singles: TrafficInfo[] = [];
  
  // Separate CMS messages and VD data
  for (const item of traffic) {
    if (item.messageText) {
      // CMS messages are always kept separate
      singles.push(item);
    } else {
      // Group VD data by road name
      const key = item.roadName;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }
  }
  
  const result: GroupedTraffic[] = [];
  
  // Add CMS messages first (they have higher severity)
  for (const item of singles) {
    result.push({
      isGroup: false,
      roadName: item.roadName,
      direction: item.direction,
      status: item.status,
      data: item,
      severity: getSeverityScore(item),
    });
  }
  
  // Add grouped VD data
  for (const [roadName, items] of groups.entries()) {
    if (items.length === 1) {
      // Single item, don't group
      result.push({
        isGroup: false,
        roadName: items[0].roadName,
        direction: items[0].direction,
        status: items[0].status,
        data: items[0],
        severity: getSeverityScore(items[0]),
      });
    } else {
      // Multiple items - only include abnormal ones (congested or slow)
      const abnormalItems = items.filter(i => i.status === 'congested' || i.status === 'slow');
      
      if (abnormalItems.length === 0) {
        // All items are smooth, skip
        continue;
      } else if (abnormalItems.length === 1) {
        // Only one abnormal item
        result.push({
          isGroup: false,
          roadName: abnormalItems[0].roadName,
          direction: abnormalItems[0].direction,
          status: abnormalItems[0].status,
          data: abnormalItems[0],
          severity: getSeverityScore(abnormalItems[0]),
        });
      } else {
        // Multiple abnormal items, group them
        const distances = abnormalItems.map(i => i.distance).sort((a, b) => a - b);
        const speeds = abnormalItems.map(i => i.speed).filter(s => s > 0).sort((a, b) => a - b);
        
        const minDistance = distances[0];
        const maxDistance = distances[distances.length - 1];
        const minSpeed = speeds[0];
        const maxSpeed = speeds[speeds.length - 1];
        
        // Use the most severe status
        const mostSevere = abnormalItems.reduce((max, item) => 
          getSeverityScore(item) > getSeverityScore(max) ? item : max
        );
        
        result.push({
          isGroup: true,
          roadName,
          direction: abnormalItems[0].direction,
          status: mostSevere.status,
          distances: formatDistanceRange(minDistance, maxDistance),
          speedRange: `${minSpeed}~${maxSpeed}km/h`,
          severity: getSeverityScore(mostSevere),
        });
      }
    }
  }
  
  // Sort by severity again after grouping
  result.sort((a, b) => b.severity - a.severity);
  
  return result;
}

function formatDistanceRange(min: number, max: number): string {
  if (min === max) {
    return formatDistance(min);
  }
  
  // If both < 1000m, show in meters
  if (max < 1000) {
    return `${Math.round(min)} - ${Math.round(max)}m`;
  }
  
  // If min < 1000 but max >= 1000
  if (min < 1000) {
    return `${Math.round(min)}m - ${(max / 1000).toFixed(1)}km`;
  }
  
  // Both >= 1000m, show in km
  return `${(min / 1000).toFixed(1)} - ${(max / 1000).toFixed(1)}km`;
}

function getExpectedSpeed(roadClass: number): number {
  switch (roadClass) {
    case 0: return 100; // 國道
    case 1:
    case 2: return 70;  // 快速道路
    case 7: return 60;  // 匝道
    default: return 50; // 一般道路
  }
}

function getSeverityScore(traffic: TrafficInfo): number {
  // CMS messages have priority
  if (traffic.messageType !== undefined) {
    switch (traffic.messageType) {
      case 3: return 100; // 事故
      case 4: return 80;  // 施工
      case 2: return 90;  // 壅塞
      default: return 70;
    }
  }
  
  // VD data
  switch (traffic.status) {
    case 'congested': return 60;
    case 'slow': return 40;
    case 'smooth': return 20;
    default: return 0;
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'smooth':
      return '🟢';
    case 'slow':
      return '🟡';
    case 'congested':
      return '🔴';
    default:
      return '⚪';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'smooth':
      return '順暢';
    case 'slow':
      return '車多';
    case 'congested':
      return '塞車';
    default:
      return '未知';
  }
}

function getMessageTypeIcon(type?: number): string {
  switch (type) {
    case 2: return '⚠️'; // 壅塞
    case 3: return '🚨'; // 事故
    case 4: return '🚧'; // 施工
    case 5: return '🅿️'; // 停車
    default: return 'ℹ️';
  }
}

function getDirectionText(direction: string): string {
  const dirMap: Record<string, string> = {
    'N': '北向',
    'S': '南向',
    'E': '東向',
    'W': '西向',
    'NE': '東北向',
    'NW': '西北向',
    'SE': '東南向',
    'SW': '西南向',
  };
  return dirMap[direction] || direction;
}
