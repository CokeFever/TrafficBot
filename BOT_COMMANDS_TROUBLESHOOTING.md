# Telegram Bot Commands 疑難排解

## 問題：輸入 `/` 沒有看到指令列表

### 原因

根據 [Telegram Bot API 文件](https://core.telegram.org/bots/api#setmycommands) 和社群回報，這是 Telegram 的快取機制造成的。

### 解決方案

#### 方法 1: 重新開啟對話（最簡單）

1. 在 Telegram 切換到其他對話
2. 再切換回 Bot 對話
3. 輸入 `/` 應該就能看到指令列表了

**為什麼？** Telegram 會快取 Bot Commands，只有在重新進入對話時才會更新。

---

#### 方法 2: 刪除並重新開始對話

1. 在 Telegram 刪除與 Bot 的對話
2. 重新搜尋並開啟 Bot
3. 發送 `/start`
4. 輸入 `/` 應該就能看到指令列表

---

#### 方法 3: 使用 BotFather 設定（備用方案）

如果上述方法都不行，可以透過 BotFather 手動設定：

1. 在 Telegram 開啟 [@BotFather](https://t.me/botfather)
2. 發送 `/setcommands`
3. 選擇你的 Bot
4. 輸入以下指令列表：

```
start - 開始使用
help - 查看說明
parking - 搜尋附近停車位
setup - 設定 TDX API Key
config - 查看當前配置
reset - 重置配置
```

5. 完成後，重新開啟與 Bot 的對話

---

## 驗證 Commands 是否設定成功

### 方法 1: 使用 getMyCommands API

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMyCommands"
```

應該會看到：
```json
{
  "ok": true,
  "result": [
    {"command": "start", "description": "開始使用"},
    {"command": "help", "description": "查看說明"},
    {"command": "parking", "description": "搜尋附近停車位"},
    {"command": "setup", "description": "設定 TDX API Key"},
    {"command": "config", "description": "查看當前配置"},
    {"command": "reset", "description": "重置配置"}
  ]
}
```

### 方法 2: 使用我們的驗證腳本

```bash
npx ts-node scripts/verify-bot-commands.ts
```

---

## 常見問題

### Q1: 我執行了 setup-bot-commands.ts，但還是看不到指令？

**A:** 這是正常的！Telegram 有快取機制。請：
1. 切換到其他對話
2. 再切換回 Bot 對話
3. 或者刪除對話重新開始

### Q2: 指令列表只顯示部分指令？

**A:** 可能是之前設定的指令還在快取中。請：
1. 重新執行 `npx ts-node scripts/setup-bot-commands.ts`
2. 刪除與 Bot 的對話
3. 重新開始對話

### Q3: 在群組中看不到指令列表？

**A:** 群組中的 Bot Commands 行為可能不同。請確認：
1. Bot 是否有群組管理員權限
2. 嘗試在私人對話中測試

### Q4: 指令列表是空的？

**A:** 檢查：
1. `TELEGRAM_BOT_TOKEN` 是否正確
2. 執行 `npx ts-node scripts/verify-bot-commands.ts` 確認
3. 查看腳本執行時是否有錯誤訊息

---

## 技術細節

### setMyCommands API

根據 [Telegram Bot API 文件](https://core.telegram.org/bots/api#setmycommands)：

```
POST https://api.telegram.org/bot<token>/setMyCommands
Content-Type: application/json

{
  "commands": [
    {"command": "start", "description": "開始使用"},
    {"command": "help", "description": "查看說明"}
  ]
}
```

### 快取機制

Telegram 會在以下情況更新 Commands 快取：
- 使用者重新開啟與 Bot 的對話
- 使用者刪除並重新開始對話
- 使用者切換到其他對話再切換回來

### Scope 參數

`setMyCommands` 支援 `scope` 參數，可以為不同的使用者或群組設定不同的指令：

- `default` - 所有對話（預設）
- `all_private_chats` - 所有私人對話
- `all_group_chats` - 所有群組對話
- `all_chat_administrators` - 所有群組管理員
- `chat` - 特定對話
- `chat_administrators` - 特定群組的管理員
- `chat_member` - 特定對話的特定使用者

我們目前使用預設的 `default` scope。

---

## 參考資料

- [Telegram Bot API - setMyCommands](https://core.telegram.org/bots/api#setmycommands)
- [Telegram Bot API - getMyCommands](https://core.telegram.org/bots/api#getmycommands)
- [Telegram Bot API - BotCommand](https://core.telegram.org/bots/api#botcommand)
- [Telegram Bot API - BotCommandScope](https://core.telegram.org/bots/api#botcommandscope)

---

## 快速檢查清單

- [ ] 執行 `npx ts-node scripts/setup-bot-commands.ts`
- [ ] 看到 "✅ Bot commands set successfully!"
- [ ] 執行 `npx ts-node scripts/verify-bot-commands.ts` 確認
- [ ] 在 Telegram 切換到其他對話
- [ ] 切換回 Bot 對話
- [ ] 輸入 `/` 查看指令列表
- [ ] 如果還是看不到，刪除對話重新開始

---

**記住：Telegram 的快取機制是正常的，不是 Bug！** 🎯
