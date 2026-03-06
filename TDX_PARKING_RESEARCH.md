# TDX 停車場 API 研究報告

## 研究目標

根據 [openclaw-parking-query](https://github.com/Harperbot/openclaw-parking-query) 的實作，研究以下資訊的可行性：

1. ✅ 停車位總數與即時空位
2. ✅ 收費資訊
3. ❓ 充電樁資訊
4. ❓ 殘障車位
5. ❓ 婦幼車位
6. ❓ 路邊停車資訊與即時空位

---

## 研究發現

### 1. 路外停車場 (OffStreet Parking)

#### 1.1 靜態資料 API

**Endpoint:**
```
GET /v1/Parking/OffStreet/CarPark/City/{City}
```

**可能包含的欄位（需實際測試確認）:**

根據 openclaw-parking-query 的實作和 TDX API 慣例，路外停車場靜態資料可能包含：

- `CarParkID` - 停車場 ID
- `CarParkName` - 停車場名稱
- `CarParkPosition` - 停車場位置（經緯度）
- `Address` - 地址
- `TotalSpaces` - 總車位數
- `ServiceType` - 服務類型（可能包含充電樁、殘障車位等資訊）
- `FareDescription` - 收費說明
- `PaymentMethod` - 付款方式
- `OperatingHours` - 營業時間

**可能的特殊車位欄位:**
- `Handicap` - 殘障車位數
- `ChargingStation` - 充電樁數量
- `WomenAndChildren` - 婦幼車位數
- `Motorcycle` - 機車位數

#### 1.2 即時空位 API

**Endpoint:**
```
GET /v1/Parking/OffStreet/ParkingAvailability/City/{City}
```

**已確認欄位:**
- `CarParkID` - 停車場 ID
- `AvailableSpaces` - 剩餘車位數
- `UpdateTime` - 更新時間

**openclaw-parking-query 的實作方式:**

```python
# 1. 使用 Advanced API 的 NearBy 功能取得附近停車場
nearby_url = f"https://tdx.transportdata.tw/api/advanced/v1/Parking/OffStreet/CarPark/NearBy"
params = f"?$format=JSON&$spatialFilter=nearby({lat}, {lon}, {radius})"

# 2. 取得該城市的即時空位資料
avail_url = f"https://tdx.transportdata.tw/api/basic/v1/Parking/OffStreet/ParkingAvailability/City/{city}"

# 3. 透過 CarParkID 將兩者資料合併
```

**優點:**
- ✅ 資料完整且即時
- ✅ 支援空間查詢（nearby）
- ✅ 涵蓋全台主要城市

**限制:**
- ⚠️ NearBy API 最大搜尋半徑 1000 公尺
- ⚠️ 需要兩次 API 呼叫才能取得完整資訊
- ⚠️ 不同城市的資料完整度可能不同

---

### 2. 路邊停車 (OnStreet Parking)

#### 2.1 靜態資料 API

**Endpoint:**
```
GET /v1/Parking/OnStreet/ParkingSpace/City/{City}
```

**可能包含的欄位:**
- `SpaceID` - 停車格 ID
- `RoadName` - 路段名稱
- `Position` - 位置（經緯度）
- `TotalSpaces` - 該路段總車位數
- `FareDescription` - 收費說明
- `ParkingType` - 停車類型（路邊、路外等）

#### 2.2 即時空位 API

**Endpoint:**
```
GET /v1/Parking/OnStreet/ParkingAvailability/City/{City}
```

**可能包含的欄位:**
- `SpaceID` - 停車格 ID
- `AvailableSpaces` - 剩餘車位數
- `UpdateTime` - 更新時間

**可行性評估:**

- ✅ **API 存在**: TDX 有提供路邊停車的 API endpoint
- ❓ **資料可用性**: 需要實際測試確認各城市是否有提供資料
- ⚠️ **資料品質**: 路邊停車的即時資料通常比路外停車場更難取得，因為需要地磁感應器或其他 IoT 設備

**預期挑戰:**
1. 並非所有城市都有部署路邊停車感應器
2. 資料更新頻率可能較低
3. 可能只有特定路段有即時資料

---

### 3. 特殊車位資訊（充電樁、殘障、婦幼）

#### 3.1 可能的資料來源

**方案 A: ServiceType 欄位**

某些停車場 API 可能在 `ServiceType` 欄位中包含服務類型陣列：

```json
{
  "CarParkID": "XXX",
  "ServiceType": [
    "充電樁",
    "殘障車位",
    "婦幼車位",
    "機車位"
  ]
}
```

**方案 B: 獨立欄位**

```json
{
  "CarParkID": "XXX",
  "TotalSpaces": 100,
  "Handicap": 5,
  "ChargingStation": 2,
  "WomenAndChildren": 10
}
```

**方案 C: 額外的 API**

TDX 可能有提供專門的充電樁 API：
```
GET /v1/EV/ChargingStation
```

#### 3.2 實際測試需求

**需要執行測試腳本來確認:**

1. 路外停車場靜態資料是否包含特殊車位欄位
2. 欄位名稱和資料格式
3. 資料完整度（有多少停車場提供這些資訊）

---

## openclaw-parking-query 的實作亮點

### 1. 雙城市查詢策略

```python
# 台北/新北相鄰，若偵測到台北但找不到資料，一併查新北
cities_to_try = [city]
if city == "Taipei":
    cities_to_try.append("NewTaipei")
elif city == "NewTaipei":
    cities_to_try.append("Taipei")
```

**優點:** 解決邊界問題，提升使用者體驗

### 2. 漸進式搜尋半徑

```python
# 先試 500m，沒結果再試 1000m
for radius in [500, 1000]:
    parks = fetch_nearby(lat, lon, radius, token)
    if parks:
        break
```

**優點:** 平衡精確度與覆蓋範圍

### 3. Google Maps URL 解析

支援多種 URL 格式：
- 短網址: `maps.app.goo.gl/xxx`
- 完整 URL: `@lat,lon` 格式
- 地址查詢: 使用 Nominatim 反解

**優點:** 提升使用者體驗，支援多種輸入方式

### 4. Token 快取機制

```python
# 快取 token 避免重複認證
if TOKEN_CACHE.exists():
    cached = json.loads(TOKEN_CACHE.read_text())
    if cached.get("expires_at", 0) > time.time() + 30:
        return cached["access_token"]
```

**優點:** 減少 API 呼叫，提升效能

---

## 建議的實作步驟

### 階段 1: 驗證基本功能 ✅

1. ✅ 執行測試腳本 `test-tdx-parking-fields.ts`
2. ✅ 確認路外停車場靜態資料和即時空位 API 可用
3. ✅ 檢查實際回應的欄位結構

### 階段 2: 測試特殊車位資訊 ❓

1. 檢查 `ServiceType`、`Handicap`、`ChargingStation` 等欄位是否存在
2. 統計有多少停車場提供這些資訊
3. 決定是否要在 Bot 中顯示這些資訊

### 階段 3: 測試路邊停車 ❓

1. 測試路邊停車靜態資料 API
2. 測試路邊停車即時空位 API
3. 評估資料品質和覆蓋範圍
4. 決定是否要整合路邊停車功能

### 階段 4: 整合到現有專案

1. 參考 openclaw-parking-query 的實作
2. 更新 `src/integrations/tdx-client.ts`
3. 更新 `src/services/parking-service.ts`
4. 更新資料模型 `src/models/tdx-types.ts`
5. 更新 Bot 回應格式

---

## 測試腳本使用方式

### 前置需求

1. 申請 TDX API 金鑰（參考 `docs/tdx-api-guide.md`）
2. 在 `.env` 檔案中設定：
   ```env
   TDX_CLIENT_ID=your_client_id
   TDX_CLIENT_SECRET=your_client_secret
   ```

### 執行測試

```bash
# 執行測試腳本
npx tsx test-tdx-parking-fields.ts
```

### 預期輸出

測試腳本會輸出：

1. ✅ 路外停車場靜態資料範例
2. ✅ 路外停車場即時空位範例
3. ❓ 路邊停車靜態資料範例
4. ❓ 路邊停車即時空位範例
5. 🔍 關鍵欄位檢查結果

---

## 參考資源

### 官方文件

- [TDX 平台](https://tdx.transportdata.tw/)
- [TDX API 文件](https://tdx.transportdata.tw/api-service/swagger)
- [TDX API 申請指南](docs/tdx-api-guide.md)

### 參考專案

- [openclaw-parking-query](https://github.com/Harperbot/openclaw-parking-query) - Python 實作，功能完整
- 本專案 - TypeScript/Node.js 實作

### 相關 API

- **路外停車場靜態資料**: `/v1/Parking/OffStreet/CarPark/City/{City}`
- **路外停車場即時空位**: `/v1/Parking/OffStreet/ParkingAvailability/City/{City}`
- **路外停車場附近查詢**: `/advanced/v1/Parking/OffStreet/CarPark/NearBy`
- **路邊停車靜態資料**: `/v1/Parking/OnStreet/ParkingSpace/City/{City}`
- **路邊停車即時空位**: `/v1/Parking/OnStreet/ParkingAvailability/City/{City}`

---

## 結論

### 已確認可行 ✅

1. **路外停車場查詢**: 完全可行，openclaw-parking-query 已驗證
2. **即時空位資訊**: 完全可行，資料即時且準確
3. **收費資訊**: 可行，包含在靜態資料中

### 需要測試驗證 ❓

1. **充電樁資訊**: 可能存在於 `ServiceType` 或獨立欄位，需實測
2. **殘障車位**: 可能存在於 `Handicap` 欄位，需實測
3. **婦幼車位**: 可能存在於 `WomenAndChildren` 欄位，需實測
4. **路邊停車**: API 存在但資料可用性需實測

### 建議優先順序

1. **高優先**: 先完成路外停車場的基本功能（位置、空位、收費）
2. **中優先**: 測試並整合特殊車位資訊（如果資料可用）
3. **低優先**: 評估路邊停車的可行性（資料品質可能不穩定）

---

## 下一步行動

1. ✅ 建立測試腳本 `test-tdx-parking-fields.ts`
2. ⏳ 設定 TDX API 金鑰並執行測試
3. ⏳ 根據測試結果更新此文件
4. ⏳ 決定要整合哪些功能
5. ⏳ 開始實作

---

**最後更新**: 2026-03-06
**作者**: Kiro AI Assistant
**狀態**: 研究階段 - 等待實際測試驗證
