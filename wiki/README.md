# Wiki 內容說明

這個目錄包含 TrafficBot 的 Wiki 頁面內容。

## 📝 如何使用

這些 Markdown 檔案需要手動上傳到 GitHub Wiki：

### 方式 1: 透過 GitHub Web Interface

1. 前往 https://github.com/CokeFever/trafficbot/wiki
2. 點擊 "Create the first page" 或 "New Page"
3. 複製對應的 .md 檔案內容
4. 貼上並儲存

### 方式 2: 透過 Git Clone

```bash
# Clone wiki repository
git clone https://github.com/CokeFever/trafficbot.wiki.git

# 複製 wiki 檔案
cp wiki/*.md trafficbot.wiki/

# 提交並推送
cd trafficbot.wiki
git add .
git commit -m "Add wiki pages"
git push origin master
```

## 📚 Wiki 頁面列表

- `Home.md` - Wiki 首頁
- `Quick-Start.md` - 快速開始指南
- `FAQ.md` - 常見問題

## 🔄 更新 Wiki

當文件更新時：

1. 更新對應的 .md 檔案
2. 同步到 GitHub Wiki
3. 確認連結正確

## 📖 Wiki 連結格式

在 Wiki 中使用內部連結：

```markdown
[連結文字](Page-Name)
```

例如：
```markdown
[快速開始](Quick-Start)
[常見問題](FAQ)
```

## 🎨 Wiki 樣式

GitHub Wiki 支援：
- Markdown 語法
- 程式碼區塊
- 表格
- 圖片
- 連結

## 📌 注意事項

1. Wiki 頁面名稱使用 `-` 分隔（例如：`Quick-Start`）
2. 檔案名稱要與頁面名稱一致
3. 內部連結不需要 `.md` 副檔名
4. 圖片需要上傳到 Wiki 或使用外部連結

---

更多資訊請參考 [GitHub Wiki 文件](https://docs.github.com/en/communities/documenting-your-project-with-wikis)
