# GitHub Labels 設定指南

本專案使用標準化的 labels 來管理 issues 和 pull requests。

## 📋 Labels 列表

詳見 [labels.yml](labels.yml) 檔案。

## 🚀 批次建立 Labels

### 方式 1: 使用 GitHub CLI（推薦）

```bash
# 安裝 GitHub CLI
# https://cli.github.com/

# 登入
gh auth login

# 批次建立 labels
gh label create "bug" --color "d73a4a" --description "有問題需要修復"
gh label create "enhancement" --color "a2eeef" --description "新功能或改進請求"
gh label create "documentation" --color "0075ca" --description "文件相關的改進或新增"
# ... 其他 labels
```

### 方式 2: 使用腳本

建立一個 Node.js 腳本來批次建立：

```javascript
// scripts/setup-github-labels.js
const { Octokit } = require("@octokit/rest");
const yaml = require('js-yaml');
const fs = require('fs');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const labels = yaml.load(fs.readFileSync('.github/labels.yml', 'utf8'));

async function setupLabels() {
  for (const label of labels) {
    try {
      await octokit.issues.createLabel({
        owner: 'CokeFever',
        repo: 'trafficbot',
        name: label.name,
        color: label.color,
        description: label.description
      });
      console.log(`✅ Created label: ${label.name}`);
    } catch (error) {
      if (error.status === 422) {
        console.log(`⚠️  Label already exists: ${label.name}`);
      } else {
        console.error(`❌ Error creating label ${label.name}:`, error.message);
      }
    }
  }
}

setupLabels();
```

執行：
```bash
npm install @octokit/rest js-yaml
GITHUB_TOKEN=your_token node scripts/setup-github-labels.js
```

### 方式 3: 手動建立

1. 前往 https://github.com/CokeFever/trafficbot/labels
2. 點擊 "New label"
3. 根據 labels.yml 的內容逐一建立

## 📚 Labels 使用指南

### Type Labels（類型）

- `bug` - 回報 bug
- `enhancement` - 功能請求
- `documentation` - 文件更新
- `question` - 提問
- `security` - 安全性問題

### Priority Labels（優先級）

- `priority:critical` - 緊急
- `priority:high` - 高
- `priority:medium` - 中
- `priority:low` - 低

### Status Labels（狀態）

- `status:in-progress` - 處理中
- `status:blocked` - 被阻擋
- `status:needs-review` - 需要審查
- `status:ready` - 準備好
- `status:wontfix` - 不會修復

### Component Labels（元件）

- `component:bot` - Bot 相關
- `component:database` - 資料庫
- `component:api` - API
- `component:deployment` - 部署
- `component:docs` - 文件

### Feature Labels（功能）

- `feature:parking` - 停車位功能
- `feature:traffic` - 路況功能
- `feature:setup` - 設定功能

### Size Labels（大小）

- `size:XS` - < 10 行
- `size:S` - 10-50 行
- `size:M` - 50-200 行
- `size:L` - 200-500 行
- `size:XL` - > 500 行

### Special Labels（特殊）

- `good first issue` - 適合新手
- `help wanted` - 需要協助
- `duplicate` - 重複
- `invalid` - 無效
- `breaking change` - 破壞性變更
- `dependencies` - 相依套件

## 💡 使用範例

### Issue 範例

```
Title: 停車位查詢回傳錯誤

Labels:
- bug
- priority:high
- component:bot
- feature:parking
```

### Pull Request 範例

```
Title: 新增路況查詢快取功能

Labels:
- enhancement
- component:api
- feature:traffic
- size:M
```

## 🔄 維護

定期檢查和更新 labels：

1. 移除不再使用的 labels
2. 新增需要的 labels
3. 更新 labels.yml 檔案
4. 同步到 GitHub

---

**注意**: 建立 labels 需要 repository 的 admin 權限。
