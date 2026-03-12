# 快速開始

這個指南將幫助你在 5 分鐘內開始使用 TrafficBot。

## 📱 使用 Bot

### 1. 找到 Bot

在 Telegram 搜尋你的 Bot 名稱或使用 Bot 的 username。

### 2. 開始對話

```
/start
```

你會看到歡迎訊息和功能介紹。

### 3. 查詢停車位（試用模式）

```
/parking
```

1. 選擇搜尋範圍（250m / 500m / 1km）
2. 分享你的位置
3. 查看附近停車場資訊

**試用模式**：每人每天可免費查詢 2 次，無需設定 API Key。

### 4. 設定 TDX API Key（選用）

如果你想使用路況查詢功能，需要設定 TDX API Key：

```
/setup
```

按照提示輸入：
1. TDX Client ID
2. TDX Client Secret

### 5. 查詢路況

設定 API Key 後：

```
/traffic
```

1. 選擇搜尋範圍（250m / 500m / 1km）
2. 分享你的位置
3. 查看附近路況資訊

## 🔑 取得 TDX API Key

1. 前往 [TDX 平台](https://tdx.transportdata.tw/)
2. 註冊帳號並登入
3. 進入「會員中心」
4. 點擊「API 金鑰管理」
5. 建立新的 API 金鑰
6. 複製 Client ID 和 Client Secret

詳細步驟請參考 [設定 TDX API Key](Setup-TDX-API)。

## 📖 更多資訊

- [使用者手冊](User-Guide) - 完整的使用說明
- [Bot 指令說明](Bot-Commands) - 所有可用指令
- [常見問題](FAQ) - 常見問題解答

## 🆘 需要協助？

如果遇到問題：

1. 查看 [疑難排解](Troubleshooting)
2. 在 [Discussions](https://github.com/CokeFever/trafficbot/discussions) 提問
3. 回報 [Issue](https://github.com/CokeFever/trafficbot/issues)

---

[← 返回首頁](Home)
