# 安全政策

## 🔒 支援的版本

目前支援安全更新的版本：

| 版本 | 支援狀態 |
| --- | --- |
| main (latest) | ✅ |
| 其他分支 | ❌ |

## 🚨 回報安全漏洞

如果你發現安全漏洞，請**不要**公開發布 Issue。

### 回報方式

請透過以下方式私下回報：

1. 發送 email 到：[coke@ixo.app]
2. 或在 GitHub 使用 [Security Advisories](https://github.com/CokeFever/trafficbot/security/advisories/new)

### 回報內容

請包含以下資訊：

- 漏洞類型
- 受影響的版本
- 重現步驟
- 潛在影響
- 建議的修復方式（如果有）

### 回應時間

- 我們會在 48 小時內確認收到你的回報
- 我們會在 7 天內提供初步評估
- 我們會盡快修復並發布安全更新

## 🛡️ 安全最佳實踐

### 環境變數管理

**絕對不要**將敏感資訊提交到 Git：

```bash
# ❌ 錯誤
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# ✅ 正確 - 使用環境變數
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
```

### API Key 保護

1. **TDX API Key**
   - 儲存在資料庫時使用加密
   - 使用 `ENCRYPTION_KEY` 環境變數
   - 定期輪換 API Key

2. **Telegram Bot Token**
   - 僅存在環境變數中
   - 不要記錄在 logs
   - 如果洩漏，立即透過 @BotFather 重新產生

3. **Supabase Keys**
   - 使用 Service Role Key 於 Edge Functions
   - 使用 Anon Key 於客戶端（如果有）
   - 啟用 Row Level Security (RLS)

### 資料庫安全

#### Row Level Security (RLS)

所有資料表都已啟用 RLS：

```sql
-- 使用者只能存取自己的資料
CREATE POLICY "Users can read their own data"
  ON user_configs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);
```

#### 敏感資料加密

```typescript
// TDX API Key 加密儲存
import { encrypt, decrypt } from './crypto';

const encryptedKey = encrypt(apiKey, process.env.ENCRYPTION_KEY);
await saveToDatabase(userId, encryptedKey);
```

### Edge Functions 安全

1. **輸入驗證**
   ```typescript
   // 驗證所有使用者輸入
   if (!isValidRadius(radius)) {
     throw new Error('Invalid radius');
   }
   ```

2. **錯誤處理**
   ```typescript
   // 不要洩漏敏感資訊
   catch (error) {
     console.error('Internal error:', error);
     return { error: 'An error occurred' }; // 通用錯誤訊息
   }
   ```

3. **Rate Limiting**
   - 停車位查詢：試用模式每人每天 2 次
   - 路況查詢：需要 API Key
   - 考慮實作更嚴格的 rate limiting

### Webhook 安全

1. **HTTPS Only**
   - Telegram webhook 必須使用 HTTPS
   - Supabase Edge Functions 預設使用 HTTPS

2. **驗證請求來源**
   ```typescript
   // 驗證請求來自 Telegram
   const isValidRequest = verifyTelegramRequest(request);
   if (!isValidRequest) {
     return new Response('Unauthorized', { status: 401 });
   }
   ```

## 🔐 部署安全檢查清單

### GitHub Secrets 設定

確保以下 secrets 已正確設定：

- [ ] `SUPABASE_ACCESS_TOKEN` - Supabase 存取 token
- [ ] `TELEGRAM_BOT_TOKEN` - Telegram bot token
- [ ] `ENCRYPTION_KEY` - 資料加密金鑰

### Supabase 設定

- [ ] 啟用 Row Level Security (RLS)
- [ ] 設定正確的 RLS policies
- [ ] 限制 API 存取權限
- [ ] 啟用資料庫備份
- [ ] 設定 Edge Function 環境變數

### 監控與日誌

- [ ] 設定錯誤監控
- [ ] 定期檢查 logs
- [ ] 監控異常 API 使用
- [ ] 追蹤失敗的驗證嘗試

## 📋 安全稽核

### 定期檢查

每季度執行以下檢查：

1. **相依套件更新**
   ```bash
   npm audit
   npm audit fix
   ```

2. **環境變數檢查**
   - 確認沒有硬編碼的 secrets
   - 檢查 `.env.example` 不包含真實值

3. **權限檢查**
   - 審查資料庫 RLS policies
   - 檢查 API 存取權限
   - 確認最小權限原則

4. **程式碼審查**
   - 檢查 SQL injection 風險
   - 驗證輸入處理
   - 審查錯誤處理邏輯

## 🚫 已知限制

### 目前的安全限制

1. **JWT 驗證**
   - Edge Function 目前停用 JWT 驗證 (`--no-verify-jwt`)
   - 原因：Telegram webhook 不使用 JWT
   - 風險：任何人都可以呼叫 webhook endpoint
   - 緩解：實作 Telegram request 驗證

2. **Rate Limiting**
   - 目前僅有基本的試用模式限制
   - 建議：實作更完整的 rate limiting

3. **API Key 管理**
   - 使用者自行管理 TDX API Key
   - 建議：提供 API Key 輪換機制

## 📚 安全資源

### 參考文件

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Telegram Bot Security](https://core.telegram.org/bots/webhooks#testing-your-bot-with-updates)

### 工具

- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - 檢查相依套件漏洞
- [Snyk](https://snyk.io/) - 安全漏洞掃描
- [GitHub Security](https://github.com/security) - GitHub 安全功能

## 🙏 致謝

感謝所有回報安全問題的研究人員和使用者。

---

最後更新：2026-03-12
