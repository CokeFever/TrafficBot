# Implementation Plan: Telegram Parking Bot

## Overview

本實作計畫將 Telegram Parking Bot 分解為可執行的開發任務。系統採用 TypeScript 實作，使用 Supabase 作為 Backend 部署選項，並整合 TDX API 提供停車位查詢、車流查詢和主動通知功能。

實作策略：
1. 先建立核心基礎設施和資料模型
2. 實作 TDX API 整合層
3. 開發 Bot 指令處理和使用者互動
4. 實作停車位和車流查詢功能
5. 建立經常性路線管理和通知服務
6. 完成使用者配置流程
7. 整合所有元件並進行端到端測試

## Tasks

- [x] 1. 建立專案結構和核心基礎設施
  - 初始化 TypeScript 專案（tsconfig.json, package.json）
  - 安裝依賴套件：telegraf（Telegram Bot 框架）、node-fetch（HTTP 請求）、dotenv（環境變數）
  - 建立目錄結構：src/{services, models, utils, handlers, integrations}
  - 設定 ESLint 和 Prettier
  - 建立 .env.example 檔案範本
  - _Requirements: 13.1, 13.8_

- [x]* 1.1 設定測試框架
  - 安裝 Jest 和 fast-check
  - 設定 jest.config.js
  - 建立測試目錄結構：tests/{unit, integration, properties}
  - 建立測試工具函式和 mock 物件
  - _Requirements: 所有需求的測試基礎_

- [x] 2. 實作資料模型和介面定義
  - [x] 2.1 建立核心資料模型（src/models/types.ts）
    - 定義 Coordinates, Location, Route 介面
    - 定義 ParkingFacility, TrafficInfo, TrafficEvent 介面
    - 定義 RoutineRoute, NotificationPreferences 介面
    - 定義 UserConfig, BackendConfig 介面
    - _Requirements: 1.1, 2.1, 3.1, 4.2, 13.7_
  
  - [ ]* 2.2 撰寫資料模型的屬性測試
    - **Property 11: 經常性路線持久化 Round Trip**
    - **Validates: Requirements 4.2, 4.7, 9.1**
  
  - [x] 2.3 建立 TDX API 回應模型（src/models/tdx-types.ts）
    - 定義 TdxParkingResponse, TdxTrafficResponse, TdxEventResponse 介面
    - 建立 TDX 資料轉換函式
    - _Requirements: 6.2_
  
  - [ ]* 2.4 撰寫 TDX 資料解析的屬性測試
    - **Property 21: TDX API JSON 解析 Round Trip**
    - **Validates: Requirements 6.2**

- [x] 3. 實作 Data Store 抽象層
  - [x] 3.1 建立 DataStore 介面（src/services/data-store.ts）
    - 定義 get, set, delete, listKeys, batchSet, batchGet 方法
    - _Requirements: 4.7, 9.1, 9.2_
  
  - [x] 3.2 實作 Supabase DataStore（src/services/supabase-store.ts）
    - 建立 Supabase 客戶端連線
    - 實作 SQL 查詢方法
    - 建立資料庫 schema（user_configs, routine_routes, notification_records, cache_entries）
    - _Requirements: 9.5, 11.2_
  
  - [ ]* 3.3 撰寫 DataStore 的屬性測試
    - **Property 11: 經常性路線持久化 Round Trip**
    - **Property 40: API 金鑰加密儲存 Round Trip**
    - **Validates: Requirements 4.2, 13.7, 13.16**

- [x] 4. 實作 Cache Layer
  - [x] 4.1 建立 CacheLayer 類別（src/services/cache.ts）
    - 實作 get, set, clear, generateKey 方法
    - 設定 TTL 為 5 分鐘
    - 使用 DataStore 作為底層儲存
    - _Requirements: 11.3_
  
  - [ ]* 4.2 撰寫快取的屬性測試
    - **Property 33: API 回應快取**
    - **Validates: Requirements 11.3**

- [x] 5. 實作 Location Parser
  - [x] 5.1 建立 LocationParser 類別（src/utils/location-parser.ts）
    - 實作 parseTelegramLocation 方法
    - 實作 parseGoogleMapsUrl 方法（支援 maps.app.goo.gl 和 google.com/maps）
    - 實作 parseRouteUrl 方法
    - 實作 isInTaiwan 方法（經度 119-122°E，緯度 21-26°N）
    - 實作距離計算函式（Haversine formula）
    - _Requirements: 1.1, 2.1, 2.6, 3.1, 12.1, 12.2, 12.3, 12.4, 12.6_
  
  - [ ]* 5.2 撰寫 Location Parser 的屬性測試
    - **Property 1: Telegram 位置訊息解析**
    - **Property 6: Google Maps URL 解析**
    - **Property 7: 距離計算**
    - **Property 37: 台灣境內座標驗證**
    - **Validates: Requirements 1.1, 2.1, 2.5, 2.6, 3.1, 12.1, 12.2, 12.3, 12.4, 12.6**
  
  - [ ]* 5.3 撰寫 Location Parser 的單元測試
    - 測試無效 URL 格式處理
    - 測試邊界座標（台灣邊界）
    - 測試距離計算的已知範例
    - _Requirements: 10.2, 12.7_

- [x] 6. 實作 TDX API Client
  - [x] 6.1 建立 TdxApiClient 類別（src/integrations/tdx-client.ts）
    - 實作 makeRequest 通用方法（含重試機制，最多 3 次）
    - 實作 queryParkingFacilities 方法
    - 實作 queryTrafficFlow 方法
    - 實作 queryTrafficEvents 方法
    - 設定 10 秒請求逾時
    - 實作指數退避重試策略
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.7, 10.4_
  
  - [ ]* 6.2 撰寫 TDX API Client 的屬性測試
    - **Property 3: TDX API 呼叫包含認證**
    - **Property 31: API 請求重試機制**
    - **Validates: Requirements 1.3, 2.3, 6.1, 10.4**
  
  - [ ]* 6.3 撰寫 TDX API Client 的單元測試
    - 測試 API 連線失敗處理
    - 測試 API 逾時處理
    - 測試錯誤狀態碼處理
    - 測試重試機制（使用 mock）
    - _Requirements: 1.6, 6.6, 10.1_

- [x] 7. 實作 Parking Service
  - [x] 7.1 建立 ParkingService 類別（src/services/parking-service.ts）
    - 實作 searchNearby 方法（整合 TdxApiClient 和 CacheLayer）
    - 實作 formatParkingInfo 方法（格式化為 Telegram 訊息）
    - 實作 generateNavigationLink 方法（產生 Google Maps 連結）
    - 實作結果排序（按距離由近到遠）
    - 處理缺失資料（顯示「資訊未提供」）
    - _Requirements: 1.3, 1.4, 1.5, 2.3, 2.4, 2.5, 7.1, 7.2, 7.3, 7.5, 7.6_
  
  - [ ]* 7.2 撰寫 Parking Service 的屬性測試
    - **Property 2: 搜尋半徑參數傳遞**
    - **Property 4: 停車設施類型區分**
    - **Property 5: 停車設施資訊完整性**
    - **Property 22: 停車設施結果排序**
    - **Property 24: 導航連結生成**
    - **Property 25: 缺失資料處理**
    - **Validates: Requirements 1.2, 1.4, 1.5, 2.2, 2.4, 7.2, 7.3, 7.5, 7.6_
  
  - [ ]* 7.3 撰寫 Parking Service 的單元測試
    - 測試空結果列表處理
    - 測試 TDX API 錯誤處理
    - 測試快取命中情境
    - _Requirements: 1.6, 11.3_

- [x] 8. 實作 Traffic Service
  - [x] 8.1 建立 TrafficService 類別（src/services/traffic-service.ts）
    - 實作 queryRouteTraffic 方法
    - 實作 queryTrafficEvents 方法
    - 實作 formatTrafficInfo 方法（包含視覺化符號 🟢🟡🔴）
    - 實作車流狀態分類邏輯（smooth, congested, heavy_congestion）
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 7.4_
  
  - [ ]* 8.2 撰寫 Traffic Service 的屬性測試
    - **Property 8: 車流狀態分類**
    - **Property 9: 交通事故資訊完整性**
    - **Property 10: 路線時間估算**
    - **Property 23: 車流視覺化符號**
    - **Validates: Requirements 3.3, 3.4, 3.5, 7.4**
  
  - [ ]* 8.3 撰寫 Traffic Service 的單元測試
    - 測試無車流資料情境
    - 測試路線解析失敗處理
    - _Requirements: 3.6, 3.7_

- [ ] 9. Checkpoint - 確保核心服務測試通過
  - 執行所有已實作的單元測試和屬性測試
  - 確認 TDX API Client、Parking Service、Traffic Service 正常運作
  - 如有問題請詢問使用者

- [x] 10. 實作 Route Service
  - [x] 10.1 建立 RouteService 類別（src/services/route-service.ts）
    - 實作 addRoutineRoute 方法（含路線數量限制檢查，最多 5 條）
    - 實作 getRoutineRoutes 方法
    - 實作 deleteRoutineRoute 方法
    - 實作 updateRouteName 方法
    - 使用 DataStore 進行持久化
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 11.4_
  
  - [ ]* 10.2 撰寫 Route Service 的屬性測試
    - **Property 11: 經常性路線持久化 Round Trip**
    - **Property 12: 路線列表查詢**
    - **Property 13: 路線刪除**
    - **Property 14: 路線名稱更新**
    - **Property 34: 路線數量限制**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.7, 9.1, 11.4**
  
  - [ ]* 10.3 撰寫 Route Service 的單元測試
    - 測試超過 5 條路線的拒絕邏輯
    - 測試刪除不存在的路線
    - 測試更新不存在的路線
    - _Requirements: 11.4_

- [x] 11. 實作 Notification Service
  - [x] 11.1 建立 NotificationService 類別（src/services/notification-service.ts）
    - 實作 runMonitoringTask 方法（主要監控邏輯）
    - 實作 checkRoute 方法（檢查單一路線）
    - 實作 shouldNotify 方法（判斷是否需要通知）
    - 實作 sendNotification 方法
    - 實作通知去重邏輯（30 分鐘內不重複）
    - 實作通知時段過濾邏輯
    - 實作歷史通知清理（30 天前的記錄）
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.3, 9.6, 11.5_
  
  - [ ]* 11.2 撰寫 Notification Service 的屬性測試
    - **Property 15: 異常事件判定**
    - **Property 16: 車流狀態變化偵測**
    - **Property 17: 重大事故通知**
    - **Property 18: 通知訊息完整性**
    - **Property 19: 通知去重**
    - **Property 20: 通知時段過濾**
    - **Property 35: 歷史通知清理**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.6, 11.5**
  
  - [ ]* 11.3 撰寫 Notification Service 的單元測試
    - 測試監控任務執行失敗處理
    - 測試無經常性路線的情境
    - 測試通知發送失敗處理
    - _Requirements: 9.7_

- [x] 12. 實作 Config Service
  - [x] 12.1 建立 ConfigService 類別（src/services/config-service.ts）
    - 實作 isConfigured 方法
    - 實作 saveTdxApiKey 方法（含加密）
    - 實作 getTdxApiKey 方法（含解密）
    - 實作 validateApiKey 方法（透過測試 API 呼叫）
    - 實作 saveBackendConfig 方法
    - 實作 getConfigSummary 方法
    - 實作 resetConfig 方法
    - 使用 crypto 模組進行 API 金鑰加密
    - _Requirements: 13.1, 13.4, 13.5, 13.6, 13.7, 13.10, 13.11, 13.14, 13.15, 13.16_
  
  - [ ]* 12.2 撰寫 Config Service 的屬性測試
    - **Property 38: 使用者配置狀態檢查**
    - **Property 39: TDX API 金鑰驗證**
    - **Property 40: API 金鑰加密儲存 Round Trip**
    - **Property 41: Backend 連線驗證**
    - **Property 42: 配置重置**
    - **Property 43: 多使用者資料隔離**
    - **Validates: Requirements 13.1, 13.5, 13.7, 13.11, 13.15, 13.16, 13.17**
  
  - [ ]* 12.3 撰寫 Config Service 的單元測試
    - 測試無效 API 金鑰驗證失敗
    - 測試 Backend 連線失敗處理
    - 測試加密金鑰遺失情境
    - _Requirements: 13.6, 13.12_

- [x] 13. 實作 Bot Handler 核心
  - [x] 13.1 建立 BotHandler 類別（src/handlers/bot-handler.ts）
    - 初始化 Telegraf bot 實例
    - 實作 handleWebhook 方法
    - 實作 handleCommand 方法（指令路由）
    - 實作 handleLocation 方法
    - 實作 handleCallback 方法（Inline Keyboard 回調）
    - 實作 sendMessage 方法（含錯誤處理）
    - 實作長時間處理回饋機制（5 秒後顯示「處理中」）
    - _Requirements: 8.1, 8.2, 8.3, 10.7_
  
  - [ ]* 13.2 撰寫 Bot Handler 的屬性測試
    - **Property 28: 無效指令處理**
    - **Property 30: 無效位置輸入處理**
    - **Property 32: 輸入驗證防注入**
    - **Validates: Requirements 8.8, 10.2, 10.6**
  
  - [ ]* 13.3 撰寫 Bot Handler 的單元測試
    - 測試 /start 指令回應
    - 測試 /help 指令回應
    - 測試未預期錯誤處理
    - _Requirements: 8.1, 8.2, 10.3_

- [x] 14. 實作配置流程指令
  - [x] 14.1 實作 /setup 指令處理（src/handlers/setup-handler.ts）
    - 引導使用者輸入 TDX API 金鑰
    - 驗證 API 金鑰有效性
    - 引導使用者輸入 Supabase Backend 連線資訊
    - 驗證 Backend 連線可用性
    - 顯示配置摘要
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.8, 13.9, 13.10, 13.11, 13.12, 13.13_
  
  - [x] 14.2 實作 /config 指令處理
    - 顯示當前配置狀態（已配置 API 金鑰、Backend 類型、配置時間）
    - _Requirements: 13.14_
  
  - [x] 14.3 實作 /reset 指令處理
    - 確認使用者意圖（使用 Inline Keyboard）
    - 清除所有配置
    - 顯示重置成功訊息
    - _Requirements: 13.15_
  
  - [ ]* 14.4 撰寫配置流程的單元測試
    - 測試未完成配置時的提示
    - 測試 API 金鑰驗證失敗流程
    - 測試 Backend 連線驗證失敗流程
    - _Requirements: 13.1, 13.6, 13.12_

- [x] 15. 實作停車位查詢指令
  - [x] 15.1 實作 /parking 指令處理（src/handlers/parking-handler.ts）
    - 檢查使用者是否已完成配置
    - 提示使用者分享位置或提供 Google Maps 連結
    - 接收位置後顯示搜尋半徑選項（Inline Keyboard：500m, 1km, 2km）
    - 呼叫 ParkingService.searchNearby
    - 格式化並顯示結果（分頁顯示，每頁 10 筆）
    - 提供「載入更多」按鈕
    - 處理錯誤情境（API 失敗、無結果、無效位置）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.7, 8.4, 8.5_
  
  - [ ]* 15.2 撰寫停車位查詢的整合測試
    - 測試完整的停車位搜尋流程（從指令到結果顯示）
    - 測試分頁功能
    - 測試不同搜尋半徑
    - _Requirements: 1.1-1.6, 7.7_

- [x] 16. 實作車流查詢指令
  - [x] 16.1 實作 /traffic 指令處理（src/handlers/traffic-handler.ts）
    - 檢查使用者是否已完成配置
    - 提示使用者提供 Google Maps 路線 URL
    - 解析路線 URL（起點和終點）
    - 呼叫 TrafficService.queryRouteTraffic 和 queryTrafficEvents
    - 格式化並顯示結果（車流狀況、預估時間、交通事故）
    - 處理錯誤情境（URL 解析失敗、無車流資料）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.6_
  
  - [ ]* 16.2 撰寫車流查詢的整合測試
    - 測試完整的車流查詢流程
    - 測試無車流資料情境
    - 測試路線解析失敗處理
    - _Requirements: 3.1-3.7_

- [x] 17. 實作經常性路線管理指令
  - [x] 17.1 實作 /routes 指令處理（src/handlers/routes-handler.ts）
    - 檢查使用者是否已完成配置
    - 顯示路線管理選單（Inline Keyboard：新增路線、查看路線、刪除路線、編輯路線）
    - 實作新增路線流程（輸入名稱、起點、終點、通知偏好）
    - 實作查看路線功能（列出所有路線及詳細資訊）
    - 實作刪除路線功能（選擇路線並確認刪除）
    - 實作編輯路線名稱功能
    - 顯示路線設定成功確認訊息
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.7_
  
  - [ ]* 17.2 撰寫經常性路線管理的整合測試
    - 測試完整的路線新增流程
    - 測試路線列表顯示
    - 測試路線刪除流程
    - 測試路線編輯流程
    - _Requirements: 4.1-4.6_

- [ ] 18. Checkpoint - 確保所有指令功能正常
  - 執行所有整合測試
  - 手動測試每個指令的完整流程
  - 確認錯誤處理和使用者提示正確
  - 如有問題請詢問使用者

- [x] 19. 實作定時監控任務
  - [x] 19.1 建立監控任務入口（src/jobs/monitoring-job.ts）
    - 實作主要監控邏輯（呼叫 NotificationService.runMonitoringTask）
    - 實作錯誤處理和日誌記錄
    - _Requirements: 5.1, 9.3_
  
  - [x] 19.2 建立 Supabase Edge Function 定時觸發器
    - 建立 supabase/functions/monitoring/index.ts
    - 設定 pg_cron 排程（每 15 分鐘執行一次）
    - 實作 Webhook 處理邏輯
    - _Requirements: 9.5_
  
  - [ ]* 19.3 撰寫監控任務的整合測試
    - 測試監控任務執行流程
    - 測試通知發送邏輯
    - 測試通知去重機制
    - _Requirements: 5.1-5.7, 9.3, 9.6_

- [x] 20. 實作部署腳本和文件
  - [x] 20.1 建立 Supabase 部署指南（docs/deploy-supabase.md）
    - 說明如何建立 Supabase 專案
    - 說明如何執行資料庫 migration
    - 說明如何部署 Edge Functions
    - 說明如何設定 pg_cron
    - 提供完整的部署步驟
    - _Requirements: 13.8, 13.9_
  
  - [x] 20.2 建立 TDX API 申請指南（docs/tdx-api-guide.md）
    - 說明如何註冊 TDX 帳號
    - 說明如何申請 API 金鑰
    - 提供 API 文件連結
    - _Requirements: 13.2_
  
  - [x] 20.3 建立使用者手冊（docs/user-guide.md）
    - 說明所有可用指令
    - 提供使用範例和截圖
    - 說明常見問題和解決方法
    - _Requirements: 8.2_
  
  - [x] 20.4 建立 README.md
    - 專案簡介和功能說明
    - 快速開始指南
    - 部署選項說明
    - 連結到詳細文件
    - _Requirements: 13.8_

- [ ] 21. 整合和端到端測試
  - [ ] 21.1 建立端到端測試環境
    - 設定測試用 Telegram Bot
    - 設定測試用 TDX API 金鑰
    - 設定測試用 Backend（Supabase）
    - _Requirements: 所有需求的整合測試基礎_
  
  - [ ]* 21.2 撰寫端到端測試套件
    - 測試完整的停車位搜尋流程（從 /parking 到結果顯示）
    - 測試完整的車流查詢流程（從 /traffic 到結果顯示）
    - 測試完整的路線管理流程（新增、查看、編輯、刪除）
    - 測試完整的配置流程（從 /setup 到配置完成）
    - 測試監控任務和通知發送流程
    - _Requirements: 所有需求的端到端驗證_
  
  - [ ] 21.3 執行效能和負載測試
    - 測試 API 快取效能
    - 測試並發請求處理
    - 測試資料庫查詢效能
    - 確認符合免費方案限制
    - _Requirements: 11.2, 11.3_
  
  - [ ]* 21.4 執行安全性測試
    - 測試 API 金鑰加密儲存
    - 測試多使用者資料隔離
    - 測試輸入驗證和防注入
    - 測試權限控制
    - _Requirements: 10.6, 13.16, 13.17_

- [ ] 22. 最終檢查和優化
  - [ ] 22.1 程式碼審查和重構
    - 檢查程式碼品質和一致性
    - 移除未使用的程式碼
    - 優化效能瓶頸
    - 確保符合 TypeScript 最佳實踐
  
  - [ ] 22.2 文件完整性檢查
    - 確認所有 API 都有 JSDoc 註解
    - 確認所有部署指南完整且可執行
    - 確認使用者手冊涵蓋所有功能
    - 更新 README.md
  
  - [ ] 22.3 測試覆蓋率檢查
    - 執行測試覆蓋率報告
    - 確認核心業務邏輯覆蓋率 ≥ 90%
    - 確認整體覆蓋率 ≥ 80%
    - 補充缺失的測試
  
  - [ ] 22.4 部署驗證
    - 在 Supabase 環境部署並測試
    - 確認 Webhook 正常運作
    - 確認定時任務正常執行
    - _Requirements: 9.5_

- [ ] 23. 最終 Checkpoint - 專案完成確認
  - 確認所有功能正常運作
  - 確認所有測試通過
  - 確認文件完整
  - 確認部署成功
  - 如有問題請詢問使用者

## Notes

- 標記 `*` 的任務為可選測試任務，可跳過以加快 MVP 開發
- 每個任務都標註了對應的需求編號，確保可追溯性
- Checkpoint 任務確保在關鍵階段進行驗證
- 屬性測試驗證通用正確性，單元測試驗證特定範例和邊界條件
- 所有 API 金鑰和敏感資訊應使用環境變數，不可寫入程式碼

## Implementation Order Recommendation

建議實作順序：
1. 任務 1-9：建立核心基礎設施和服務（約 40% 工作量）
2. 任務 10-14：實作路線管理和配置功能（約 20% 工作量）
3. 任務 15-17：實作使用者指令和互動（約 20% 工作量）
4. 任務 18-20：實作監控任務和部署（約 10% 工作量）
5. 任務 21-23：整合測試和最終優化（約 10% 工作量）

## Testing Strategy Summary

- **屬性測試**：使用 fast-check，每個測試執行 100 次迭代
- **單元測試**：使用 Jest，測試特定範例和邊界條件
- **整合測試**：測試元件之間的互動
- **端到端測試**：測試完整的使用者流程
- **測試標籤格式**：`Feature: telegram-parking-bot, Property {number}: {property_text}`

## Deployment Options

### Supabase
- 優點：PostgreSQL 資料庫、Edge Functions、更大的免費額度
- 限制：需要設定 pg_cron、資料庫大小限制（500MB）
- 適合：多使用者、需要複雜查詢的場景
