# 路況查詢功能部署指南

**部署日期:** 2026-03-10  
**版本:** 1.0.0

---

## 📋 部署前檢查清單

### 程式碼檢查
- [x] `src/services/traffic-service.ts` - 智慧篩選邏輯
- [x] `src/handlers/traffic-handler.ts` - UX 流程處理
- [x] `supabase/functions/_shared/tdx-client.ts` - API 整合
- [x] `supabase/functions/_shared/formatters.ts` - 格式化函數
- [x] `supabase/functions/telegram-webhook/index.ts` - Webhook 整合
- [x] `src/models/types.ts` - 類型定義

### 測試檢查
- [x] 本地測試通過 (`test-traffic-integration.ts`)
- [x] 智慧篩選邏輯驗證
- [x] 嚴重程度排序驗證
- [x] 顯示格式驗證

### 文件檢查
- [x] 實作文件完成
- [x] 快速參考完成
- [x] 部署指南完成

---

## 🚀 部署步驟

### Step 1: 本地最終測試

```bash
# 執行整合測試
npx tsx test-traffic-integration.ts

# 預期輸出
✅ 成功取得 Access Token
✅ CMS: 找到 9 個設備，7 個有訊息
✅ VD: 找到 35 個設備，34 個有車流資料
✅ 找到 41 個路況資訊
✅ 智慧篩選後顯示 5 則
```

### Step 2: 部署到 Supabase

```bash
# 登入 Supabase
supabase login

# 連結專案
supabase link --project-ref your-project-ref

# 部署 Edge Function
supabase functions deploy telegram-webhook

# 驗證部署
supabase functions list
```

### Step 3: 設定環境變數

確認 Supabase 專案已設定以下環境變數：

```bash
# 在 Supabase Dashboard > Settings > Edge Functions > Secrets
TELEGRAM_BOT_TOKEN=your_bot_token
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 4: 更新 Telegram Bot Commands

```bash
# 更新 bot commands
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "開始使用"},
      {"command": "help", "description": "查看說明"},
      {"command": "parking", "description": "搜尋附近停車位"},
      {"command": "traffic", "description": "查詢附近路況"},
      {"command": "setup", "description": "設定 TDX API Key"},
      {"command": "config", "description": "查看當前配置"},
      {"command": "reset", "description": "重置配置"}
    ]
  }'
```

### Step 5: 驗證部署

```bash
# 測試 webhook
curl -X POST "https://your-project.supabase.co/functions/v1/telegram-webhook" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "text": "/traffic",
      "chat": {"id": 123456789},
      "from": {"id": 123456789}
    }
  }'

# 預期回應
{"ok": true}
```

### Step 6: 使用者測試

1. 在 Telegram 中找到你的 bot
2. 執行 `/traffic`
3. 選擇搜尋範圍
4. 分享位置
5. 驗證結果顯示正確

---

## 🔍 部署驗證

### 功能驗證清單

- [ ] `/traffic` 指令可以執行
- [ ] 範圍選擇按鈕正常顯示
- [ ] 位置分享功能正常
- [ ] Google Maps 連結解析正常
- [ ] 路況資訊正確顯示
- [ ] 智慧篩選正常運作
- [ ] 嚴重程度排序正確
- [ ] 路況順暢時顯示正確訊息
- [ ] 錯誤處理正常
- [ ] 快取機制運作正常

### 測試案例

#### 測試案例 1: 正常查詢
```
輸入: /traffic
選擇: 1km
位置: 台北市政府
預期: 顯示 5 則重要路況或「路況順暢」
```

#### 測試案例 2: 路況順暢
```
輸入: /traffic
選擇: 500m
位置: 郊區道路
預期: 顯示「✅ 附近路況順暢」
```

#### 測試案例 3: Google Maps 連結
```
輸入: /traffic
選擇: 1km
位置: https://maps.app.goo.gl/xxx
預期: 正確解析座標並顯示路況
```

#### 測試案例 4: 錯誤處理
```
輸入: /traffic
選擇: 1km
位置: 國外座標
預期: 顯示「座標不在台灣境內」
```

---

## 📊 監控指標

### 關鍵指標

1. **API 呼叫次數**
   - 監控 TDX API 呼叫頻率
   - 確認快取命中率 > 60%

2. **回應時間**
   - 目標: < 5 秒
   - 監控平均回應時間

3. **錯誤率**
   - 目標: < 1%
   - 監控 API 錯誤和異常

4. **使用率**
   - 追蹤 `/traffic` 指令使用次數
   - 分析使用時段分布

### 監控方法

```bash
# 查看 Edge Function 日誌
supabase functions logs telegram-webhook

# 查看錯誤日誌
supabase functions logs telegram-webhook --level error

# 即時監控
supabase functions logs telegram-webhook --follow
```

---

## 🐛 故障排除

### 問題 1: 無法取得路況資訊

**症狀:** 顯示「❌ 附近沒有找到路況資訊」

**可能原因:**
1. 附近沒有 CMS/VD 設備
2. TDX API 回應異常
3. 城市判斷錯誤

**解決方法:**
```bash
# 檢查日誌
supabase functions logs telegram-webhook

# 驗證 API
npx tsx test-traffic-integration.ts
```

### 問題 2: 顯示過多路況

**症狀:** 顯示超過 5 則路況

**可能原因:**
- 智慧篩選邏輯未生效

**解決方法:**
```typescript
// 檢查 formatTrafficResults 的 maxResults 參數
export function formatTrafficResults(results: TrafficInfo[], maxResults: number = 5)
```

### 問題 3: 快取未生效

**症狀:** 每次查詢都呼叫 API

**可能原因:**
- 快取服務未正確初始化
- 快取鍵生成錯誤

**解決方法:**
```typescript
// 檢查快取鍵生成
const cacheKey = this.cache.generateKey('traffic', {
  lat: location.latitude,
  lon: location.longitude,
  radius,
});
```

### 問題 4: 路況順暢時不顯示

**症狀:** 沒有異常路況時無回應

**可能原因:**
- 格式化邏輯錯誤

**解決方法:**
```typescript
// 確認有返回順暢訊息
if (abnormalTraffic.length === 0) {
  return '✅ 附近路況順暢';
}
```

---

## 🔄 回滾計畫

### 如果需要回滾

```bash
# 1. 查看部署歷史
supabase functions list

# 2. 回滾到上一版本
# (需要重新部署舊版本的程式碼)

# 3. 移除 /traffic 指令
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "開始使用"},
      {"command": "help", "description": "查看說明"},
      {"command": "parking", "description": "搜尋附近停車位"},
      {"command": "setup", "description": "設定 TDX API Key"}
    ]
  }'
```

---

## 📈 效能優化建議

### 短期優化
1. 調整快取時間（目前 5 分鐘）
2. 優化 API 呼叫順序
3. 增加錯誤重試機制

### 長期優化
1. 實作 CDN 快取
2. 使用 Redis 替代記憶體快取
3. 批次查詢優化
4. 預測性快取（熱點區域）

---

## 📝 部署後任務

### 立即任務
- [ ] 驗證所有功能正常
- [ ] 監控錯誤日誌
- [ ] 收集使用者回饋

### 一週內任務
- [ ] 分析使用數據
- [ ] 優化快取策略
- [ ] 調整顯示邏輯（如需要）

### 一個月內任務
- [ ] 評估效能指標
- [ ] 規劃功能增強
- [ ] 更新使用者文件

---

## 🎉 部署完成檢查

部署完成後，確認以下項目：

✅ Edge Function 部署成功  
✅ Telegram Bot Commands 更新  
✅ 功能測試通過  
✅ 錯誤處理正常  
✅ 監控設定完成  
✅ 文件更新完成  

---

**部署指南完成！準備上線！** 🚀
