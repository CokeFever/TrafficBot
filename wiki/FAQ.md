# 常見問題 (FAQ)

## 一般問題

### Q: TrafficBot 是什麼？

A: TrafficBot 是一個 Telegram Bot，提供台灣地區的即時停車位查詢和路況資訊。整合了交通部 TDX API，讓你可以快速查詢附近的停車場和路況。

### Q: TrafficBot 是免費的嗎？

A: 是的！TrafficBot 是開源且免費的。停車位查詢提供試用模式（每人每天 2 次免費查詢）。如果需要更多查詢次數或使用路況功能，可以自行申請 TDX API Key。

### Q: 支援哪些地區？

A: 目前支援台灣地區，資料來源為交通部 TDX 平台。

## 使用問題

### Q: 如何開始使用？

A: 
1. 在 Telegram 找到 Bot
2. 發送 `/start` 開始
3. 使用 `/parking` 查詢停車位（試用模式）
4. 如需更多功能，使用 `/setup` 設定 TDX API Key

詳見 [快速開始](Quick-Start)。

### Q: 試用模式有什麼限制？

A: 試用模式限制：
- 每人每天可查詢 2 次停車位
- 無法使用路況查詢功能
- 如需更多查詢，請設定自己的 TDX API Key

### Q: 如何取得 TDX API Key？

A: 
1. 前往 [TDX 平台](https://tdx.transportdata.tw/)
2. 註冊並登入
3. 進入「會員中心」→「API 金鑰管理」
4. 建立新的 API 金鑰
5. 複製 Client ID 和 Client Secret

詳見 [設定 TDX API Key](Setup-TDX-API)。

### Q: 找不到停車場資訊？

A: 可能的原因：
- 該區域沒有提供即時資訊
- TDX API 暫時無法使用
- 搜尋半徑太小

建議：
- 擴大搜尋半徑
- 稍後再試
- 更換搜尋位置

### Q: 路況資訊不準確？

A: 路況資訊來自 TDX API，更新頻率約 5 分鐘。實際路況可能有變化，建議作為參考，不要完全依賴。

### Q: 如何重置配置？

A: 使用 `/reset` 指令可以清除所有配置，包括 API Key。重置後需要重新執行 `/setup`。

## 技術問題

### Q: Bot 沒有回應？

A: 檢查清單：
1. 確認 Bot 是否在線上
2. 檢查網路連線
3. 嘗試重新發送指令
4. 如果持續無回應，請回報 [Issue](https://github.com/CokeFever/trafficbot/issues)

### Q: API Key 無效？

A: 解決方法：
1. 確認 Key 複製完整（很長的字串）
2. 檢查 TDX 平台 Key 狀態
3. 重新申請 Key
4. 使用 `/reset` 重新配置

### Q: 查詢速度很慢？

A: 可能原因：
- TDX API 回應慢
- 網路連線問題
- Bot 伺服器負載高

建議：
- 稍等片刻（最多 10 秒）
- 檢查網路連線
- 如果持續緩慢，請回報問題

## 隱私與安全

### Q: Bot 會收集什麼資料？

A: Bot 只收集必要資訊：
- Telegram User ID（用於識別使用者）
- TDX API Key（加密儲存）
- 查詢記錄（用於試用模式限制）

### Q: 位置資訊會被儲存嗎？

A: 不會。位置資訊只用於即時查詢，不會被儲存。

### Q: API Key 安全嗎？

A: 是的。API Key 使用 AES-256 加密儲存在資料庫中。

### Q: 如何刪除我的資料？

A: 使用 `/reset` 指令可以清除所有資料，包括 API Key 和配置。

## 開發問題

### Q: 如何自己架設 Bot？

A: 請參考：
- [安裝指南](Installation-Guide)
- [部署到 Supabase](Deploy-Supabase)
- [開發環境設定](Development-Setup)

### Q: 如何貢獻程式碼？

A: 
1. Fork 專案
2. 建立功能分支
3. 提交變更
4. 開 Pull Request

詳見 [貢獻指南](Contributing)。

### Q: 發現 Bug 怎麼辦？

A: 請在 GitHub 回報：
1. 前往 [Issues](https://github.com/CokeFever/trafficbot/issues)
2. 點擊 "New issue"
3. 選擇 "Bug Report"
4. 填寫詳細資訊

## 其他問題

### Q: 可以新增其他功能嗎？

A: 當然！歡迎提出功能建議：
1. 前往 [Issues](https://github.com/CokeFever/trafficbot/issues)
2. 點擊 "New issue"
3. 選擇 "Feature Request"
4. 描述你的想法

### Q: 支援其他語言嗎？

A: 目前只支援繁體中文。如果你想貢獻其他語言的翻譯，歡迎提交 Pull Request！

### Q: 有 iOS/Android App 嗎？

A: 目前只有 Telegram Bot。TrafficBot 透過 Telegram 運作，可以在任何支援 Telegram 的裝置上使用。

## 🆘 還有問題？

如果這裡沒有你的問題：

- 💬 在 [Discussions](https://github.com/CokeFever/trafficbot/discussions) 提問
- 🐛 回報 [Issue](https://github.com/CokeFever/trafficbot/issues)
- 📖 查看 [使用者手冊](User-Guide)

---

[← 返回首頁](Home)
