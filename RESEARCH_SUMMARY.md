# 停車場 API 研究總結

## 📌 研究目標

根據 [openclaw-parking-query](https://github.com/Harperbot/openclaw-parking-query) 專案，研究 TDX API 取得以下資訊的可行性：

1. 停車位總數與即時空位 ✅
2. 收費資訊 ✅
3. 充電樁資訊 ❓
4. 殘障車位 ❓
5. 婦幼車位 ❓
6. 路邊停車資訊與即時空位 ❓

---

## 🎯 研究成果

### 已建立的文件

1. **TDX_PARKING_RESEARCH.md** - 詳細研究報告
   - TDX API 端點分析
   - openclaw-parking-query 實作解析
   - 資料欄位推測
   - 實作建議

2. **PARKING_TESTING_GUIDE.md** - 測試指南
   - 如何取得 TDX API 金鑰
   - 測試腳本使用方式
   - 測試結果解讀
   - 常見問題排解

3. **test-parking-simple.ts** - 簡化測試腳本
   - 支援命令列參數
   - 測試 5 種 API 端點
   - 自動分析回應欄位

4. **test-tdx-parking-fields.ts** - 完整測試腳本
   - 使用 .env 檔案
   - 詳細的欄位檢查
   - 格式化輸出

---

## 🔍 主要發現

### 1. openclaw-parking-query 的成功實作

該專案已成功實作以下功能：

✅ **路外停車場查詢**
- 使用 Advanced API 的 NearBy 功能
- 支援 500m 和 1000m 搜尋半徑
- 自動偵測城市並查詢即時空位

✅ **即時空位資訊**
- 透過 ParkingAvailability API 取得
- 資料即時且準確
- 支援全台主要城市

✅ **智慧功能**
- 雙城市查詢（台北/新北邊界處理）
- Google Maps URL 解析
- Token 快取機制
- Markdown 格式輸出

### 2. 核心實作邏輯

```python
# 步驟 1: 使用 NearBy API 取得附近停車場
nearby_parks = fetch_nearby(lat, lon, radius, token)

# 步驟 2: 取得該城市的即時空位資料
availability = fetch_availability(city, token)

# 步驟 3: 合併資料並過濾有空位的停車場
results = []
for park in nearby_parks:
    avail = availability_map.get(park['CarParkID'])
    if avail and avail['AvailableSpaces'] > 0:
        results.append({
            'name': park['CarParkName'],
            'spaces': avail['AvailableSpaces'],
            'distance': calculate_distance(...)
        })
```

### 3. 待驗證的功能

以下功能需要實際測試 TDX API 才能確認：

❓ **充電樁資訊**
- 可能在 `ServiceType` 欄位中
- 或有獨立的 `ChargingStation` 欄位
- 需要檢查資料完整度

❓ **殘障車位**
- 可能有 `Handicap` 欄位
- 或在 `ServiceType` 中標註
- 需要確認欄位格式

❓ **婦幼車位**
- 可能有 `WomenAndChildren` 欄位
- 或在 `ServiceType` 中標註
- 需要確認是否普遍提供

❓ **路邊停車**
- TDX 有提供 OnStreet API
- 但資料可用性未知
- 需要測試各城市的覆蓋範圍

---

## 🚀 如何進行測試

### 方法 1: 快速測試（推薦）

```bash
# 使用命令列參數直接測試
npx tsx test-parking-simple.ts <YOUR_CLIENT_ID> <YOUR_CLIENT_SECRET>
```

### 方法 2: 使用 .env 檔案

```bash
# 1. 設定環境變數
echo "TDX_CLIENT_ID=your_id" >> .env
echo "TDX_CLIENT_SECRET=your_secret" >> .env

# 2. 執行測試
npx tsx test-tdx-parking-fields.ts
```

### 測試內容

測試腳本會自動測試以下 API：

1. ✅ 路外停車場靜態資料 (CarPark)
2. ✅ 路外停車場即時空位 (ParkingAvailability)
3. ❓ 路邊停車靜態資料 (OnStreet ParkingSpace)
4. ❓ 路邊停車即時空位 (OnStreet Availability)
5. ✅ 附近停車場查詢 (NearBy API)

---

## 📊 預期測試結果

### 高信心度（應該可用）

基於 openclaw-parking-query 的成功案例：

- ✅ 路外停車場位置
- ✅ 即時空位數量
- ✅ 停車場名稱、地址
- ✅ 收費資訊（FareDescription）
- ✅ 總車位數（TotalSpaces）

### 中信心度（可能可用）

需要實測確認：

- ❓ 充電樁資訊
- ❓ 殘障車位數量
- ❓ 婦幼車位數量
- ❓ 營業時間
- ❓ 付款方式

### 低信心度（可用性未知）

需要評估資料品質：

- ❓ 路邊停車位置
- ❓ 路邊停車即時空位
- ❓ 停車場評分/評論

---

## 💡 實作建議

### 階段 1: MVP（最小可行產品）

優先實作已驗證可行的功能：

```typescript
// 1. 路外停車場查詢
async function searchNearbyParking(lat: number, lon: number, radius: number) {
  // 使用 NearBy API
  const nearbyParks = await fetchNearby(lat, lon, radius);
  
  // 取得即時空位
  const city = detectCity(lat, lon);
  const availability = await fetchAvailability(city);
  
  // 合併資料
  return mergeData(nearbyParks, availability);
}

// 2. 顯示基本資訊
function formatParkingInfo(parking: Parking) {
  return `
📍 ${parking.name}
距離：${parking.distance} 公尺
剩餘車位：${parking.availableSpaces} / ${parking.totalSpaces}
收費：${parking.fee || '資訊未提供'}
[導航](${generateNavLink(parking)})
  `;
}
```

### 階段 2: 進階功能

測試通過後再加入：

```typescript
// 3. 特殊車位資訊（如果可用）
if (parking.chargingStation) {
  info += `⚡ 充電樁：${parking.chargingStation} 個\n`;
}
if (parking.handicap) {
  info += `♿ 殘障車位：${parking.handicap} 個\n`;
}
if (parking.womenAndChildren) {
  info += `👶 婦幼車位：${parking.womenAndChildren} 個\n`;
}
```

### 階段 3: 路邊停車（可選）

評估資料品質後決定是否實作：

```typescript
// 4. 路邊停車查詢（如果資料品質良好）
async function searchOnStreetParking(lat: number, lon: number) {
  const city = detectCity(lat, lon);
  const onStreetSpaces = await fetchOnStreetSpaces(city);
  const availability = await fetchOnStreetAvailability(city);
  
  return mergeOnStreetData(onStreetSpaces, availability);
}
```

---

## 🎯 下一步行動

### 立即行動

1. ✅ 取得 TDX API 金鑰（參考 `docs/tdx-api-guide.md`）
2. ⏳ 執行測試腳本 `test-parking-simple.ts`
3. ⏳ 記錄測試結果到 `TDX_PARKING_RESEARCH.md`

### 根據測試結果

#### 如果基本功能可用
- 開始實作 MVP
- 參考 openclaw-parking-query 的邏輯
- 整合到現有的 Telegram Bot

#### 如果特殊車位資訊可用
- 更新資料模型 (`src/models/tdx-types.ts`)
- 在 Bot 回應中顯示這些資訊
- 考慮加入篩選功能（只顯示有充電樁的停車場）

#### 如果路邊停車可用
- 評估資料品質和覆蓋範圍
- 決定是否要整合
- 考慮分開顯示路外和路邊停車

---

## 📚 參考資源

### 文件

- [TDX_PARKING_RESEARCH.md](TDX_PARKING_RESEARCH.md) - 詳細研究報告
- [PARKING_TESTING_GUIDE.md](PARKING_TESTING_GUIDE.md) - 測試指南
- [docs/tdx-api-guide.md](docs/tdx-api-guide.md) - API 申請指南

### 程式碼

- [test-parking-simple.ts](test-parking-simple.ts) - 簡化測試腳本
- [test-tdx-parking-fields.ts](test-tdx-parking-fields.ts) - 完整測試腳本
- [openclaw-parking-query](https://github.com/Harperbot/openclaw-parking-query) - 參考實作

### API 端點

```
# 路外停車場
GET /v1/Parking/OffStreet/CarPark/City/{City}
GET /v1/Parking/OffStreet/ParkingAvailability/City/{City}
GET /advanced/v1/Parking/OffStreet/CarPark/NearBy

# 路邊停車
GET /v1/Parking/OnStreet/ParkingSpace/City/{City}
GET /v1/Parking/OnStreet/ParkingAvailability/City/{City}
```

---

## ✅ 總結

### 已完成

1. ✅ 研究 openclaw-parking-query 的實作方式
2. ✅ 分析 TDX API 的可用端點
3. ✅ 建立測試腳本和文件
4. ✅ 提供實作建議和優先順序

### 待完成

1. ⏳ 執行實際測試（需要 TDX API 金鑰）
2. ⏳ 確認特殊車位資訊的可用性
3. ⏳ 評估路邊停車的資料品質
4. ⏳ 根據測試結果更新實作計畫

### 信心評估

- **路外停車場基本功能**: 95% 信心（已有成功案例）
- **收費資訊**: 90% 信心（通常包含在靜態資料中）
- **充電樁/殘障/婦幼車位**: 50% 信心（需實測）
- **路邊停車**: 30% 信心（資料可用性未知）

---

## 🎉 結語

基於 openclaw-parking-query 的成功案例，我們有很高的信心可以實作路外停車場的基本查詢功能。特殊車位資訊和路邊停車功能需要實際測試才能確認可行性。

建議先完成 MVP（路外停車場 + 即時空位 + 收費資訊），再根據測試結果決定是否加入進階功能。

**下一步：執行測試腳本，驗證 API 可用性！** 🚀

---

**文件建立時間**: 2026-03-06  
**作者**: Kiro AI Assistant  
**狀態**: 研究完成，等待實測驗證
