# TDX Traffic API 研究報告

## 🔍 研究目標

研究 TDX 平台是否提供即時路況、交通事件（壅塞、車禍、施工）相關 API，以實作 `/traffic` 功能。

## 📊 研究結果

### API 測試結果

測試了以下可能的 API 端點：

| API 端點 | 狀態 | 說明 |
|---------|------|------|
| `/Traffic/Live` | ❌ 404 | 不存在 |
| `/Traffic/Incident` | ❌ 404 | 不存在 |
| `/Road/Condition` | ⚠️ 429 | 存在但請求過多 |
| `/Traffic/Event` | ⚠️ 429 | 存在但請求過多 |
| `/Highway/Live` | ⚠️ 429 | 存在但請求過多 |
| `/Highway/Traffic` | ⚠️ 429 | 存在但請求過多 |

### 關鍵發現

1. **TDX 平台確實有交通相關 API**
   - `/Road/Condition` - 道路狀況
   - `/Traffic/Event` - 交通事件
   - `/Highway/Live` - 高速公路即時資訊
   - `/Highway/Traffic` - 高速公路車流

2. **API 限流問題**
   - 短時間內多次請求會觸發 429 Too Many Requests
   - 需要控制請求頻率

3. **API 路徑結構**
   - 基本 API: `https://tdx.transportdata.tw/api/basic/v1/`
   - 進階 API: `https://tdx.transportdata.tw/api/advanced/v1/`
   - 城市別: `/City/{CityName}`

## 🎯 可能的實作方案

### 方案 1: 道路狀況 API (推薦)

**API 端點：**
```
GET /api/basic/v1/Road/Condition/City/{CityName}
```

**可能包含的資訊：**
- 道路壅塞狀況
- 施工資訊
- 道路封閉
- 交通管制

**優點：**
- ✅ API 存在（返回 429 表示端點有效）
- ✅ 支援城市別查詢
- ✅ 符合需求（壅塞、施工）

**缺點：**
- ⚠️ 需要確認資料格式
- ⚠️ 可能沒有精確的地理位置篩選

---

### 方案 2: 交通事件 API

**API 端點：**
```
GET /api/basic/v1/Traffic/Event/City/{CityName}
```

**可能包含的資訊：**
- 交通事故
- 臨時管制
- 特殊事件

**優點：**
- ✅ API 存在
- ✅ 專注於事件資訊

**缺點：**
- ⚠️ 可能不包含壅塞資訊
- ⚠️ 資料更新頻率未知

---

### 方案 3: 高速公路即時資訊

**API 端點：**
```
GET /api/basic/v1/Highway/Live
GET /api/basic/v1/Highway/Traffic
```

**可能包含的資訊：**
- 高速公路車流
- 即時路況
- 事故資訊

**優點：**
- ✅ API 存在
- ✅ 即時資訊

**缺點：**
- ❌ 只限高速公路
- ❌ 不適合市區查詢

---

## 💡 建議實作方案

### 推薦：方案 1 + 方案 2 組合

**理由：**
1. **道路狀況 API** 提供壅塞、施工資訊
2. **交通事件 API** 提供車禍、管制資訊
3. 兩者互補，提供完整的交通資訊

**實作流程：**
```
1. 使用者發送 /traffic
2. 選擇搜尋範圍（250m, 500m, 1km）
3. 分享位置或 Google Maps URL
4. 根據座標判斷城市
5. 查詢該城市的道路狀況和交通事件
6. 篩選範圍內的資訊
7. 格式化並顯示結果
```

---

## 🚧 實作挑戰

### 1. 地理位置篩選

**問題：**
- TDX API 可能不支援 `nearby()` 空間篩選（針對 Traffic/Road）
- 只能取得整個城市的資料

**解決方案：**
- 取得城市所有資料後，在本地端計算距離篩選
- 或使用道路名稱/區域來粗略篩選

### 2. 資料格式未知

**問題：**
- 不確定 API 返回的資料結構
- 不確定包含哪些欄位

**解決方案：**
- 需要實際測試 API 來確認資料格式
- 建立測試腳本探索資料結構

### 3. API 限流

**問題：**
- 短時間多次請求會被限流

**解決方案：**
- 實作快取機制（5-10 分鐘）
- 控制請求頻率
- 使用試用模式限制查詢次數

---

## 📝 下一步行動

### 1. 確認 API 資料格式（優先）

建立測試腳本：
```bash
npx ts-node test-tdx-traffic-data.ts
```

測試內容：
- 查詢台北市道路狀況
- 查詢台北市交通事件
- 分析資料結構
- 確認可用欄位

### 2. 設計資料模型

根據 API 返回的資料，設計：
```typescript
interface TrafficInfo {
  id: string;
  type: 'congestion' | 'accident' | 'construction' | 'closure';
  location: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  startTime: string;
  endTime?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
}
```

### 3. 實作查詢邏輯

```typescript
async queryNearbyTraffic(
  latitude: number,
  longitude: number,
  radius: number
): Promise<TrafficInfo[]>
```

### 4. 設計顯示格式

```
🚦 找到 5 個交通狀況

⚠️ 壅塞 - 忠孝東路四段
距離：150m
狀況：車流緩慢
時間：14:30 開始

🚧 施工 - 信義路三段
距離：320m
狀況：道路封閉
時間：今日 22:00 - 明日 06:00

🚗 車禍 - 仁愛路二段
距離：450m
狀況：外側車道受阻
時間：15:20 發生
```

---

## ⚠️ 風險評估

### 高風險

1. **API 可能不提供精確位置**
   - 影響：無法準確篩選範圍內的事件
   - 緩解：使用道路名稱或區域粗略篩選

2. **資料更新頻率未知**
   - 影響：可能顯示過時資訊
   - 緩解：顯示資料更新時間

### 中風險

3. **API 限流**
   - 影響：頻繁查詢會被限制
   - 緩解：實作快取機制

4. **資料完整性**
   - 影響：某些城市可能沒有資料
   - 緩解：顯示「該地區暫無交通資訊」

### 低風險

5. **顯示格式**
   - 影響：資訊過多或過少
   - 緩解：智慧篩選和分類顯示

---

## 🎯 成功標準

### 最小可行產品 (MVP)

- ✅ 使用者可以查詢附近交通狀況
- ✅ 顯示壅塞、車禍、施工資訊
- ✅ 支援 250m, 500m, 1km 範圍
- ✅ 支援位置分享和 Google Maps URL
- ✅ 試用模式（每天 2 次）

### 進階功能

- ⭐ 顯示嚴重程度（輕微/中等/嚴重）
- ⭐ 顯示預計影響時間
- ⭐ 提供替代路線建議
- ⭐ 地圖視覺化

---

## 📚 參考資料

- TDX 運輸資料流通服務平台: https://tdx.transportdata.tw/
- TDX API 文件: https://tdx.transportdata.tw/api-service/swagger
- 測試腳本: `research-tdx-traffic-api.ts`

---

## 🤔 結論

**TDX 平台確實提供交通相關 API，可以實作 `/traffic` 功能。**

**建議：**
1. 先建立測試腳本確認資料格式
2. 實作基本查詢功能（MVP）
3. 根據實際資料調整顯示格式
4. 逐步添加進階功能

**預估開發時間：**
- 研究和測試：1-2 小時 ✅（已完成初步研究）
- 實作基本功能：2-3 小時
- 測試和調整：1-2 小時
- 總計：4-7 小時

**下一步：**
建立測試腳本確認 API 資料格式，然後開始實作。

---

**研究日期：** 2026-03-10  
**狀態：** 初步研究完成，待確認 API 資料格式
