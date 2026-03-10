# 路況查詢功能快速參考

## 🚀 快速開始

### 使用者操作
```
1. /traffic
2. 選擇範圍 [500m] [1km] [2km]
3. 分享位置
4. 查看結果
```

### 顯示邏輯
- ✅ 路況順暢 → 顯示「✅ 附近路況順暢」
- ⚠️ 有異常 → 顯示最重要的 5 則路況

---

## 📊 智慧篩選規則

### 正常路況標準（自動過濾）

| 道路類型 | 預期速度 | 正常範圍 |
|---------|---------|---------|
| 國道 | 100 km/h | 90-110 |
| 快速道路 | 70 km/h | 63-77 |
| 匝道 | 60 km/h | 54-66 |
| 一般道路 | 50 km/h | 45-55 |

**規則:** 速度在預期值 ±10% 範圍內 = 正常，不顯示

### 嚴重程度排序

| 優先級 | 類型 | 圖示 | 來源 |
|-------|------|------|------|
| 1 | 事故 | 🚨 | CMS |
| 2 | 壅塞 | ⚠️ | CMS |
| 3 | 施工 | 🚧 | CMS |
| 4 | 塞車 | 🔴 | VD |
| 5 | 車多 | 🟡 | VD |

---

## 💻 程式碼位置

### 核心檔案
```
src/services/traffic-service.ts       # 智慧篩選邏輯
src/handlers/traffic-handler.ts       # UX 流程處理
supabase/functions/_shared/tdx-client.ts    # API 整合
supabase/functions/_shared/formatters.ts    # 格式化
```

### 關鍵方法
```typescript
// 智慧篩選
formatTrafficInfo(trafficData: TrafficData[]): string

// 嚴重程度評分
getSeverityScore(data: TrafficData): number

// 預期速度
getExpectedSpeed(roadClass: number): number
```

---

## 🧪 測試

### 執行測試
```bash
npx tsx test-traffic-integration.ts
```

### 預期結果
```
✅ 找到 41 個路況資訊
✅ 智慧篩選後顯示 5 則
✅ 按嚴重程度排序
```

---

## 🔧 調整參數

### 修改顯示數量
```typescript
// supabase/functions/_shared/formatters.ts
export function formatTrafficResults(results: TrafficInfo[], maxResults: number = 5)
                                                                          // ↑ 改這裡
```

### 修改過濾門檻
```typescript
// supabase/functions/_shared/formatters.ts
return deviation > 0.1; // 10% 門檻
                // ↑ 改這裡（0.1 = 10%, 0.15 = 15%）
```

### 修改預期速度
```typescript
// supabase/functions/_shared/formatters.ts
function getExpectedSpeed(roadClass: number): number {
  switch (roadClass) {
    case 0: return 100; // 國道 ← 改這裡
    case 1:
    case 2: return 70;  // 快速道路 ← 改這裡
    case 7: return 60;  // 匝道 ← 改這裡
    default: return 50; // 一般道路 ← 改這裡
  }
}
```

---

## 📱 顯示範例

### 有異常路況
```
🚦 附近路況 (5則重要資訊)

🚨 基隆路一段 東北向 (352m)
   ２月交通事故死亡５人

🔴 忠孝東路五段 (181m)
   塞車 22km/h

🚧 市民大道 東向 (520m)
   前方施工，請改道
```

### 路況順暢
```
✅ 附近路況順暢
```

---

## 🐛 常見問題

### Q: 為什麼沒有顯示路況？
A: 可能原因：
1. 附近沒有 CMS/VD 設備
2. 所有路況都在正常範圍內（±10%）
3. 會顯示「✅ 附近路況順暢」

### Q: 如何調整顯示數量？
A: 修改 `formatTrafficResults` 的 `maxResults` 參數（預設 5）

### Q: 如何調整過濾門檻？
A: 修改 `deviation > 0.1` 的值（0.1 = 10%）

### Q: 為什麼有些路段不顯示？
A: 速度在預期值 ±10% 範圍內視為正常，自動過濾

---

## 📈 效能數據

### 測試結果（台北市政府）
```
原始資料: 41 筆
過濾後: 5 筆
篩選率: 87.8%
```

### 快取效果
```
快取時間: 5 分鐘
預估命中率: 60-70%
API 呼叫減少: 60-70%
```

---

## 🔗 相關文件

- [完整實作文件](./TRAFFIC_FEATURE_IMPLEMENTATION.md)
- [實作總結](./TRAFFIC_IMPLEMENTATION_SUMMARY.md)
- [API 可行性驗證](./TDX_TRAFFIC_API_FEASIBILITY.md)
- [路況等級標準](./TRAFFIC_LEVEL_CRITERIA.md)

---

**快速參考完成！** 📚
