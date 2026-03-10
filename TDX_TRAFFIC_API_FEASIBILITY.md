# TDX Traffic API 可行性驗證報告

**測試日期:** 2026-03-10  
**測試狀態:** ✅ 驗證成功

---

## 📊 測試總結

經過完整測試，確認 TDX 平台提供的路況 API **完全可行**，可以實作 `/traffic` 功能。

### ✅ 可用的 API

| API 名稱 | 端點 | 狀態 | 用途 |
|---------|------|------|------|
| **VD NearBy** | `/v2/Road/Traffic/VD/NearBy` | ✅ 可用 | 查詢附近車輛偵測器位置 |
| **VD Live** | `/v2/Road/Traffic/Live/VD/City/{City}` | ✅ 可用 | 取得即時車流資料（速度、流量） |
| **CMS NearBy** | `/v2/Road/Traffic/CMS/NearBy` | ✅ 可用 | 查詢附近資訊可變標誌位置 |
| **CMS Live** | `/v2/Road/Traffic/Live/CMS/City/{City}` | ✅ 可用 | 取得即時路況訊息（壅塞、事故、施工） |
| **CCTV NearBy** | `/v2/Road/Traffic/CCTV/NearBy` | ✅ 可用 | 查詢附近監視器位置 |

---

## 🎯 推薦實作方案

### 方案：使用 CMS Live API（推薦）

**理由：**
- ✅ 直接提供官方發布的路況訊息
- ✅ 訊息類型完整：壅塞、事故、施工、停車、政令宣導
- ✅ 訊息內容清晰，可直接顯示給使用者
- ✅ 符合使用者需求（查詢壅塞、車禍、施工）

**實作流程：**
```
1. 使用者發送 /traffic
2. 選擇搜尋範圍（250m, 500m, 1km）
3. 分享位置
4. 呼叫 CMS NearBy API 取得附近的 CMS 設備
5. 呼叫 CMS Live API 取得即時訊息
6. 篩選並顯示路況資訊
```

**可選增強：**
- 加入 VD Live API 顯示即時車速和車流量
- 提供更詳細的路況分析

---

## 📋 API 測試結果

### 1. CMS NearBy API

**測試位置：** 台北市政府 (25.0408, 121.5678)  
**搜尋半徑：** 1000m  
**結果：** ✅ 成功

```
找到 9 個 CMS 設備
距離範圍：521m - 998m
```

**資料結構：**
```json
{
  "CMSID": "X0381G0",
  "LinkID": "2000201007000A",
  "LocationType": 1,
  "PositionLon": 121.56854,
  "PositionLat": 25.04575,
  "RoadID": "200020",
  "RoadName": "市民大道高架道路",
  "RoadClass": 2,
  "RoadDirection": "E"
}
```

**關鍵欄位：**
- ✅ CMSID - 設備代碼
- ✅ PositionLat/Lon - 座標
- ✅ RoadName - 道路名稱
- ✅ RoadDirection - 道路方向

---

### 2. CMS Live API

**測試 CMSID：** X0381G0  
**結果：** ✅ 成功

**資料結構：**
```json
{
  "CMSID": "X0381G0",
  "MessageStatus": 1,
  "Messages": [
    {
      "Text": "經路口慢看停",
      "Type": undefined,
      "Priority": undefined
    }
  ],
  "Status": 0,
  "DataCollectTime": "2026-03-10T11:20:00+08:00"
}
```

**訊息類型（Type）：**
- 1: 旅行時間資訊
- 2: 壅塞資訊
- 3: 事故資訊
- 4: 施工資訊
- 5: 停車資訊
- 6: 政令宣導資訊
- 7: 其他未定義

**MessageStatus：**
- 0: 目前無資料顯示
- 1: 目前正執行循環顯示

---

### 3. VD NearBy API

**測試位置：** 台北市政府 (25.0408, 121.5678)  
**搜尋半徑：** 1000m  
**結果：** ✅ 成功

```
找到 35 個 VD 設備
距離範圍：526m - 984m
```

**資料結構：**
```json
{
  "VDID": "V0380F0",
  "BiDirectional": 0,
  "DetectionLinks": [...],
  "VDType": 2,
  "LocationType": 1,
  "DetectionType": 1,
  "PositionLon": 121.5662,
  "PositionLat": 25.04546,
  "RoadID": "200020",
  "RoadName": "市民大道高架道路",
  "RoadClass": 2
}
```

---

### 4. VD Live API

**測試 VDID：** V0380F0  
**結果：** ✅ 成功

**資料結構：**
```json
{
  "VDID": "V0380F0",
  "LinkFlows": [
    {
      "LinkID": "2000200100610A",
      "Lanes": [
        {
          "LaneID": 1,
          "LaneType": 1,
          "Speed": 62,
          "Occupancy": 3,
          "Vehicles": [
            {
              "VehicleType": "S",
              "Volume": 2,
              "Speed": 75
            }
          ]
        }
      ]
    }
  ],
  "Status": 0,
  "DataCollectTime": "2026-03-10T11:20:00+08:00"
}
```

**可取得資訊：**
- ✅ 車道速度（Speed）
- ✅ 佔有率（Occupancy）
- ✅ 車流量（Volume）
- ✅ 車種分類（VehicleType）

---

## 💡 實作建議

### 資料模型設計

```typescript
interface TrafficInfo {
  id: string;              // CMS ID 或 VD ID
  type: 'message' | 'flow'; // 訊息類型或車流類型
  location: {
    lat: number;
    lon: number;
    distance: number;      // 距離使用者位置（公尺）
  };
  road: {
    name: string;          // 道路名稱
    direction?: string;    // 道路方向
  };
  
  // CMS 訊息資料
  message?: {
    text: string;          // 訊息內容
    messageType?: number;  // 訊息類型（1-7）
    priority?: number;     // 優先級
  };
  
  // VD 車流資料
  flow?: {
    speed: number;         // 平均速度
    occupancy: number;     // 佔有率
    volume: number;        // 車流量
  };
  
  updateTime: string;      // 資料更新時間
}
```

### 顯示格式設計

```
🚦 附近路況資訊

📍 市民大道高架道路（東向）
距離：555m
⚠️ 經路口慢看停
更新：11:20

---

📍 環東大道
距離：734m
🚗 車速：62 km/h
📊 車流：順暢
更新：11:20

---

還有 3 個路況資訊...
```

### 快取策略

- **快取時間：** 5 分鐘
- **快取鍵：** `traffic:{city}:{lat}:{lon}:{radius}`
- **理由：** 路況資料更新頻率約 5 分鐘，快取可減少 API 呼叫

---

## 🚧 實作挑戰與解決方案

### 挑戰 1: 需要兩次 API 呼叫

**問題：** 需要先 NearBy 取得設備 ID，再 Live 取得即時資料

**解決方案：**
- 快取 NearBy 結果（設備位置不常變動）
- 批次查詢多個設備的 Live 資料
- 使用 `$filter` 參數一次查詢多個 CMSID

### 挑戰 2: CMS 訊息可能為空

**問題：** MessageStatus = 0 時無訊息顯示

**解決方案：**
- 過濾掉無訊息的 CMS
- 顯示「目前無特殊路況」
- 可選：顯示 VD 車流資料作為補充

### 挑戰 3: 訊息類型可能未定義

**問題：** 測試中發現 Type 欄位可能為 undefined

**解決方案：**
- 根據訊息內容關鍵字判斷類型
- 使用預設圖示（⚠️）
- 顯示原始訊息文字

---

## 📝 下一步行動

1. ✅ **API 可行性驗證** - 已完成
2. ⏳ **更新 requirements.md** - 使用實際 API 端點
3. ⏳ **設計 Design Document** - 定義架構和資料流
4. ⏳ **實作 TDX Client** - 新增 traffic 查詢方法
5. ⏳ **實作 Traffic Handler** - 處理 /traffic 指令
6. ⏳ **實作顯示格式** - 格式化路況資訊
7. ⏳ **測試與調整** - 驗證功能正確性

---

## 🎉 結論

TDX Traffic API **完全可行**，可以實作 `/traffic` 功能！

**推薦使用：**
- **主要：** CMS Live API（顯示官方路況訊息）
- **可選：** VD Live API（顯示即時車流資料）

**預估開發時間：**
- API 整合：2-3 小時
- 顯示格式：1 小時
- 測試調整：1-2 小時
- **總計：4-6 小時**

---

**測試腳本：**
- `test-tdx-traffic-nearby.ts` - 測試 NearBy API
- `test-tdx-traffic-live.ts` - 測試 Live API
