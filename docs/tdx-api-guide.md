# TDX API 申請指南

本指南將協助你申請台灣交通部 TDX (Taiwan Data eXchange) API 金鑰。

## 什麼是 TDX API？

TDX 是台灣交通部提供的開放資料平台，整合了全台灣的交通相關資料，包括：
- 停車場即時資訊
- 路邊停車位資訊
- 即時車流資料
- 交通事故資訊
- 公車、捷運、高鐵等大眾運輸資訊

## 申請步驟

### 步驟 1: 註冊 TDX 帳號

1. 前往 TDX 平台：https://tdx.transportdata.tw/
2. 點擊右上角「註冊」按鈕
3. 填寫註冊資訊：
   - 電子郵件
   - 密碼
   - 姓名
   - 手機號碼
   - 驗證碼

4. 閱讀並同意服務條款
5. 點擊「註冊」
6. 到信箱收取驗證信並完成驗證

### 步驟 2: 登入並完善個人資料

1. 使用註冊的帳號登入
2. 點擊右上角的使用者名稱 → 「會員中心」
3. 完善個人資料（如需要）

### 步驟 3: 申請 API 金鑰

1. 在會員中心頁面，找到「API 金鑰管理」區塊
2. 點擊「申請新金鑰」或「取得 API Key」
3. 填寫申請資訊：
   - **應用程式名稱**: `Telegram Parking Bot`（或你喜歡的名稱）
   - **應用程式說明**: 簡單描述用途，例如：
     ```
     個人使用的 Telegram Bot，用於查詢停車位和車流資訊
     ```
   - **預計使用量**: 選擇適當的級別（一般個人使用選「低」即可）

4. 提交申請
5. 等待審核（通常 1-3 個工作天，有時會更快）

### 步驟 4: 取得 API 金鑰

1. 審核通過後，會收到 Email 通知
2. 登入 TDX 平台
3. 前往「會員中心」→「API 金鑰管理」
4. 複製你的 API 金鑰（格式類似：`eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`）

⚠️ **重要**：請妥善保管你的 API 金鑰，不要公開分享！

---

## API 使用限制

### 免費方案限制

TDX API 免費方案有以下限制：

- **每日請求次數**: 10,000 次
- **每分鐘請求次數**: 60 次
- **單次請求資料量**: 1,000 筆

對於個人使用的 Telegram Bot，這些限制通常足夠。

### 如何查看使用量

1. 登入 TDX 平台
2. 前往「會員中心」→「API 使用統計」
3. 查看當日/當月使用量

---

## 測試 API 金鑰

### 方法 1: 使用 TDX Swagger UI

1. 前往 https://tdx.transportdata.tw/api-service/swagger
2. 選擇任一 API endpoint（例如：停車場資訊）
3. 點擊「Try it out」
4. 在 Authorization 欄位輸入：`Bearer YOUR_API_KEY`
5. 點擊「Execute」
6. 確認能看到回應資料

### 方法 2: 使用 curl 指令

```bash
curl -X GET "https://tdx.transportdata.tw/api/basic/v2/Parking/OffStreet/ParkingAvailability/City/Taipei?%24top=10&%24format=JSON" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

如果成功，會看到 JSON 格式的停車場資料。

### 方法 3: 在 Bot 中測試

1. 完成 Bot 的 `/setup` 配置
2. 輸入你的 API 金鑰
3. Bot 會自動驗證金鑰是否有效

---

## 常用 API Endpoints

本 Bot 使用以下 TDX API：

### 1. 停車場即時資訊

```
GET /v2/Parking/OffStreet/ParkingAvailability/City/{City}
```

**參數**：
- `City`: 城市名稱（如 Taipei, NewTaipei）
- `$spatialFilter`: 空間過濾（nearby 函數）
- `$format`: 回應格式（JSON）

**範例**：
```
https://tdx.transportdata.tw/api/basic/v2/Parking/OffStreet/ParkingAvailability/City/Taipei?$spatialFilter=nearby(25.0330,121.5654,1000)&$format=JSON
```

### 2. 即時車流資訊

```
GET /v2/Traffic/Live/City/{City}
```

**參數**：
- `City`: 城市名稱
- `$filter`: OData 過濾條件
- `$format`: 回應格式

### 3. 交通事故資訊

```
GET /v2/Traffic/Live/Incident/City/{City}
```

**參數**：
- `City`: 城市名稱
- `$filter`: OData 過濾條件
- `$format`: 回應格式

---

## API 文件資源

### 官方文件

- **TDX 平台首頁**: https://tdx.transportdata.tw/
- **API 文件**: https://tdx.transportdata.tw/api-service/swagger
- **使用手冊**: https://tdx.transportdata.tw/api-service/document
- **常見問題**: https://tdx.transportdata.tw/faq

### 資料格式說明

- **OData 查詢語法**: https://www.odata.org/documentation/
- **空間查詢函數**: nearby, within 等
- **時間格式**: ISO 8601 格式

---

## 常見問題

### Q1: API 金鑰申請需要多久？

**答**：通常 1-3 個工作天，有時當天就會通過。如果超過 3 天未收到通知，可以聯繫 TDX 客服。

### Q2: 可以申請多個 API 金鑰嗎？

**答**：可以。每個應用程式可以申請獨立的 API 金鑰，方便管理和追蹤使用量。

### Q3: API 金鑰過期了怎麼辦？

**答**：
1. 登入 TDX 平台
2. 前往「API 金鑰管理」
3. 重新產生金鑰或申請新的金鑰
4. 在 Bot 中使用 `/setup` 更新金鑰

### Q4: 超過使用限制會怎樣？

**答**：
- 超過每分鐘限制：會收到 429 (Too Many Requests) 錯誤
- 超過每日限制：當天無法再使用 API
- Bot 有重試機制，會自動處理暫時性錯誤

### Q5: 如何減少 API 呼叫次數？

**答**：
- Bot 已實作 5 分鐘快取機制
- 避免頻繁查詢相同位置
- 合理設定經常性路線的監控頻率

### Q6: API 回應速度慢怎麼辦？

**答**：
- TDX API 通常回應速度在 1-3 秒
- 如果持續緩慢，可能是網路問題或 TDX 服務負載高
- Bot 設定 10 秒逾時，超時會自動重試

### Q7: 找不到某個城市的資料？

**答**：
- 確認城市名稱拼寫正確（使用英文，如 Taipei, Kaohsiung）
- 某些小城市可能沒有即時停車資料
- 可以在 TDX Swagger UI 查看支援的城市列表

---

## 進階使用

### 自訂查詢參數

如果你想修改 Bot 的查詢行為，可以編輯 `src/integrations/tdx-client.ts`：

```typescript
// 修改停車場查詢參數
async queryParkingFacilities(center: Coordinates, radius: number, apiKey: string) {
  const params = {
    $spatialFilter: `nearby(${center.latitude},${center.longitude},${radius})`,
    $format: 'JSON',
    $top: 50,  // 增加回傳筆數
    $orderby: 'AvailableSpaces desc'  // 按剩餘車位排序
  };
  // ...
}
```

### 新增其他 API

TDX 提供更多 API，例如：
- 公車即時位置
- 捷運時刻表
- 高鐵票價查詢
- 自行車租借站資訊

可以參考 TDX 文件自行擴充功能。

---

## 聯絡 TDX 支援

如有 API 相關問題，可以透過以下方式聯繫：

- **客服信箱**: service@tdx.gov.tw
- **客服電話**: (02) 2349-2803
- **服務時間**: 週一至週五 09:00-18:00

---

## 相關資源

- [Supabase 部署指南](deploy-supabase.md)
- [使用者手冊](user-guide.md)
- [GitHub Repository](https://github.com/CokeFever/trafficbot)

---

祝你使用順利！如有問題歡迎回報 Issue。
