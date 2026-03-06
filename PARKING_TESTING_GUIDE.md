# 停車場 API 測試指南

本指南說明如何在本地端測試 TDX 停車場 API，驗證各種資訊的可行性。

---

## 📋 測試目標

根據 [openclaw-parking-query](https://github.com/Harperbot/openclaw-parking-query) 的成功案例，我們要驗證以下功能：

- ✅ 路外停車場位置與空位資訊
- ✅ 停車場收費資訊
- ❓ 充電樁資訊
- ❓ 殘障車位數量
- ❓ 婦幼車位數量
- ❓ 路邊停車資訊與即時空位

---

## 🚀 快速開始

### 步驟 1: 取得 TDX API 金鑰

如果你還沒有 TDX API 金鑰，請參考 [docs/tdx-api-guide.md](docs/tdx-api-guide.md) 申請。

簡要步驟：
1. 前往 https://tdx.transportdata.tw/
2. 註冊並登入
3. 在會員中心申請 API 金鑰
4. 取得 `Client ID` 和 `Client Secret`

### 步驟 2: 執行測試腳本

我們提供了兩種測試方式：

#### 方式 A: 使用命令列參數（推薦）

```bash
npx tsx test-parking-simple.ts <YOUR_CLIENT_ID> <YOUR_CLIENT_SECRET>
```

**範例:**
```bash
npx tsx test-parking-simple.ts abc123-456def-789ghi xyz987-654wvu-321tsr
```

#### 方式 B: 使用 .env 檔案

1. 複製 `.env.example` 為 `.env`
2. 在 `.env` 中設定：
   ```env
   TDX_CLIENT_ID=your_client_id
   TDX_CLIENT_SECRET=your_client_secret
   ```
3. 執行測試：
   ```bash
   npx tsx test-tdx-parking-fields.ts
   ```

---

## 📊 測試內容

測試腳本會依序測試以下 API：

### 1. 路外停車場靜態資料 (CarPark)

**API Endpoint:**
```
GET /v1/Parking/OffStreet/CarPark/City/Taipei
```

**測試目的:**
- 確認停車場基本資訊（名稱、地址、位置）
- 檢查是否有 `ServiceType`、`Handicap`、`ChargingStation` 等欄位
- 確認收費資訊 (`FareDescription`) 是否可用

**預期欄位:**
```json
{
  "CarParkID": "停車場 ID",
  "CarParkName": { "Zh_tw": "停車場名稱" },
  "CarParkPosition": {
    "PositionLat": 25.033,
    "PositionLon": 121.565
  },
  "Address": "地址",
  "TotalSpaces": 100,
  "ServiceType": ["充電樁", "殘障車位"],
  "FareDescription": { "Zh_tw": "收費說明" }
}
```

### 2. 路外停車場即時空位 (ParkingAvailability)

**API Endpoint:**
```
GET /v1/Parking/OffStreet/ParkingAvailability/City/Taipei
```

**測試目的:**
- 確認即時空位資料是否可用
- 檢查更新時間是否即時

**預期欄位:**
```json
{
  "CarParkID": "停車場 ID",
  "AvailableSpaces": 45,
  "UpdateTime": "2026-03-06T10:30:00+08:00"
}
```

### 3. 路邊停車靜態資料 (OnStreet ParkingSpace)

**API Endpoint:**
```
GET /v1/Parking/OnStreet/ParkingSpace/City/Taipei
```

**測試目的:**
- 確認路邊停車資料是否存在
- 檢查資料完整度

**注意:** 路邊停車資料可能不是所有城市都有提供。

### 4. 路邊停車即時空位 (OnStreet Availability)

**API Endpoint:**
```
GET /v1/Parking/OnStreet/ParkingAvailability/City/Taipei
```

**測試目的:**
- 確認路邊停車即時空位是否可用
- 評估資料品質

**注意:** 路邊停車即時資料需要地磁感應器等 IoT 設備，覆蓋範圍可能有限。

### 5. 附近停車場查詢 (NearBy API)

**API Endpoint:**
```
GET /advanced/v1/Parking/OffStreet/CarPark/NearBy
```

**測試目的:**
- 確認空間查詢功能
- 測試 `$spatialFilter=nearby(lat, lon, radius)` 參數

**範例:** 查詢台北 101 附近 500 公尺的停車場

---

## 📖 解讀測試結果

### 成功的輸出範例

```
📋 測試: 路外停車場靜態資料 (CarPark)
--------------------------------------------------------------------------------
URL: https://tdx.transportdata.tw/api/basic/v1/Parking/OffStreet/CarPark/City/Taipei?$top=3&$format=JSON
狀態碼: 200 OK
✅ 成功取得資料，共 3 筆

📄 第一筆資料範例:
{
  "CarParkID": "P001",
  "CarParkName": {
    "Zh_tw": "市政府地下停車場"
  },
  "TotalSpaces": 200,
  "ServiceType": ["充電樁", "殘障車位"],
  ...
}

🔍 可用欄位:
  - CarParkID (string): P001
  - CarParkName (object): {"Zh_tw":"市政府地下停車場"}
  - TotalSpaces (number): 200
  - ServiceType (object): ["充電樁","殘障車位"]
  ...
```

### 關鍵欄位檢查清單

執行測試後，請檢查以下欄位是否存在：

#### 路外停車場靜態資料
- [ ] `CarParkID` - 停車場 ID
- [ ] `CarParkName` - 停車場名稱
- [ ] `CarParkPosition` - 位置（經緯度）
- [ ] `Address` - 地址
- [ ] `TotalSpaces` - 總車位數
- [ ] `ServiceType` - 服務類型 ⭐ 重點
- [ ] `Handicap` - 殘障車位數 ⭐ 重點
- [ ] `ChargingStation` - 充電樁數量 ⭐ 重點
- [ ] `WomenAndChildren` - 婦幼車位數 ⭐ 重點
- [ ] `FareDescription` - 收費說明
- [ ] `PaymentMethod` - 付款方式
- [ ] `OperatingHours` - 營業時間

#### 路外停車場即時空位
- [ ] `CarParkID` - 停車場 ID
- [ ] `AvailableSpaces` - 剩餘車位數
- [ ] `UpdateTime` - 更新時間

#### 路邊停車
- [ ] 是否有資料回傳
- [ ] 資料完整度如何
- [ ] 是否有即時空位資訊

---

## 🔍 openclaw-parking-query 的實作參考

### 核心實作邏輯

```python
# 1. 使用 NearBy API 取得附近停車場（最大 1000m）
nearby_url = "https://tdx.transportdata.tw/api/advanced/v1/Parking/OffStreet/CarPark/NearBy"
params = f"?$format=JSON&$spatialFilter=nearby({lat}, {lon}, {radius})"

# 2. 取得該城市的即時空位資料
avail_url = f"https://tdx.transportdata.tw/api/basic/v1/Parking/OffStreet/ParkingAvailability/City/{city}"

# 3. 透過 CarParkID 將兩者資料合併
for park in nearby_parks:
    avail = availability_map.get(park['CarParkID'])
    if avail and avail['AvailableSpaces'] > 0:
        results.append({
            'name': park['CarParkName'],
            'spaces': avail['AvailableSpaces'],
            'distance': calculate_distance(lat, lon, park['Position'])
        })
```

### 關鍵特性

1. **雙城市查詢**: 台北/新北邊界自動查詢兩個城市
2. **漸進式搜尋**: 先試 500m，沒結果再試 1000m
3. **Token 快取**: 避免重複認證
4. **Google Maps 整合**: 支援多種 URL 格式解析

---

## 📝 測試結果記錄

完成測試後，請在 `TDX_PARKING_RESEARCH.md` 中更新以下資訊：

### 路外停車場

- [ ] 靜態資料 API 可用
- [ ] 即時空位 API 可用
- [ ] 收費資訊可用
- [ ] 充電樁資訊: ⬜ 可用 / ⬜ 不可用 / ⬜ 部分可用
- [ ] 殘障車位: ⬜ 可用 / ⬜ 不可用 / ⬜ 部分可用
- [ ] 婦幼車位: ⬜ 可用 / ⬜ 不可用 / ⬜ 部分可用

### 路邊停車

- [ ] 靜態資料 API 可用
- [ ] 即時空位 API 可用
- [ ] 資料品質: ⬜ 良好 / ⬜ 普通 / ⬜ 不佳
- [ ] 覆蓋範圍: ⬜ 廣泛 / ⬜ 有限 / ⬜ 極少

---

## 🎯 下一步行動

根據測試結果，決定要整合哪些功能：

### 優先級 1: 基本功能（必須）
- [ ] 路外停車場位置查詢
- [ ] 即時空位顯示
- [ ] 收費資訊顯示
- [ ] 導航連結

### 優先級 2: 進階功能（建議）
- [ ] 充電樁資訊（如果可用）
- [ ] 殘障車位資訊（如果可用）
- [ ] 婦幼車位資訊（如果可用）
- [ ] 雙城市查詢（台北/新北）

### 優先級 3: 額外功能（可選）
- [ ] 路邊停車查詢（如果資料品質良好）
- [ ] 停車場評分/評論
- [ ] 歷史資料分析

---

## 🐛 常見問題

### Q1: 認證失敗怎麼辦？

**錯誤訊息:**
```
認證失敗: 401 Unauthorized
```

**解決方法:**
1. 確認 Client ID 和 Client Secret 正確
2. 檢查 API 金鑰是否已啟用
3. 確認金鑰沒有過期

### Q2: API 回應 404 Not Found

**可能原因:**
1. 城市名稱拼寫錯誤（應使用英文，如 `Taipei` 而非 `台北`）
2. 該城市沒有提供此類資料
3. API endpoint 路徑錯誤

### Q3: 資料為空

**可能原因:**
1. 該城市確實沒有資料
2. 查詢條件太嚴格（如搜尋半徑太小）
3. 資料尚未更新

### Q4: 某些欄位不存在

**說明:**
- 不同城市提供的資料欄位可能不同
- 某些進階欄位（如充電樁）可能只有部分停車場提供
- 這是正常現象，需要在程式中做好容錯處理

---

## 📚 相關文件

- [TDX_PARKING_RESEARCH.md](TDX_PARKING_RESEARCH.md) - 詳細研究報告
- [docs/tdx-api-guide.md](docs/tdx-api-guide.md) - TDX API 申請指南
- [openclaw-parking-query](https://github.com/Harperbot/openclaw-parking-query) - 參考實作

---

## 💡 提示

1. **測試時機**: 建議在白天測試，資料更新較頻繁
2. **測試地點**: 選擇市中心或熱門地點，資料較完整
3. **多次測試**: 不同時間、不同城市多測試幾次
4. **記錄結果**: 將測試結果截圖或複製到文件中

---

**祝測試順利！** 🎉

如有問題，請參考 `TDX_PARKING_RESEARCH.md` 或查看 TDX 官方文件。
