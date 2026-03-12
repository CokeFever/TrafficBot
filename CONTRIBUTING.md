# 貢獻指南

感謝你考慮為 TrafficBot 做出貢獻！

## 🎯 貢獻方式

### 回報問題

如果你發現 bug 或有功能建議：

1. 先搜尋 [Issues](https://github.com/CokeFever/trafficbot/issues) 確認是否已有相同問題
2. 如果沒有，請開一個新的 Issue
3. 清楚描述問題或建議，包含：
   - 問題描述
   - 重現步驟（如果是 bug）
   - 預期行為
   - 實際行為
   - 環境資訊（作業系統、Node.js 版本等）

### 提交程式碼

1. Fork 這個專案
2. 建立你的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的變更 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開一個 Pull Request

## 📝 開發指南

### 設定開發環境

```bash
# Clone 你 fork 的專案
git clone https://github.com/CokeFever/trafficbot.git
cd trafficbot

# 安裝相依套件
npm install

# 複製環境變數範本
cp .env.example .env

# 編輯 .env 填入你的測試用 API keys
```

### 程式碼風格

- 使用 TypeScript
- 遵循 ESLint 規則
- 使用 Prettier 格式化程式碼
- 提交前執行 `npm run lint`

### 測試

```bash
# 執行測試
npm test

# 執行特定測試
npm test -- test-name
```

### Commit 訊息規範

使用清楚的 commit 訊息：

- `feat: 新增功能`
- `fix: 修復 bug`
- `docs: 文件更新`
- `style: 程式碼格式調整`
- `refactor: 重構程式碼`
- `test: 測試相關`
- `chore: 建置或工具相關`

範例：
```
feat: 新增機車停車位查詢功能

- 新增機車停車位數量顯示
- 更新停車場資訊格式化邏輯
- 新增相關測試
```

## 🔍 Pull Request 檢查清單

提交 PR 前請確認：

- [ ] 程式碼遵循專案風格指南
- [ ] 已執行並通過所有測試
- [ ] 已更新相關文件
- [ ] Commit 訊息清楚明確
- [ ] 沒有包含敏感資訊（API keys、密碼等）
- [ ] 已在本地測試過功能

## 🚀 功能開發流程

### 1. 規劃階段

- 在 Issue 中討論功能需求
- 確認功能範圍與實作方式
- 取得維護者同意後再開始開發

### 2. 開發階段

- 建立功能分支
- 實作功能
- 撰寫測試
- 更新文件

### 3. 審查階段

- 提交 Pull Request
- 回應審查意見
- 修正問題
- 等待合併

## 📚 開發資源

### 重要文件

- [TDX API 文件](https://tdx.transportdata.tw/api-service/swagger)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Supabase 文件](https://supabase.com/docs)
- [Telegraf 文件](https://telegraf.js.org/)

### 專案文件

- [快速開始](docs/quick-start.md)
- [使用手冊](docs/user-guide.md)
- [TDX API 指南](docs/tdx-api-guide.md)
- [部署指南](docs/deploy-supabase.md)

## 🐛 除錯技巧

### 本地測試

```bash
# 啟動本地 Supabase
supabase start

# 執行 Edge Function 本地測試
supabase functions serve telegram-webhook

# 查看 logs
supabase functions logs telegram-webhook
```

### 常見問題

1. **TDX API 回傳錯誤**
   - 檢查 API Key 是否正確
   - 確認 API 配額是否用完
   - 查看 TDX 平台狀態

2. **Telegram Webhook 無回應**
   - 檢查 webhook URL 是否正確設定
   - 查看 Supabase Edge Function logs
   - 確認 Bot Token 是否有效

3. **資料庫連線問題**
   - 檢查 Supabase 連線設定
   - 確認 RLS 政策是否正確
   - 查看資料庫 logs

## 💡 功能建議

我們歡迎以下類型的貢獻：

- 🐛 Bug 修復
- ✨ 新功能
- 📝 文件改善
- 🎨 UI/UX 優化
- ⚡ 效能改善
- 🧪 測試覆蓋率提升
- 🌍 多語言支援

## 📞 聯絡方式

如有任何問題，歡迎：

- 開 [Issue](https://github.com/CokeFever/trafficbot/issues)
- 在 [Discussions](https://github.com/CokeFever/trafficbot/discussions) 討論

## 🙏 感謝

感謝所有貢獻者的付出！

---

再次感謝你的貢獻！🎉
