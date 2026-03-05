# Requirements Document

## Introduction

本專案旨在建立一個 Telegram Bot，整合台灣交通部 TDX API (tdx.transportdata.tw)，提供即時停車位查詢、車流資訊查詢及主動推播通知功能。使用者可透過 Telegram 介面快速查詢附近停車位、目的地周邊停車資訊、路線車流狀況，並設定常用路線以接收異常通知。

## Glossary

- **Bot**: Telegram 機器人系統
- **TDX_API**: 台灣交通部運輸資料流通服務平台 API (tdx.transportdata.tw)
- **User**: 使用 Telegram Bot 的使用者
- **Location**: 地理座標（經緯度）
- **Parking_Facility**: 停車場或路邊停車位
- **Search_Radius**: 搜尋半徑（500m、1km、2km）
- **Route**: 導航路線
- **Traffic_Event**: 車流異常或重大事故事件
- **Routine_Route**: 使用者設定的經常性路線
- **Notification_Service**: 主動推播通知服務
- **Maps_API**: Google Maps API 或 Telegram Location API
- **Backend_Service**: 後端處理服務（Supabase）

## Requirements

### Requirement 1: 基於當前位置的停車位搜尋

**User Story:** 作為使用者，我想要根據我的當前位置搜尋附近的停車位，以便快速找到可用的停車空間。

#### Acceptance Criteria

1. WHEN User 分享當前位置，THE Bot SHALL 接收並解析 Location 座標
2. WHEN User 選擇 Search_Radius（500m、1km、2km），THE Bot SHALL 使用選定的半徑進行搜尋
3. WHEN 搜尋請求發送，THE Bot SHALL 呼叫 TDX_API 查詢範圍內的 Parking_Facility
4. THE Bot SHALL 回傳停車場和路邊停車的資訊
5. WHEN TDX_API 回傳結果，THE Bot SHALL 顯示每個 Parking_Facility 的名稱、距離、可用車位數及收費資訊
6. IF TDX_API 無法回應，THEN THE Bot SHALL 顯示錯誤訊息並建議稍後重試

### Requirement 2: 基於目的地的停車位搜尋

**User Story:** 作為使用者，我想要根據我的導航目的地搜尋附近的停車位，以便提前規劃停車地點。

#### Acceptance Criteria

1. WHEN User 提供目的地 Location（透過 Telegram Location 或 Google Maps 連結），THE Bot SHALL 解析目的地座標
2. WHEN User 選擇 Search_Radius（500m、1km、2km），THE Bot SHALL 使用選定的半徑進行搜尋
3. THE Bot SHALL 呼叫 TDX_API 查詢目的地範圍內的 Parking_Facility
4. THE Bot SHALL 回傳停車場和路邊停車的資訊
5. WHEN 結果顯示時，THE Bot SHALL 提供每個 Parking_Facility 到目的地的距離
6. WHERE User 提供 Google Maps 連結，THE Bot SHALL 使用 Maps_API 解析目的地座標
7. IF 目的地座標無法解析，THEN THE Bot SHALL 提示 User 重新提供有效的位置資訊

### Requirement 3: 路線車流查詢

**User Story:** 作為使用者，我想要查詢特定路線的車流狀況，以便決定最佳出發時間或替代路線。

#### Acceptance Criteria

1. WHEN User 提供 Google Maps 路線規劃 URL，THE Bot SHALL 解析路線資訊
2. THE Bot SHALL 呼叫 TDX_API 查詢路線沿途的車流資訊
3. THE Bot SHALL 顯示路線的整體車流狀況（順暢、壅塞、嚴重壅塞）
4. WHEN 路線上存在 Traffic_Event，THE Bot SHALL 顯示事故位置、類型及預估影響時間
5. THE Bot SHALL 提供路線預估行駛時間
6. IF 路線解析失敗，THEN THE Bot SHALL 提示 User 提供有效的 Google Maps 路線 URL
7. IF TDX_API 無車流資料，THEN THE Bot SHALL 通知 User 該路線暫無即時資訊

### Requirement 4: 經常性路線設定

**User Story:** 作為使用者，我想要設定我的經常性路線，以便在發生異常時收到主動通知。

#### Acceptance Criteria

1. THE Bot SHALL 提供新增 Routine_Route 的功能
2. WHEN User 新增 Routine_Route，THE Bot SHALL 儲存路線的起點、終點及名稱
3. THE Bot SHALL 允許 User 查看已設定的所有 Routine_Route
4. THE Bot SHALL 允許 User 刪除特定的 Routine_Route
5. THE Bot SHALL 允許 User 編輯 Routine_Route 的名稱
6. WHEN User 設定 Routine_Route，THE Bot SHALL 確認設定成功並顯示路線摘要
7. THE Backend_Service SHALL 持久化儲存 User 的 Routine_Route 設定

### Requirement 5: 主動推播通知

**User Story:** 作為使用者，我想要在我的經常性路線發生車流異常或重大事故時收到通知，以便及時調整行程。

#### Acceptance Criteria

1. THE Notification_Service SHALL 定期監控所有 User 的 Routine_Route
2. WHEN Routine_Route 上發生 Traffic_Event，THE Notification_Service SHALL 判定是否為異常事件
3. WHEN 車流狀況從順暢轉為壅塞或嚴重壅塞，THE Notification_Service SHALL 觸發通知
4. WHEN 重大事故發生在 Routine_Route 上，THE Notification_Service SHALL 立即發送通知
5. THE Bot SHALL 發送包含事件類型、位置、預估影響時間的通知訊息
6. THE Notification_Service SHALL 避免在短時間內重複發送相同事件的通知
7. WHERE User 設定通知時段偏好，THE Notification_Service SHALL 僅在指定時段發送通知

### Requirement 6: TDX API 整合

**User Story:** 作為系統，我需要整合 TDX API，以便取得即時的停車位及車流資訊。

#### Acceptance Criteria

1. THE Bot SHALL 使用有效的 TDX_API 認證金鑰進行 API 呼叫
2. WHEN 呼叫 TDX_API，THE Bot SHALL 處理 API 回應並解析 JSON 資料
3. THE Bot SHALL 實作停車位查詢 API 端點的呼叫
4. THE Bot SHALL 實作車流資訊查詢 API 端點的呼叫
5. THE Bot SHALL 實作交通事故查詢 API 端點的呼叫
6. IF TDX_API 回傳錯誤狀態碼，THEN THE Bot SHALL 記錄錯誤並回傳使用者友善的錯誤訊息
7. THE Bot SHALL 在 API 呼叫逾時 10 秒後中止請求並通知 User

### Requirement 7: 資料格式化與顯示

**User Story:** 作為使用者，我想要看到清晰易讀的查詢結果，以便快速理解資訊。

#### Acceptance Criteria

1. WHEN 顯示 Parking_Facility 資訊，THE Bot SHALL 格式化為結構化訊息
2. THE Bot SHALL 顯示停車場名稱、地址、總車位數、剩餘車位數、收費方式
3. THE Bot SHALL 按距離由近到遠排序 Parking_Facility 結果
4. WHEN 顯示車流資訊，THE Bot SHALL 使用視覺化符號（如 🟢🟡🔴）表示車流狀況
5. THE Bot SHALL 提供 Parking_Facility 的 Google Maps 導航連結
6. WHERE 資料不完整，THE Bot SHALL 標示為「資訊未提供」而非顯示空白
7. WHEN 查詢結果超過 10 筆，THE Bot SHALL 分頁顯示並提供「載入更多」選項

### Requirement 8: 使用者介面與互動

**User Story:** 作為使用者，我想要有直覺的操作介面，以便輕鬆使用各項功能。

#### Acceptance Criteria

1. THE Bot SHALL 提供 /start 指令顯示歡迎訊息及功能選單
2. THE Bot SHALL 提供 /help 指令顯示所有可用指令說明
3. THE Bot SHALL 使用 Telegram Inline Keyboard 提供互動式選單
4. WHEN User 選擇搜尋功能，THE Bot SHALL 提供 Search_Radius 選項按鈕
5. THE Bot SHALL 提供 /parking 指令啟動停車位搜尋流程
6. THE Bot SHALL 提供 /traffic 指令啟動車流查詢流程
7. THE Bot SHALL 提供 /routes 指令管理 Routine_Route
8. WHEN User 輸入無效指令，THE Bot SHALL 提示正確的指令格式

### Requirement 9: 後端服務與資料持久化

**User Story:** 作為系統，我需要後端服務來處理定時任務和資料儲存，以便支援主動通知功能。

#### Acceptance Criteria

1. THE Backend_Service SHALL 儲存 User 的 Routine_Route 設定
2. THE Backend_Service SHALL 儲存 User 的通知偏好設定
3. THE Backend_Service SHALL 每 15 分鐘執行一次 Routine_Route 監控任務
4. THE Backend_Service SHALL 使用 PostgreSQL 儲存資料並透過 Edge Functions 執行定時任務
5. THE Backend_Service SHALL 記錄已發送的通知以避免重複推播
6. IF Backend_Service 執行失敗，THEN THE Backend_Service SHALL 記錄錯誤日誌並在下次執行時重試

### Requirement 10: 錯誤處理與可靠性

**User Story:** 作為使用者，我希望系統能穩定運作並妥善處理錯誤，以便獲得可靠的服務。

#### Acceptance Criteria

1. IF TDX_API 無法連線，THEN THE Bot SHALL 顯示「服務暫時無法使用，請稍後再試」
2. IF User 提供的 Location 格式錯誤，THEN THE Bot SHALL 提示正確的輸入方式
3. WHEN 系統發生未預期錯誤，THE Bot SHALL 記錄錯誤詳情並回傳通用錯誤訊息
4. THE Bot SHALL 在 API 請求失敗時自動重試最多 3 次
5. IF Backend_Service 無法儲存資料，THEN THE Bot SHALL 通知 User 操作失敗並建議重試
6. THE Bot SHALL 驗證所有 User 輸入以防止注入攻擊
7. THE Bot SHALL 在處理請求超過 5 秒時顯示「處理中」的狀態訊息

### Requirement 11: 成本控制與免維運

**User Story:** 作為專案維護者，我希望系統能在免費額度內運作，以便維持零維運成本。

#### Acceptance Criteria

1. THE Backend_Service SHALL 確保資料庫大小在免費方案限制內（500MB）
2. THE Bot SHALL 快取 TDX_API 回應最多 5 分鐘以減少 API 呼叫次數
3. THE Notification_Service SHALL 限制每個 User 最多設定 5 條 Routine_Route
4. THE Backend_Service SHALL 自動清理 30 天前的歷史通知記錄
5. THE Bot SHALL 監控 API 使用量並在接近限制時發出警告
6. THE Bot SHALL 使用 Webhook 而非 Polling 以減少資源消耗

### Requirement 12: 資料解析與轉換

**User Story:** 作為系統，我需要正確解析各種輸入格式，以便提供準確的查詢結果。

#### Acceptance Criteria

1. WHEN User 提供 Google Maps URL，THE Bot SHALL 解析 URL 並提取座標或地點資訊
2. THE Bot SHALL 支援 Google Maps 分享連結格式（maps.app.goo.gl、google.com/maps）
3. THE Bot SHALL 支援 Telegram 原生 Location 訊息格式
4. WHEN 解析 Google Maps 路線 URL，THE Bot SHALL 提取起點和終點座標
5. THE Bot SHALL 將地址轉換為座標（使用 Maps_API 或 TDX_API）
6. THE Bot SHALL 驗證座標範圍在台灣境內（經度 119-122°E，緯度 21-26°N）
7. IF 輸入格式無法識別，THEN THE Bot SHALL 提示 User 支援的輸入格式範例

### Requirement 13: 使用者自行配置與快速部署

**User Story:** 作為新使用者，我想要能夠自行配置 TDX API Key 並快速部署自己的 Backend，以便獨立使用這個 Bot 而不依賴他人的服務。

#### Acceptance Criteria

1. WHEN User 首次啟動 Bot，THE Bot SHALL 檢查 User 是否已完成初始配置
2. IF User 未配置 TDX_API 金鑰，THEN THE Bot SHALL 提供 TDX API 申請指引連結及設定說明
3. THE Bot SHALL 提供 /setup 指令啟動配置流程
4. WHEN User 執行 /setup 指令，THE Bot SHALL 引導 User 輸入 TDX_API 金鑰
5. WHEN User 提供 TDX_API 金鑰，THE Bot SHALL 驗證金鑰有效性（透過測試 API 呼叫）
6. IF TDX_API 金鑰驗證失敗，THEN THE Bot SHALL 提示 User 重新輸入並說明可能的錯誤原因
7. WHEN TDX_API 金鑰驗證成功，THE Backend_Service SHALL 儲存 User 的 API 金鑰
8. THE Bot SHALL 提供 Supabase Backend 部署指南
9. THE Bot SHALL 提供 Supabase Backend 部署步驟文件連結
10. THE Bot SHALL 引導 User 設定 Backend_Service 的連線資訊（資料庫連線字串）
11. WHEN User 提供 Backend 連線資訊，THE Bot SHALL 驗證連線可用性
12. IF Backend 連線驗證失敗，THEN THE Bot SHALL 提供除錯建議並允許 User 重新設定
13. WHEN 所有配置完成，THE Bot SHALL 顯示配置摘要並確認 Bot 已就緒
14. THE Bot SHALL 提供 /config 指令讓 User 查看當前配置狀態
15. THE Bot SHALL 提供 /reset 指令讓 User 重新配置所有設定
16. THE Bot SHALL 加密儲存 User 的 TDX_API 金鑰和 Backend 連線資訊
17. WHERE User 使用共享 Backend，THE Backend_Service SHALL 隔離不同 User 的資料和 API 金鑰

