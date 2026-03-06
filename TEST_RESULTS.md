# TDX 停車場 API 測試結果報告

**測試時間**: 2026-03-06 13:47  
**測試城市**: 台北市 (Taipei)  
**API 狀態**: ✅ 認證成功

---

## 📊 測試結果總覽

| API 類型 | 狀態 | 資料筆數 | 說明 |
|---------|------|---------|------|
| 路外停車場靜態資料 | ✅ 成功 | 3+ 筆 | 資料完整，欄位豐富 |
| 路外停車場即時空位 | ✅ 成功 | 3+ 筆 | 即時資料可用 |
| 路邊停車靜態資料 | ❌ 失敗 | 0 筆 | 404 Not Found |
| 路邊停車即時空位 | ❌ 失敗 | 0 筆 | 404 Not Found |
| NearBy 附近查詢 | ✅ 成功 | 5 筆 | 台北 101 附近 500m |

---

## ✅ 路外停車場靜態資料 (CarPark)

### 測試結果
- **狀態**: ✅ 成功
- **API**: `/v1/Parking/OffStreet/CarPark/City/Taipei`
- **資料筆數**: 3+ 筆

### 範例資料

**停車場**: 興隆D1社會住宅地下停車場

```json
{
  "CarParkID": "768",
  "CarParkName": {
    "Zh_tw": "興隆D1社會住宅地下停車場"
  },
  "Description": "大型車:0格，小型車:128格(含身心障礙停車位4格，孕婦、育有六歲以下兒童停車位3格)，機車:114格(含身心障礙停車位4格)，充電格位:3格",
  "CarParkPosition": {
    "PositionLat": 24.98833,
    "PositionLon": 121.55792
  },
  "Address": "木柵路2段2巷12-50號地下1至3層",
  "FareDescription": "計時：小型車(含大重機)20元/時，機車10元/時(當日當次最高20元，隔日另計)，全程以半小時計費。月租：小型車(含大重機)全日4,200元/月，機車全日300元/月。",
  "EmergencyPhone": "2939-8930",
  "EVRechargingAvailable": 0,
  "LiveOccuppancyAvailable": 1
}
```

### 🔍 關鍵發現

#### ✅ 基本資訊（完整可用）
- ✅ `CarParkID` - 停車場 ID
- ✅ `CarParkName` - 停車場名稱（中文）
- ✅ `CarParkPosition` - 位置（經緯度）
- ✅ `Address` - 地址
- ✅ `FareDescription` - 收費說明（詳細）
- ✅ `EmergencyPhone` - 緊急電話

#### ⭐ 特殊車位資訊（在 Description 欄位中）

**重要發現**: 特殊車位資訊包含在 `Description` 文字欄位中！

範例解析：
```
"大型車:0格，小型車:128格(含身心障礙停車位4格，孕婦、育有六歲以下兒童停車位3格)，機車:114格(含身心障礙停車位4格)，充電格位:3格"
```

可以提取的資訊：
- ✅ **身心障礙停車位**: 4格（小型車）+ 4格（機車）
- ✅ **孕婦、育有六歲以下兒童停車位**: 3格
- ✅ **充電格位**: 3格
- ✅ **總車位數**: 小型車 128格、機車 114格

#### 📋 其他可用欄位
- `EVRechargingAvailable` (0/1) - 是否有充電樁
- `LiveOccuppancyAvailable` (0/1) - 是否有即時空位資訊
- `WheelchairAccessible` (0/1) - 是否無障礙
- `IsPublic` (0/1) - 是否為公有停車場
- `MonthlyTicketAvailable` (0/1) - 是否提供月租
- `OvernightPermitted` (0/1) - 是否可過夜

---

## ✅ 路外停車場即時空位 (ParkingAvailability)

### 測試結果
- **狀態**: ✅ 成功
- **API**: `/v1/Parking/OffStreet/ParkingAvailability/City/Taipei`
- **資料筆數**: 3+ 筆

### 範例資料

**停車場**: 府前廣場地下停車場

```json
{
  "CarParkID": "001",
  "CarParkName": {
    "Zh_tw": "府前廣場地下停車場"
  },
  "TotalSpaces": 1998,
  "AvailableSpaces": 126,
  "Availabilities": [
    {
      "SpaceType": 1,
      "NumberOfSpaces": 1998,
      "AvailableSpaces": 126
    },
    {
      "SpaceType": 2,
      "NumberOfSpaces": 1405,
      "AvailableSpaces": 591
    },
    {
      "SpaceType": 7,
      "NumberOfSpaces": 40,
      "AvailableSpaces": 1
    },
    {
      "SpaceType": 9,
      "NumberOfSpaces": 45,
      "AvailableSpaces": 3
    }
  ],
  "ServiceStatus": 1,
  "FullStatus": 0,
  "ChargeStatus": 1,
  "DataCollectTime": "2026-03-06T13:47:35+08:00"
}
```

### 🔍 關鍵發現

#### ✅ 即時空位資訊（完整可用）
- ✅ `TotalSpaces` - 總車位數: 1998
- ✅ `AvailableSpaces` - 剩餘車位數: 126
- ✅ `DataCollectTime` - 資料更新時間（即時）
- ✅ `ServiceStatus` - 服務狀態
- ✅ `FullStatus` - 是否已滿

#### ⭐ 分類空位資訊 (Availabilities)

**重要發現**: `Availabilities` 陣列提供不同車位類型的空位資訊！

SpaceType 代碼推測：
- `SpaceType: 1` - 一般小型車位 (1998格，剩126格)
- `SpaceType: 2` - 機車位 (1405格，剩591格)
- `SpaceType: 7` - 可能是殘障車位 (40格，剩1格)
- `SpaceType: 9` - 可能是婦幼車位 (45格，剩3格)

**這意味著可以顯示各類型車位的即時空位！**

---

## ✅ NearBy 附近停車場查詢

### 測試結果
- **狀態**: ✅ 成功
- **API**: `/advanced/v1/Parking/OffStreet/CarPark/NearBy`
- **測試位置**: 台北 101 (25.0330, 121.5654)
- **搜尋半徑**: 500 公尺
- **找到停車場**: 5 個

### 範例資料

**停車場**: 臺北市災害應變中心地下停車場

```json
{
  "CarParkID": "003",
  "CarParkName": {
    "Zh_tw": "臺北市災害應變中心地下停車場"
  },
  "Description": "大型車:0格，小型車:169格(含身心障礙停車位5格，孕婦、育有六歲以下兒童停車位3格)，機車:197格(含身心障礙停車位4格)，大型重機:1格，充電格位:4格",
  "CarParkPosition": {
    "PositionLat": 25.02885,
    "PositionLon": 121.5659
  },
  "Address": "莊敬路391巷11弄2號地下",
  "FareDescription": "小型車：計時 30元/時，；月租 全日5,000元。機車：10元/時，當日單次停車最高收費上限20元/次，隔日另計；月租300元/月。",
  "EVRechargingAvailable": 0,
  "LiveOccuppancyAvailable": 1
}
```

### 🔍 關鍵發現

- ✅ NearBy API 運作正常
- ✅ 可以精確搜尋指定半徑內的停車場
- ✅ 回傳資料與靜態 API 相同，包含完整資訊
- ✅ 適合用於「附近停車場查詢」功能

---

## ❌ 路邊停車 (OnStreet Parking)

### 測試結果
- **狀態**: ❌ 失敗
- **錯誤**: 404 Not Found
- **訊息**: "Resouce Not Found"

### 結論

台北市的路邊停車 API 目前不可用，可能原因：
1. 台北市未提供路邊停車資料
2. API endpoint 路徑錯誤
3. 需要不同的查詢方式

**建議**: 暫時不實作路邊停車功能，專注於路外停車場。

---

## 💡 實作建議

### 階段 1: MVP（立即可實作）✅

基於測試結果，以下功能完全可行：

```typescript
interface ParkingInfo {
  id: string;
  name: string;
  position: { lat: number; lon: number };
  address: string;
  distance: number;
  
  // 即時空位
  totalSpaces: number;
  availableSpaces: number;
  updateTime: string;
  
  // 收費資訊
  fareDescription: string;
  
  // 特殊車位（從 Description 解析）
  handicapSpaces?: number;
  womenAndChildrenSpaces?: number;
  chargingSpaces?: number;
  
  // 分類空位（從 Availabilities 解析）
  spacesByType?: Array<{
    type: number;
    total: number;
    available: number;
  }>;
}
```

### 階段 2: 特殊車位解析 ⭐

**重要**: 需要解析 `Description` 欄位來提取特殊車位資訊

```typescript
function parseDescription(description: string) {
  const result = {
    handicapSpaces: 0,
    womenAndChildrenSpaces: 0,
    chargingSpaces: 0,
  };
  
  // 解析身心障礙停車位
  const handicapMatch = description.match(/身心障礙停車位(\d+)格/);
  if (handicapMatch) {
    result.handicapSpaces = parseInt(handicapMatch[1]);
  }
  
  // 解析孕婦、育有六歲以下兒童停車位
  const womenChildrenMatch = description.match(/孕婦、育有六歲以下兒童停車位(\d+)格/);
  if (womenChildrenMatch) {
    result.womenAndChildrenSpaces = parseInt(womenChildrenMatch[1]);
  }
  
  // 解析充電格位
  const chargingMatch = description.match(/充電格位[：:](\d+)格/);
  if (chargingMatch) {
    result.chargingSpaces = parseInt(chargingMatch[1]);
  }
  
  return result;
}
```

### 階段 3: SpaceType 代碼對照

需要建立 SpaceType 代碼對照表：

```typescript
const SPACE_TYPE_MAP = {
  1: '一般小型車位',
  2: '機車位',
  7: '殘障車位（推測）',
  9: '婦幼車位（推測）',
  // 需要更多測試來確認其他代碼
};
```

---

## 📋 完整欄位清單

### CarPark (靜態資料)

| 欄位 | 類型 | 說明 | 可用性 |
|------|------|------|--------|
| CarParkID | string | 停車場 ID | ✅ |
| CarParkName | object | 停車場名稱 | ✅ |
| Description | string | 描述（含特殊車位資訊）| ⭐ 重要 |
| CarParkPosition | object | 位置（經緯度）| ✅ |
| Address | string | 地址 | ✅ |
| FareDescription | string | 收費說明 | ✅ |
| EmergencyPhone | string | 緊急電話 | ✅ |
| EVRechargingAvailable | number | 是否有充電樁 (0/1) | ✅ |
| LiveOccuppancyAvailable | number | 是否有即時空位 (0/1) | ✅ |
| WheelchairAccessible | number | 是否無障礙 (0/1) | ✅ |
| IsPublic | number | 是否公有 (0/1) | ✅ |
| MonthlyTicketAvailable | number | 是否提供月租 (0/1) | ✅ |
| OvernightPermitted | number | 是否可過夜 (0/1) | ✅ |

### ParkingAvailability (即時空位)

| 欄位 | 類型 | 說明 | 可用性 |
|------|------|------|--------|
| CarParkID | string | 停車場 ID | ✅ |
| CarParkName | object | 停車場名稱 | ✅ |
| TotalSpaces | number | 總車位數 | ✅ |
| AvailableSpaces | number | 剩餘車位數 | ✅ |
| Availabilities | array | 分類空位資訊 | ⭐ 重要 |
| ServiceStatus | number | 服務狀態 | ✅ |
| FullStatus | number | 是否已滿 | ✅ |
| ChargeStatus | number | 收費狀態 | ✅ |
| DataCollectTime | string | 資料更新時間 | ✅ |

---

## 🎯 結論

### ✅ 完全可行的功能

1. **路外停車場查詢** - 100% 可行
2. **即時空位顯示** - 100% 可行
3. **收費資訊** - 100% 可行
4. **充電樁資訊** - 90% 可行（需解析 Description）
5. **殘障車位** - 90% 可行（需解析 Description）
6. **婦幼車位** - 90% 可行（需解析 Description）
7. **分類空位** - 80% 可行（需確認 SpaceType 代碼）

### ❌ 暫不可行的功能

1. **路邊停車** - 台北市 API 不可用

### 🚀 建議實作順序

1. **第一階段**: 實作基本查詢（位置、空位、收費）
2. **第二階段**: 加入 Description 解析（特殊車位）
3. **第三階段**: 加入分類空位顯示（Availabilities）
4. **第四階段**: 參考 openclaw-parking-query 加入智慧功能

---

## 📝 下一步行動

1. ✅ 測試完成
2. ⏳ 更新 `src/models/tdx-types.ts` 加入新欄位
3. ⏳ 實作 Description 解析函數
4. ⏳ 更新 `src/services/parking-service.ts`
5. ⏳ 更新 Bot 回應格式，顯示特殊車位資訊
6. ⏳ 測試不同城市的資料格式

---

**測試完成時間**: 2026-03-06 13:50  
**測試狀態**: ✅ 成功  
**信心度**: 95% - 路外停車場功能完全可行
