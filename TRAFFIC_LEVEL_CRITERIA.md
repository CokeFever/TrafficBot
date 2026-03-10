# 路況等級判斷標準

## 📊 根據道路類型和速度判斷路況

### 1. 高速公路（國道）

| 路況等級 | 速度範圍 | 圖示 | 說明 |
|---------|---------|------|------|
| 🟢 順暢 | ≥ 80 km/h | 🟢 | 接近限速（100-110 km/h），車流順暢 |
| 🟡 車多 | 50-79 km/h | 🟡 | 車流量大但尚可流動 |
| 🔴 塞車 | 30-49 km/h | 🔴 | 走走停停，車流緩慢 |
| ⛔ 嚴重壅塞 | < 30 km/h | ⛔ | 幾乎停滯，嚴重塞車 |

**TDX 道路分類代碼：** `RoadClass = 0`

---

### 2. 快速道路（省道、市區快速道路）

| 路況等級 | 速度範圍 | 圖示 | 說明 |
|---------|---------|------|------|
| 🟢 順暢 | ≥ 60 km/h | 🟢 | 接近限速（70-80 km/h），車流順暢 |
| 🟡 車多 | 40-59 km/h | 🟡 | 車流量大，速度降低 |
| 🔴 塞車 | 20-39 km/h | 🔴 | 走走停停，明顯壅塞 |
| ⛔ 嚴重壅塞 | < 20 km/h | ⛔ | 幾乎停滯 |

**TDX 道路分類代碼：** 
- `RoadClass = 1` (快速道路)
- `RoadClass = 2` (市區快速道路)

---

### 3. 一般道路（市區道路、市道）

| 路況等級 | 速度範圍 | 圖示 | 說明 |
|---------|---------|------|------|
| 🟢 順暢 | ≥ 40 km/h | 🟢 | 接近速限（40-60 km/h），紅綠燈影響小 |
| 🟡 車多 | 25-39 km/h | 🟡 | 車流密集，頻繁停等紅燈 |
| 🔴 塞車 | 10-24 km/h | 🔴 | 嚴重壅塞，走走停停 |
| ⛔ 嚴重壅塞 | < 10 km/h | ⛔ | 幾乎無法移動 |

**TDX 道路分類代碼：** 
- `RoadClass = 3` (省道)
- `RoadClass = 4` (縣道)
- `RoadClass = 5` (鄉道)
- `RoadClass = 6` (市區一般道路)

---

### 4. 匝道

| 路況等級 | 速度範圍 | 圖示 | 說明 |
|---------|---------|------|------|
| 🟢 順暢 | ≥ 50 km/h | 🟢 | 車流順暢 |
| 🟡 車多 | 30-49 km/h | 🟡 | 車流密集 |
| 🔴 塞車 | 15-29 km/h | 🔴 | 壅塞 |
| ⛔ 嚴重壅塞 | < 15 km/h | ⛔ | 嚴重壅塞 |

**TDX 道路分類代碼：** `RoadClass = 7`

---

## 💻 實作邏輯

### TypeScript 實作範例

```typescript
enum TrafficLevel {
  SMOOTH = 'smooth',        // 順暢
  BUSY = 'busy',           // 車多
  CONGESTED = 'congested', // 塞車
  SEVERE = 'severe'        // 嚴重壅塞
}

interface TrafficLevelInfo {
  level: TrafficLevel;
  icon: string;
  color: string;
  description: string;
}

function getTrafficLevel(speed: number, roadClass: number): TrafficLevelInfo {
  // 處理異常速度
  if (speed === -99 || speed < 0) {
    return {
      level: TrafficLevel.SMOOTH,
      icon: '❓',
      color: 'gray',
      description: '資料異常'
    };
  }
  
  let thresholds: { smooth: number; busy: number; congested: number };
  
  // 根據道路類型設定門檻
  switch (roadClass) {
    case 0: // 國道
      thresholds = { smooth: 80, busy: 50, congested: 30 };
      break;
    case 1: // 快速道路
    case 2: // 市區快速道路
      thresholds = { smooth: 60, busy: 40, congested: 20 };
      break;
    case 7: // 匝道
      thresholds = { smooth: 50, busy: 30, congested: 15 };
      break;
    case 3: // 省道
    case 4: // 縣道
    case 5: // 鄉道
    case 6: // 市區一般道路
    default:
      thresholds = { smooth: 40, busy: 25, congested: 10 };
      break;
  }
  
  // 判斷路況等級
  if (speed >= thresholds.smooth) {
    return {
      level: TrafficLevel.SMOOTH,
      icon: '🟢',
      color: 'green',
      description: '順暢'
    };
  } else if (speed >= thresholds.busy) {
    return {
      level: TrafficLevel.BUSY,
      icon: '🟡',
      color: 'yellow',
      description: '車多'
    };
  } else if (speed >= thresholds.congested) {
    return {
      level: TrafficLevel.CONGESTED,
      icon: '🔴',
      color: 'red',
      description: '塞車'
    };
  } else {
    return {
      level: TrafficLevel.SEVERE,
      icon: '⛔',
      color: 'darkred',
      description: '嚴重壅塞'
    };
  }
}

// 使用範例
const roadClass = 2; // 市區快速道路
const speed = 45;    // 45 km/h

const trafficInfo = getTrafficLevel(speed, roadClass);
console.log(`${trafficInfo.icon} ${trafficInfo.description} (${speed} km/h)`);
// 輸出: 🟡 車多 (45 km/h)
```

---

## 📱 顯示格式範例

### 範例 1: 市區快速道路

```
🚦 市民大道高架道路（東向）
距離：555m
🟡 車多 (45 km/h)
更新：11:20
```

### 範例 2: 國道

```
🚦 國道1號（南向）
距離：1.2km
🟢 順暢 (85 km/h)
更新：11:20
```

### 範例 3: 市區道路

```
🚦 信義路五段
距離：320m
🔴 塞車 (15 km/h)
⚠️ 前方施工，請改道
更新：11:20
```

---

## 🎨 視覺化建議

### 圖示選擇

| 等級 | 主要圖示 | 替代圖示 | 顏色代碼 |
|------|---------|---------|---------|
| 順暢 | 🟢 | ✅ 🚗💨 | #00C851 |
| 車多 | 🟡 | ⚠️ 🚙 | #FFB300 |
| 塞車 | 🔴 | 🚨 🐌 | #FF4444 |
| 嚴重壅塞 | ⛔ | 🚫 ⏸️ | #CC0000 |

### 文字描述

**簡潔版：**
- 🟢 順暢
- 🟡 車多
- 🔴 塞車
- ⛔ 嚴重壅塞

**詳細版：**
- 🟢 順暢 - 車流順暢，可正常行駛
- 🟡 車多 - 車流密集，速度降低
- 🔴 塞車 - 走走停停，請耐心等候
- ⛔ 嚴重壅塞 - 幾乎停滯，建議改道

---

## 🔄 與 CMS 訊息的整合

### 優先級規則

1. **CMS 有明確訊息** → 優先顯示 CMS 訊息
   - 事故、施工、封閉等官方資訊
   
2. **CMS 無訊息但有 VD 資料** → 顯示速度判斷的路況
   - 根據速度自動判斷壅塞程度
   
3. **都無資料** → 顯示「暫無路況資訊」

### 組合顯示範例

```
🚦 市民大道高架道路（東向）
距離：555m
🔴 塞車 (18 km/h)
⚠️ 前方車禍，外側車道受阻
建議：改走環東大道
更新：11:20
```

---

## 📊 資料來源對照

### VD Live API 資料結構

```json
{
  "VDID": "V0380F0",
  "LinkFlows": [
    {
      "LinkID": "2000200100610A",
      "Lanes": [
        {
          "LaneID": 1,
          "Speed": 62,        // ← 使用此速度
          "Occupancy": 3,     // ← 佔有率（可選）
          "Vehicles": [...]
        }
      ]
    }
  ]
}
```

### 計算平均速度

```typescript
function calculateAverageSpeed(linkFlows: LinkFlow[]): number {
  let totalSpeed = 0;
  let laneCount = 0;
  
  for (const link of linkFlows) {
    for (const lane of link.Lanes) {
      if (lane.Speed > 0 && lane.Speed !== -99) {
        totalSpeed += lane.Speed;
        laneCount++;
      }
    }
  }
  
  return laneCount > 0 ? totalSpeed / laneCount : -99;
}
```

---

## ⚙️ 進階功能（可選）

### 1. 考慮佔有率（Occupancy）

```typescript
function getTrafficLevelAdvanced(
  speed: number, 
  occupancy: number, 
  roadClass: number
): TrafficLevelInfo {
  const basicLevel = getTrafficLevel(speed, roadClass);
  
  // 如果速度正常但佔有率很高，降級為「車多」
  if (basicLevel.level === TrafficLevel.SMOOTH && occupancy > 20) {
    return {
      level: TrafficLevel.BUSY,
      icon: '🟡',
      color: 'yellow',
      description: '車多'
    };
  }
  
  return basicLevel;
}
```

### 2. 時段調整

```typescript
function adjustForTimeOfDay(level: TrafficLevelInfo, hour: number): TrafficLevelInfo {
  // 尖峰時段（7-9, 17-19）容忍度較高
  const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  
  if (isPeakHour && level.level === TrafficLevel.BUSY) {
    return {
      ...level,
      description: '車多（尖峰時段正常）'
    };
  }
  
  return level;
}
```

---

## 📝 總結

這套標準提供了：
- ✅ 明確的速度門檻
- ✅ 不同道路類型的差異化判斷
- ✅ 視覺化圖示和顏色
- ✅ 可直接實作的程式碼
- ✅ 與 CMS 訊息的整合方式

可以直接用於 `/traffic` 功能的實作！
