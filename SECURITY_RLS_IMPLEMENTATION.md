# Row Level Security (RLS) 實作說明

**日期**: 2026-03-10  
**目的**: 修復 Supabase 安全性警告，啟用 Row Level Security

## 📋 問題描述

Supabase 偵測到以下資料表未啟用 RLS：
- `public.user_configs`
- `public.routine_routes`
- `public.notification_records`
- `public.cache_entries`
- `public.key_value_store`
- `public.user_states`
- `public.trial_usage`

## ✅ 解決方案

創建 migration `005_enable_rls.sql` 來：
1. 啟用所有資料表的 RLS
2. 設定適當的安全政策

## 🔒 安全政策設計

### 1. Service Role 政策
**適用於**: 所有資料表  
**權限**: 完全存取 (SELECT, INSERT, UPDATE, DELETE)  
**原因**: Edge Functions 使用 service role 來操作資料

```sql
CREATE POLICY "Service role has full access to {table}"
  ON {table}
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 2. User Data 政策
**適用於**: user_configs, routine_routes, user_states, trial_usage  
**權限**: 用戶只能存取自己的資料  
**過濾條件**: `user_id = auth.uid()::text`

#### 範例：user_configs
```sql
-- 讀取
CREATE POLICY "Users can read their own config"
  ON user_configs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- 新增
CREATE POLICY "Users can insert their own config"
  ON user_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- 更新
CREATE POLICY "Users can update their own config"
  ON user_configs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- 刪除
CREATE POLICY "Users can delete their own config"
  ON user_configs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);
```

### 3. Backend-Only 政策
**適用於**: cache_entries, key_value_store  
**權限**: 僅 service role 可存取  
**原因**: 這些是內部快取和儲存，不應讓用戶直接存取

### 4. Read-Only User 政策
**適用於**: notification_records, trial_usage  
**權限**: 用戶只能讀取自己的資料  
**原因**: 這些資料由系統產生，用戶不應修改

## 📊 資料表權限總覽

| 資料表 | Service Role | Authenticated User | Anonymous |
|--------|--------------|-------------------|-----------|
| user_configs | 完全存取 | 自己的資料 (CRUD) | 無 |
| routine_routes | 完全存取 | 自己的資料 (CRUD) | 無 |
| notification_records | 完全存取 | 自己的資料 (R) | 無 |
| cache_entries | 完全存取 | 無 | 無 |
| key_value_store | 完全存取 | 無 | 無 |
| user_states | 完全存取 | 自己的資料 (CRUD) | 無 |
| trial_usage | 完全存取 | 自己的資料 (R) | 無 |

## 🔧 部署步驟

### 方法 1: 透過 GitHub Action 自動部署
```bash
git add supabase/migrations/005_enable_rls.sql
git commit -m "security: Enable RLS on all tables"
git push origin main
```

GitHub Action 會自動執行 migration。

### 方法 2: 手動執行 Migration
```bash
# 使用 Supabase CLI
supabase db push

# 或直接在 Supabase Dashboard 執行 SQL
```

## ✅ 驗證步驟

### 1. 檢查 RLS 是否啟用
在 Supabase Dashboard 執行：
```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

所有資料表的 `rowsecurity` 應該是 `true`。

### 2. 檢查政策是否存在
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

應該看到所有定義的政策。

### 3. 測試 Edge Function
執行現有的 Edge Function 測試，確保功能正常：
- `/parking` 指令
- `/traffic` 指令
- `/setup` 指令

## 🛡️ 安全性改進

### Before (無 RLS)
- ❌ 任何人都可以讀取所有用戶的 API keys
- ❌ 任何人都可以修改其他用戶的設定
- ❌ 沒有資料隔離

### After (啟用 RLS)
- ✅ 用戶只能存取自己的資料
- ✅ Edge Functions 透過 service role 正常運作
- ✅ 符合 Supabase 安全最佳實踐
- ✅ 防止資料洩漏和未授權存取

## 📝 注意事項

### 1. Service Role Key 安全
- Service role key 具有完全存取權限
- 僅在 Edge Functions 中使用
- 不要暴露在客戶端程式碼中
- 已正確設定在環境變數 `SUPABASE_SERVICE_ROLE_KEY`

### 2. User Authentication
目前系統使用 Telegram user_id 作為識別：
- Edge Functions 使用 service role 操作資料
- 未來如需直接客戶端存取，需實作 Supabase Auth

### 3. Migration 順序
- Migration 檔案按數字順序執行
- `005_enable_rls.sql` 會在現有 schema 之後執行
- 不會影響現有資料

## 🔄 回滾計畫

如果需要回滾（不建議）：
```sql
-- 停用 RLS
ALTER TABLE user_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE routine_routes DISABLE ROW LEVEL SECURITY;
-- ... 其他資料表

-- 刪除政策
DROP POLICY IF EXISTS "Service role has full access to user_configs" ON user_configs;
-- ... 其他政策
```

## 📚 參考資料

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)

## 🎯 結論

啟用 RLS 後：
1. ✅ 修復所有 Supabase 安全性警告
2. ✅ 保護用戶資料隱私
3. ✅ 維持 Edge Functions 正常運作
4. ✅ 符合安全最佳實踐

---

**狀態**: ✅ 已實作，待部署  
**影響**: 無功能影響，純安全性增強  
**測試**: 需驗證 Edge Functions 正常運作
