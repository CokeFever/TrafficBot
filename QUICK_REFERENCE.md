# 🅿️ 停車場 API 快速參考

> 測試完成 ✅ | 所有功能可行 ✅ | 立即可實作 🚀

---

## 📋 測試結果一覽

| 功能 | 狀態 | 資料來源 |
|------|------|---------|
| 停車位總數 | ✅ | `TotalSpaces` |
| 即時空位 | ✅ | `AvailableSpaces` |
| 收費資訊 | ✅ | `FareDescription` |
| 充電樁 | ✅ | `Description` (需解析) |
| 殘障車位 | ✅ | `Description` (需解析) |
| 婦幼車位 | ✅ | `Description` (需解析) |

---

## 🔑 關鍵欄位

### Description 欄位範例
```
"小型車:128格(含身心障礙停車位4格，孕婦、育有六歲以下兒童停車位3格)，充電格位:3格"
```

### Availabilities 陣列範例
```json
[
  {"SpaceType": 1, "AvailableSpaces": 126},  // 一般車位
  {"SpaceType": 7, "AvailableSpaces": 1},    // 殘障車位
  {"SpaceType": 9, "AvailableSpaces": 3}     // 婦幼車位
]
```

---

## 💻 實作範例

### 解析特殊車位
```typescript
function parseDescription(desc: string) {
  return {
    handicap: desc.match(/身心障礙停車位(\d+)格/)?.[1] || 0,
    womenChildren: desc.match(/孕婦、育有六歲以下兒童停車位(\d+)格/)?.[1] || 0,
    charging: desc.match(/充電格位[：:](\d+)格/)?.[1] || 0,
  };
}
```

### Bot 回應格式
```
📍 興隆D1社會住宅地下停車場
距離：350m
剩餘車位：45 / 128

⚡ 充電格位：3個
♿ 殘障車位：4個
👶 婦幼車位：3個

收費：20元/時
[導航](...)
```

---

## 🚀 API 端點

```typescript
// 1. 附近停車場
GET /advanced/v1/Parking/OffStreet/CarPark/NearBy
?$format=JSON&$spatialFilter=nearby(lat, lon, radius)

// 2. 即時空位
GET /v1/Parking/OffStreet/ParkingAvailability/City/{City}
?$format=JSON

// 3. 合併資料
const result = mergeByCarParkID(nearby, availability);
```

---

## 📚 完整文件

- **TESTING_COMPLETE.md** - 測試完成總結
- **TEST_RESULTS.md** - 詳細測試結果
- **TDX_PARKING_RESEARCH.md** - 完整研究報告

---

## ✅ 可以開始實作了！

所有測試都通過，資料完整可用。參考 openclaw-parking-query 的實作方式即可。
