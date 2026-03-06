# 🅿️ 停車場資訊顯示格式指南

## 📋 顯示原則

### 核心原則
1. **母項目**（距離、剩餘車位、收費）：沒有資訊時顯示「未提供」
2. **子項目**（重機、充電樁、殘障、婦幼）：沒有資訊時直接不顯示該列
3. **簡潔優先**：只顯示有價值的資訊，節省訊息空間

---

## 💻 實作範例

### TypeScript 實作

```typescript
interface ParkingInfo {
  name: string;
  distance: number | null;
  availableSpaces: number | null;
  totalSpaces: number | null;
  fareDescription: string | null;
  
  // 特殊車位（只有 > 0 時才顯示）
  heavyMotorcycleSpaces?: number;
  chargingSpaces?: number;
  handicapSpaces?: number;
  womenChildrenSpaces?: number;
  
  // 收費細節（可選）
  hourlyRate?: string;
  monthlyRate?: string;
  motorcycleMonthlyRate?: string;
}

function formatParkingInfo(parking: ParkingInfo): string {
  const lines: string[] = [];
  
  // 標題
  lines.push(`📍 ${parking.name}`);
  
  // 距離（母項目）
  if (parking.distance !== null) {
    lines.push(`距離：${Math.round(parking.distance)}m`);
  } else {
    lines.push(`距離：未提供`);
  }
  
  // 車位（母項目）
  if (parking.availableSpaces !== null && parking.totalSpaces !== null) {
    lines.push(`車位：${parking.availableSpaces} / ${parking.totalSpaces}`);
  } else {
    lines.push(`車位：未提供`);
  }
  
  // 空行
  lines.push('');
  
  // 特殊車位（子項目 - 只有存在且 > 0 時才顯示，不加單位）
  const specialSpaces: string[] = [];
  
  if (parking.heavyMotorcycleSpaces && parking.heavyMotorcycleSpaces > 0) {
    specialSpaces.push(`🏍️ 重機：${parking.heavyMotorcycleSpaces}`);
  }
  
  if (parking.chargingSpaces && parking.chargingSpaces > 0) {
    specialSpaces.push(`⚡ 充電：${parking.chargingSpaces}`);
  }
  
  if (parking.handicapSpaces && parking.handicapSpaces > 0) {
    specialSpaces.push(`♿ 殘障：${parking.handicapSpaces}`);
  }
  
  if (parking.womenChildrenSpaces && parking.womenChildrenSpaces > 0) {
    specialSpaces.push(`👶 婦幼：${parking.womenChildrenSpaces}`);
  }
  
  // 只有當有特殊車位時才加入
  if (specialSpaces.length > 0) {
    lines.push(...specialSpaces);
    lines.push(''); // 空行
  }
  
  // 收費（母項目）
  if (parking.fareDescription) {
    lines.push('收費：');
    
    // 如果有解析出的收費細節
    if (parking.hourlyRate) {
      lines.push(`- 計時：${parking.hourlyRate}`);
    }
    if (parking.monthlyRate) {
      lines.push(`- 月租：${parking.monthlyRate}`);
    }
    if (parking.motorcycleMonthlyRate) {
      lines.push(`- 重機月租：${parking.motorcycleMonthlyRate}`);
    }
    
    // 如果沒有解析出細節，顯示原始說明
    if (!parking.hourlyRate && !parking.monthlyRate) {
      lines.push(`${parking.fareDescription}`);
    }
  } else {
    lines.push('收費：未提供');
  }
  
  return lines.join('\n');
}
```

---

## 📊 顯示範例

### 範例 1: 完整資訊（有所有特殊車位）

```
📍 社子國小地下停車場
距離：350m
車位：45 / 464

🏍️ 重機：5
⚡ 充電：10
♿ 殘障：10
👶 婦幼：9

收費：
- 計時：20元/時
- 月租：3,500元/月
- 重機月租：1,750元/月
```

### 範例 2: 部分資訊（只有充電樁）

```
📍 興隆D1社會住宅地下停車場
距離：520m
車位：28 / 128

⚡ 充電：3

收費：
- 計時：20元/時
- 月租：4,200元/月
```

### 範例 3: 基本資訊（無特殊車位）

```
📍 市政府地下停車場
距離：180m
車位：126 / 1998

收費：
- 計時：30元/時
- 月租：5,000元/月
```

### 範例 4: 資訊不完整（無收費資訊）

```
📍 某停車場
距離：未提供
車位：50 / 200

收費：未提供
```

---

## 🔍 解析函數範例

### 解析特殊車位

```typescript
interface SpecialSpaces {
  heavyMotorcycle?: number;
  charging?: number;
  handicap?: number;
  womenChildren?: number;
}

function parseSpecialSpaces(description: string): SpecialSpaces {
  const result: SpecialSpaces = {};
  
  // 大型重機
  const motorcycleMatch = description.match(/大[型重]?重?機[：:]?(\d+)格/);
  if (motorcycleMatch) {
    const count = parseInt(motorcycleMatch[1]);
    if (count > 0) {
      result.heavyMotorcycle = count;
    }
  }
  
  // 充電格位
  const chargingMatch = description.match(/充電格?位[：:]?(\d+)[格個]/);
  if (chargingMatch) {
    const count = parseInt(chargingMatch[1]);
    if (count > 0) {
      result.charging = count;
    }
  }
  
  // 身心障礙停車位
  const handicapMatch = description.match(/身心障礙停車位(\d+)格/);
  if (handicapMatch) {
    const count = parseInt(handicapMatch[1]);
    if (count > 0) {
      result.handicap = count;
    }
  }
  
  // 孕婦、育有六歲以下兒童停車位
  const womenChildrenMatch = description.match(/孕婦、育有六歲以下兒童停車位(\d+)格/);
  if (womenChildrenMatch) {
    const count = parseInt(womenChildrenMatch[1]);
    if (count > 0) {
      result.womenChildren = count;
    }
  }
  
  return result;
}
```

### 解析收費資訊

```typescript
interface FareInfo {
  hourlyRate?: string;
  monthlyRate?: string;
  motorcycleMonthlyRate?: string;
  rawDescription: string;
}

function parseFareInfo(fareDescription: string): FareInfo {
  const result: FareInfo = {
    rawDescription: fareDescription,
  };
  
  // 計時收費
  const hourlyMatch = fareDescription.match(/(\d+)元[/／]時/);
  if (hourlyMatch) {
    result.hourlyRate = `${hourlyMatch[1]}元/時`;
  }
  
  // 月租（小型車）
  const monthlyMatch = fareDescription.match(/月租[^0-9]*?(\d+,?\d*)元/);
  if (monthlyMatch) {
    result.monthlyRate = `${monthlyMatch[1]}元/月`;
  }
  
  // 重機月租
  const motorcycleMonthlyMatch = fareDescription.match(/大[型重]?重?機[^0-9]*?(\d+,?\d*)元/);
  if (motorcycleMonthlyMatch) {
    result.motorcycleMonthlyRate = `${motorcycleMonthlyMatch[1]}元/月`;
  }
  
  return result;
}
```

---

## 🎯 完整實作範例

```typescript
function buildParkingMessage(parkingData: any): string {
  // 解析特殊車位
  const specialSpaces = parseSpecialSpaces(parkingData.Description || '');
  
  // 解析收費
  const fareInfo = parseFareInfo(parkingData.FareDescription || '');
  
  // 建立訊息
  const lines: string[] = [];
  
  // 標題
  lines.push(`📍 ${parkingData.CarParkName?.Zh_tw || '停車場'}`);
  
  // 距離
  const distance = parkingData.distance;
  lines.push(`距離：${distance !== null ? Math.round(distance) + 'm' : '未提供'}`);
  
  // 車位
  const available = parkingData.AvailableSpaces;
  const total = parkingData.TotalSpaces;
  if (available !== null && total !== null) {
    lines.push(`車位：${available} / ${total}`);
  } else {
    lines.push(`車位：未提供`);
  }
  
  lines.push(''); // 空行
  
  // 特殊車位（只顯示有的，不加單位）
  const specialLines: string[] = [];
  
  if (specialSpaces.heavyMotorcycle) {
    specialLines.push(`🏍️ 重機：${specialSpaces.heavyMotorcycle}`);
  }
  if (specialSpaces.charging) {
    specialLines.push(`⚡ 充電：${specialSpaces.charging}`);
  }
  if (specialSpaces.handicap) {
    specialLines.push(`♿ 殘障：${specialSpaces.handicap}`);
  }
  if (specialSpaces.womenChildren) {
    specialLines.push(`👶 婦幼：${specialSpaces.womenChildren}`);
  }
  
  if (specialLines.length > 0) {
    lines.push(...specialLines);
    lines.push(''); // 空行
  }
  
  // 收費
  if (parkingData.FareDescription) {
    lines.push('收費：');
    if (fareInfo.hourlyRate) {
      lines.push(`- 計時：${fareInfo.hourlyRate}`);
    }
    if (fareInfo.monthlyRate) {
      lines.push(`- 月租：${fareInfo.monthlyRate}`);
    }
    if (fareInfo.motorcycleMonthlyRate) {
      lines.push(`- 重機月租：${fareInfo.motorcycleMonthlyRate}`);
    }
  } else {
    lines.push('收費：未提供');
  }
  
  // 導航連結
  if (parkingData.CarParkPosition) {
    const lat = parkingData.CarParkPosition.PositionLat;
    const lon = parkingData.CarParkPosition.PositionLon;
    lines.push('');
    lines.push(`[📍 導航](https://www.google.com/maps/dir/?api=1&destination=${lat},${lon})`);
  }
  
  return lines.join('\n');
}
```

---

## ✅ 檢查清單

在實作時，請確保：

### 母項目（必須顯示）
- [ ] 停車場名稱
- [ ] 距離（無資料時顯示「未提供」）
- [ ] 剩餘車位（無資料時顯示「未提供」）
- [ ] 收費（無資料時顯示「未提供」）

### 子項目（有資料且 > 0 才顯示）
- [ ] 大型重機（只有 > 0 時顯示）
- [ ] 充電格位（只有 > 0 時顯示）
- [ ] 殘障車位（只有 > 0 時顯示）
- [ ] 婦幼車位（只有 > 0 時顯示）

### 格式要求
- [ ] 使用適當的 emoji 圖示
- [ ] 適當的空行分隔
- [ ] 簡潔清晰的文字
- [ ] 不顯示 0 或「不提供」的子項目

---

## 🧪 測試案例

```typescript
// 測試案例 1: 完整資訊
const fullInfo = {
  CarParkName: { Zh_tw: '社子國小地下停車場' },
  distance: 350,
  AvailableSpaces: 45,
  TotalSpaces: 464,
  Description: '大型車:0格，小型車:464格(含身心障礙停車位10格，孕婦、育有六歲以下兒童停車位9格)，機車:211格(含身心障礙停車位5格)，大型重機:5格，充電格位:10格',
  FareDescription: '小型車(含大型重型機車)：20元/時，停車全程以半小時計；月租全日3,500元，日間2,000元(08-18)，夜間1,800元(19-08)，大型重機1,750元。',
  CarParkPosition: { PositionLat: 25.09134, PositionLon: 121.50216 }
};

// 測試案例 2: 只有充電樁
const chargingOnly = {
  CarParkName: { Zh_tw: '興隆D1社會住宅地下停車場' },
  distance: 520,
  AvailableSpaces: 28,
  TotalSpaces: 128,
  Description: '大型車:0格，小型車:128格，機車:114格，充電格位:3格',
  FareDescription: '計時：小型車(含大重機)20元/時，機車10元/時',
  CarParkPosition: { PositionLat: 24.98833, PositionLon: 121.55792 }
};

// 測試案例 3: 無特殊車位
const basicInfo = {
  CarParkName: { Zh_tw: '市政府地下停車場' },
  distance: 180,
  AvailableSpaces: 126,
  TotalSpaces: 1998,
  Description: '大型車:0格，小型車:1998格，機車:1405格',
  FareDescription: '小型車：30元/時；月租5,000元',
  CarParkPosition: { PositionLat: 25.02885, PositionLon: 121.5659 }
};

// 測試案例 4: 資訊不完整
const incompleteInfo = {
  CarParkName: { Zh_tw: '某停車場' },
  distance: null,
  AvailableSpaces: 50,
  TotalSpaces: 200,
  Description: '',
  FareDescription: null,
  CarParkPosition: null
};
```

---

## 📝 注意事項

1. **效能考量**: 正則表達式解析應該快取結果，避免重複解析
2. **容錯處理**: 所有欄位都應該有 null/undefined 檢查
3. **國際化**: 考慮未來可能需要支援其他語言
4. **可擴展性**: 設計時考慮未來可能新增的車位類型

---

**最後更新**: 2026-03-06  
**狀態**: 格式規範完成
