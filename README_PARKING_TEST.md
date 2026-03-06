# 🅿️ 停車場 API 測試 - 快速開始

> 基於 [openclaw-parking-query](https://github.com/Harperbot/openclaw-parking-query) 的研究與測試

---

## 🎯 一分鐘快速測試

```bash
# 1. 取得你的 TDX API 金鑰
# 前往: https://tdx.transportdata.tw/

# 2. 執行測試
npx tsx test-parking-simple.ts <YOUR_CLIENT_ID> <YOUR_CLIENT_SECRET>

# 3. 查看結果
# 測試腳本會自動測試 5 種 API 並顯示可用欄位
```

---

## 📋 測試什麼？

| 功能 | 狀態 | 說明 |
|------|------|------|
| 路外停車場位置 | ✅ 已驗證 | openclaw-parking-query 已成功實作 |
| 即時空位資訊 | ✅ 已驗證 | 資料即時且準確 |
| 收費資訊 | ✅ 已驗證 | 包含在靜態資料中 |
| 充電樁資訊 | ❓ 待測試 | 可能在 ServiceType 欄位 |
| 殘障車位 | ❓ 待測試 | 可能有 Handicap 欄位 |
| 婦幼車位 | ❓ 待測試 | 可能有 WomenAndChildren 欄位 |
| 路邊停車 | ❓ 待測試 | API 存在但資料可用性未知 |

---

## 📚 文件導覽

### 快速開始
- **[README_PARKING_TEST.md](README_PARKING_TEST.md)** ← 你在這裡
- **[PARKING_TESTING_GUIDE.md](PARKING_TESTING_GUIDE.md)** - 詳細測試指南

### 研究報告
- **[RESEARCH_SUMMARY.md](RESEARCH_SUMMARY.md)** - 研究總結
- **[TDX_PARKING_RESEARCH.md](TDX_PARKING_RESEARCH.md)** - 完整研究報告

### 測試工具
- **[test-parking-simple.ts](test-parking-simple.ts)** - 簡化測試腳本（推薦）
- **[test-tdx-parking-fields.ts](test-tdx-parking-fields.ts)** - 完整測試腳本

---

## 🔑 如何取得 TDX API 金鑰？

### 快速步驟

1. 前往 https://tdx.transportdata.tw/
2. 註冊並登入
3. 會員中心 → API 金鑰管理 → 申請新金鑰
4. 取得 `Client ID` 和 `Client Secret`

### 詳細說明

請參考 [docs/tdx-api-guide.md](docs/tdx-api-guide.md)

---

## 🚀 測試範例

### 範例 1: 基本測試

```bash
npx tsx test-parking-simple.ts abc123-456def xyz987-654wvu
```

### 範例 2: 使用 .env 檔案

```bash
# 1. 建立 .env 檔案
echo "TDX_CLIENT_ID=abc123-456def" > .env
echo "TDX_CLIENT_SECRET=xyz987-654wvu" >> .env

# 2. 執行測試
npx tsx test-tdx-parking-fields.ts
```

---

## 📊 預期輸出

```
================================================================================
TDX 停車場 API 欄位測試
================================================================================

🔐 正在取得 Access Token...
✅ 成功取得 Access Token

📋 測試: 路外停車場靜態資料 (CarPark)
--------------------------------------------------------------------------------
✅ 成功取得資料，共 3 筆

📄 第一筆資料範例:
{
  "CarParkID": "P001",
  "CarParkName": {
    "Zh_tw": "市政府地下停車場"
  },
  "TotalSpaces": 200,
  "ServiceType": [...],
  ...
}

🔍 可用欄位:
  - CarParkID (string): P001
  - CarParkName (object): {"Zh_tw":"市政府地下停車場"}
  - TotalSpaces (number): 200
  - ServiceType (object): [...]
  ...
```

---

## ✅ 測試檢查清單

完成測試後，請確認：

### 路外停車場
- [ ] 靜態資料 API 可用
- [ ] 即時空位 API 可用
- [ ] 有 `CarParkID`、`CarParkName` 欄位
- [ ] 有 `TotalSpaces` 欄位
- [ ] 有 `FareDescription` 收費資訊
- [ ] 檢查是否有 `ServiceType` 欄位 ⭐
- [ ] 檢查是否有 `Handicap` 欄位 ⭐
- [ ] 檢查是否有 `ChargingStation` 欄位 ⭐

### 路邊停車
- [ ] OnStreet API 是否有回傳資料
- [ ] 資料品質如何
- [ ] 是否有即時空位資訊

---

## 🎯 根據測試結果的下一步

### 如果基本功能可用 ✅
→ 開始實作 MVP（最小可行產品）

### 如果特殊車位資訊可用 ⭐
→ 加入充電樁、殘障車位、婦幼車位顯示

### 如果路邊停車可用 🚗
→ 評估是否整合路邊停車功能

---

## 💡 openclaw-parking-query 的核心邏輯

```python
# 1. 使用 NearBy API 取得附近停車場
nearby_parks = fetch_nearby(lat, lon, radius=500)

# 2. 取得該城市的即時空位
city = detect_city(lat, lon)
availability = fetch_availability(city)

# 3. 合併資料並過濾有空位的停車場
results = []
for park in nearby_parks:
    avail = availability_map.get(park['CarParkID'])
    if avail and avail['AvailableSpaces'] > 0:
        results.append({
            'name': park['CarParkName'],
            'spaces': avail['AvailableSpaces'],
            'distance': calculate_distance(...)
        })

# 4. 按距離排序並回傳前 5 個
return sorted(results, key=lambda x: x['distance'])[:5]
```

---

## 🔗 相關連結

- [openclaw-parking-query GitHub](https://github.com/Harperbot/openclaw-parking-query)
- [TDX 平台](https://tdx.transportdata.tw/)
- [TDX API 文件](https://tdx.transportdata.tw/api-service/swagger)

---

## 🐛 遇到問題？

### 認證失敗
→ 檢查 Client ID 和 Secret 是否正確

### API 回應 404
→ 確認城市名稱使用英文（如 `Taipei` 而非 `台北`）

### 資料為空
→ 嘗試不同城市或不同時間測試

### 更多問題
→ 查看 [PARKING_TESTING_GUIDE.md](PARKING_TESTING_GUIDE.md) 的常見問題章節

---

## 📞 需要幫助？

1. 查看 [PARKING_TESTING_GUIDE.md](PARKING_TESTING_GUIDE.md)
2. 查看 [TDX_PARKING_RESEARCH.md](TDX_PARKING_RESEARCH.md)
3. 參考 [docs/tdx-api-guide.md](docs/tdx-api-guide.md)

---

**祝測試順利！** 🎉

記得將測試結果更新到 `TDX_PARKING_RESEARCH.md` 中。
