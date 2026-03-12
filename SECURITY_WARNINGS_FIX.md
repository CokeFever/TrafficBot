# 🔒 Security Warnings 修復說明

**日期**: 2026-03-12  
**Migration**: 007_fix_security_warnings.sql

---

## 📋 Supabase Security Advisor 警告

### Warning 1: Function Search Path Mutable - update_updated_at_column

**問題**:
```
Function public.update_updated_at_column has a role mutable search_path
```

**說明**:
- 函式沒有設定固定的 `search_path`
- 可能被惡意使用者透過修改 search_path 來執行不安全的操作
- 這是 SQL injection 的一種變體攻擊向量

**修復**:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- 固定 search_path
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

**影響**:
- ✅ 提升安全性
- ✅ 防止 search_path 攻擊
- ✅ 功能不受影響

---

### Warning 2: Function Search Path Mutable - cleanup_old_user_states

**問題**:
```
Function public.cleanup_old_user_states has a role mutable search_path
```

**說明**:
- 同樣的 search_path 安全問題
- 這個函式用於清理超過 24 小時的舊 user states

**修復**:
```sql
CREATE OR REPLACE FUNCTION cleanup_old_user_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- 固定 search_path
AS $$
BEGIN
  DELETE FROM user_states
  WHERE updated_at < NOW() - INTERVAL '24 hours';
END;
$$;
```

**影響**:
- ✅ 提升安全性
- ✅ 功能不受影響

---

### Warning 3: RLS Policy Always True - trial_usage

**問題**:
```
Table public.trial_usage has an RLS policy "Service role can manage trial usage for ALL" 
that allows unrestricted access (both USING and WITH CHECK are always true)
```

**說明**:
- 原本的 policy 使用 `USING (true)` 和 `WITH CHECK (true)`
- 這對於 UPDATE/DELETE/INSERT 操作來說過於寬鬆
- Supabase Security Advisor 建議更嚴格的權限控制

**原本的 Policy**:
```sql
CREATE POLICY "Service role can manage trial usage for ALL"
  ON trial_usage
  FOR ALL
  USING (true)      -- 太寬鬆
  WITH CHECK (true) -- 太寬鬆
```

**修復方案**:

1. **保留 Service Role 的完整權限**（因為 Edge Functions 需要）:
```sql
CREATE POLICY "Service role has full access to trial_usage"
  ON trial_usage
  FOR ALL
  TO service_role  -- 明確指定只給 service_role
  USING (true)
  WITH CHECK (true);
```

2. **新增使用者唯讀權限**:
```sql
CREATE POLICY "Users can read their own trial usage"
  ON trial_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);
```

3. **新增輔助函式**:
```sql
CREATE FUNCTION is_service_role()
RETURNS boolean
-- 檢查當前呼叫者是否為 service role
```

**影響**:
- ✅ 更明確的權限控制
- ✅ 使用者只能讀取自己的試用記錄
- ✅ Service role 保持完整權限（Edge Functions 需要）
- ✅ 符合最小權限原則

---

## 🚀 部署步驟

### 方式 1: 透過 GitHub Actions（推薦）

```bash
git add supabase/migrations/007_fix_security_warnings.sql
git commit -m "fix: resolve Supabase Security Advisor warnings

- Set fixed search_path for update_updated_at_column function
- Set fixed search_path for cleanup_old_user_states function
- Improve RLS policies for trial_usage table
- Add is_service_role helper function"

git push origin main
```

### 方式 2: 手動執行

```bash
supabase db push
```

---

## ✅ 驗證修復

### 1. 檢查 Security Advisor

部署後，前往 Supabase Dashboard > Security Advisor，確認警告已消失。

### 2. 測試功能

確認以下功能正常運作：

- ✅ 停車位查詢（試用模式）
- ✅ 路況查詢
- ✅ 使用者設定更新
- ✅ 試用次數限制

### 3. 檢查 Functions

```sql
-- 檢查 functions 的 search_path 設定
SELECT 
  proname as function_name,
  prosecdef as security_definer,
  proconfig as config
FROM pg_proc
WHERE proname IN (
  'update_updated_at_column',
  'cleanup_old_user_states',
  'is_service_role'
);
```

應該看到 `proconfig` 包含 `{search_path=public,pg_temp}`

### 4. 檢查 RLS Policies

```sql
-- 檢查 trial_usage 的 policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'trial_usage';
```

---

## 📚 安全性最佳實踐

### 1. Search Path 安全

**為什麼要設定固定的 search_path？**

```sql
-- 不安全的函式
CREATE FUNCTION unsafe_function()
RETURNS void AS $$
BEGIN
  -- 如果 search_path 被修改，可能執行惡意程式碼
  PERFORM some_function();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 安全的函式
CREATE FUNCTION safe_function()
RETURNS void
SET search_path = public, pg_temp  -- 固定 search_path
AS $$
BEGIN
  -- 只會在 public schema 中尋找函式
  PERFORM some_function();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. RLS Policy 最佳實踐

**避免過於寬鬆的 policies**:

```sql
-- ❌ 不好：對所有操作都允許
CREATE POLICY "bad_policy"
  ON my_table
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ✅ 好：明確指定角色和條件
CREATE POLICY "good_policy"
  ON my_table
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ✅ 更好：分開不同操作的 policies
CREATE POLICY "users_read_own"
  ON my_table
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "service_role_full_access"
  ON my_table
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 3. SECURITY DEFINER 注意事項

使用 `SECURITY DEFINER` 時要特別小心：

```sql
CREATE FUNCTION privileged_function()
RETURNS void
SECURITY DEFINER  -- 以函式擁有者的權限執行
SET search_path = public, pg_temp  -- 必須設定固定 search_path
AS $$
BEGIN
  -- 這裡的操作會以擁有者權限執行
  -- 必須確保不會被濫用
END;
$$ LANGUAGE plpgsql;
```

---

## 🔍 相關資源

- [PostgreSQL Search Path Security](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/sql-security.html)

---

## 📝 變更記錄

### Migration 007 (2026-03-12)
- ✅ 修復 `update_updated_at_column` 的 search_path
- ✅ 修復 `cleanup_old_user_states` 的 search_path
- ✅ 改善 `trial_usage` 的 RLS policies
- ✅ 新增 `is_service_role` 輔助函式

---

**狀態**: ✅ 準備部署  
**影響**: 提升安全性，功能不受影響
