# 🅿️ 停車場顯示格式 - 最終版本

## 📋 格式規範

### 文字簡化規則

| 原文 | 簡化後 |
|------|--------|
| 剩餘車位 | 車位 |
| 大型重機 | 重機 |
| 充電格位 | 充電 |
| 殘障車位 | 殘障 |
| 婦幼車位 | 婦幼 |

### 單位規則

- ✅ 距離：保留單位 `m`
- ✅ 車位：保留格式 `45 / 464`
- ❌ 特殊車位：**不加單位**（不寫「格」或「個」）

---

## ✅ 正確範例

### 完整資訊
```
📍 社子國小地下停車場
距離：350m
車位：45 / 464

🏍️ 重機：5
⚡ 充電：10
♿ 殘障：10
👶 婦幼：9

收費：
- 計時：20元/時
- 月租：3,500元/月
- 重機月租：1,750元/月
```

### 部分資訊
```
📍 興隆D1社會住宅地下停車場
距離：520m
車位：28 / 128

⚡ 充電：3

收費：
- 計時：20元/時
- 月租：4,200元/月
```

### 基本資訊（無特殊車位）
```
📍 市政府地下停車場
距離：180m
車位：126 / 1998

收費：
- 計時：30元/時
- 月租：5,000元/月
```

---

## 💻 實作程式碼

```typescript
function formatParkingInfo(parking: any): string {
  const lines: string[] = [];
  
  // 標題
  lines.push(`📍 ${parking.name}`);
  
  // 距離（母項目）
  lines.push(`距離：${parking.distance ? Math.round(parking.distance) + 'm' : '未提供'}`);
  
  // 車位（母項目）
  if (parking.availableSpaces !== null && parking.totalSpaces !== null) {
    lines.push(`車位：${parking.availableSpaces} / ${parking.totalSpaces}`);
  } else {
    lines.push(`車位：未提供`);
  }
  
  lines.push(''); // 空行
  
  // 特殊車位（子項目 - 只有 > 0 才顯示，不加單位）
  const specialLines: string[] = [];
  
  if (parking.heavyMotorcycle > 0) {
    specialLines.push(`🏍️ 重機：${parking.heavyMotorcycle}`);
  }
  if (parking.charging > 0) {
    specialLines.push(`⚡ 充電：${parking.charging}`);
  }
  if (parking.handicap > 0) {
    specialLines.push(`♿ 殘障：${parking.handicap}`);
  }
  if (parking.womenChildren > 0) {
    specialLines.push(`👶 婦幼：${parking.womenChildren}`);
  }
  
  // 只有當有特殊車位時才加入
  if (specialLines.length > 0) {
    lines.push(...specialLines);
    lines.push(''); // 空行
  }
  
  // 收費（母項目）
  if (parking.fareDescription) {
    lines.push('收費：');
    if (parking.hourlyRate) {
      lines.push(`- 計時：${parking.hourlyRate}`);
    }
    if (parking.monthlyRate) {
      lines.push(`- 月租：${parking.monthlyRate}`);
    }
    if (parking.motorcycleMonthlyRate) {
      lines.push(`- 重機月租：${parking.motorcycleMonthlyRate}`);
    }
  } else {
    lines.push('收費：未提供');
  }
  
  // 導航連結
  if (parking.lat && parking.lon) {
    lines.push('');
    lines.push(`[📍 導航](https://www.google.com/maps/dir/?api=1&destination=${parking.lat},${parking.lon})`);
  }
  
  return lines.join('\n');
}
```

---

## 🎯 關鍵原則

### 母項目（必須顯示）
- 停車場名稱
- 距離（無資料時顯示「未提供」）
- 車位（無資料時顯示「未提供」）
- 收費（無資料時顯示「未提供」）

### 子項目（有資料且 > 0 才顯示）
- 重機（只有 > 0 時顯示，不加單位）
- 充電（只有 > 0 時顯示，不加單位）
- 殘障（只有 > 0 時顯示，不加單位）
- 婦幼（只有 > 0 時顯示，不加單位）

---

## ❌ 錯誤範例

### 錯誤 1: 顯示 0 或空值
```
❌ 🏍️ 重機：0
❌ ⚡ 充電：不提供
```
**正確做法**: 直接不顯示這些行

### 錯誤 2: 加了單位
```
❌ 🏍️ 重機：5格
❌ ⚡ 充電：10個
```
**正確做法**: 
```
✅ 🏍️ 重機：5
✅ ⚡ 充電：10
```

### 錯誤 3: 文字太長
```
❌ 剩餘車位：45 / 464
❌ 大型重機：5
❌ 充電格位：10
❌ 殘障車位：10
❌ 婦幼車位：9
```
**正確做法**:
```
✅ 車位：45 / 464
✅ 重機：5
✅ 充電：10
✅ 殘障：10
✅ 婦幼：9
```

---

## 📝 檢查清單

實作時請確認：

- [ ] 「剩餘車位」改為「車位」
- [ ] 「大型重機」改為「重機」
- [ ] 「充電格位」改為「充電」
- [ ] 「殘障車位」改為「殘障」
- [ ] 「婦幼車位」改為「婦幼」
- [ ] 特殊車位數字後面不加「格」或「個」
- [ ] 特殊車位 = 0 或 null 時不顯示該行
- [ ] 母項目無資料時顯示「未提供」

---

**最終版本** | 2026-03-06
