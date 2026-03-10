# Requirements Document

## Introduction

本專案旨在為現有的 Telegram 停車查詢機器人新增即時交通狀況查詢功能。使用者可透過 `/traffic` 指令查詢附近的交通狀況，包括壅塞、車禍、施工等資訊。此功能將複用現有的 `/parking` 指令的 UX 流程，確保使用者體驗的一致性。

## Glossary

- **Bot**: Telegram 機器人系統
- **TDX_API**: 台灣交通部運輸資料流通服務平台 API (tdx.transportdata.tw)
- **User**: 使用 Telegram Bot 的使用者
- **Location**: 地理座標（經緯度）
- **Search_Radius**: 搜尋半徑（250m、500m、1km）
- **Traffic_Condition**: 道路交通狀況（順暢、壅塞、嚴重壅塞）
- **Traffic_Event**: 交通事件（車禍、施工、道路封閉、交通管制）
- **Road_Condition_API**: TDX API 端點 `/Road/Condition/City/{CityName}`
- **Traffic_Event_API**: TDX API 端點 `/Traffic/Event/City/{CityName}`
- **Cache_Service**: 快取服務，用於減少 API 呼叫次數
- **Distance_Filter**: 本地端距離篩選器，用於過濾範圍內的交通資訊
- **City_Resolver**: 城市解析器，根據座標判斷所屬城市

## Requirements

### Requirement 1: 交通狀況查詢指令

**User Story:** 作為使用者，我想要使用 `/traffic` 指令查詢附近的交通狀況，以便了解周邊道路的壅塞、車禍、施工等資訊。

#### Acceptance Criteria

1. WHEN User 執行 `/traffic` 指令，THE Bot SHALL 顯示 Inline Keyboard 提供 Search_Radius 選項（250m、500m、1km）
2. WHEN User 選擇 Search_Radius，THE Bot SHALL 顯示「分享位置」按鈕要求 User 提供 Location
3. WHEN User 分享 Location，THE Bot SHALL 接收並解析座標
4. THE Bot SHALL 使用 City_Resolver 根據座標判斷所屬城市
5. THE Bot SHALL 呼叫 Road_Condition_API 和 Traffic_Event_API 查詢該城市的交通資訊
6. THE Bot SHALL 使用 Distance_Filter 篩選 Search_Radius 範圍內的交通資訊
7. THE Bot SHALL 顯示篩選後的 Traffic_Condition 和 Traffic_Event 資訊
8. IF 範圍內無交通資訊，THEN THE Bot SHALL 顯示「附近暫無交通狀況資訊」

### Requirement 2: 交通資訊分類與顯示

**User Story:** 作為使用者，我想要看到清晰分類的交通資訊，以便快速了解不同類型的交通狀況。

#### Acceptance Criteria

1. THE Bot SHALL 將交通資訊分為四類：壅塞、車禍、施工、其他事件
2. WHEN 顯示壅塞資訊，THE Bot SHALL 包含道路名稱、距離、壅塞程度、開始時間
3. WHEN 顯示車禍資訊，THE Bot SHALL 包含位置、距離、影響車道、發生時間
4. WHEN 顯示施工資訊，THE Bot SHALL 包含位置、距離、施工內容、預計結束時間
5. THE Bot SHALL 使用視覺化符號標示交通狀況（🟢順暢、🟡壅塞、🔴嚴重壅塞、⚠️車禍、🚧施工）
6. THE Bot SHALL 按距離由近到遠排序交通資訊
7. WHEN 交通資訊超過 10 筆，THE Bot SHALL 只顯示最近的 10 筆並註明「僅顯示最近的結果」

### Requirement 3: TDX 交通 API 整合

**User Story:** 作為系統，我需要整合 TDX 交通相關 API，以便取得即時的道路狀況和交通事件資訊。

#### Acceptance Criteria

1. THE Bot SHALL 呼叫 Road_Condition_API 取得道路壅塞和施工資訊
2. THE Bot SHALL 呼叫 Traffic_Event_API 取得交通事件資訊
3. WHEN 呼叫 TDX_API，THE Bot SHALL 使用有效的認證金鑰
4. THE Bot SHALL 解析 API 回應的 JSON 資料並提取必要欄位
5. IF TDX_API 回傳 429 錯誤，THEN THE Bot SHALL 使用 Cache_Service 的快取資料
6. IF TDX_API 回傳其他錯誤狀態碼，THEN THE Bot SHALL 記錄錯誤並顯示「交通資訊服務暫時無法使用」
7. THE Bot SHALL 在 API 呼叫逾時 10 秒後中止請求並使用快取資料或顯示錯誤訊息

### Requirement 4: 快取機制

**User Story:** 作為系統，我需要實作快取機制，以便減少 API 呼叫次數並避免觸發 TDX API 的限流。

#### Acceptance Criteria

1. THE Cache_Service SHALL 快取每個城市的 Road_Condition_API 回應資料
2. THE Cache_Service SHALL 快取每個城市的 Traffic_Event_API 回應資料
3. THE Cache_Service SHALL 設定快取有效期限為 5 分鐘
4. WHEN 快取資料有效，THE Bot SHALL 直接使用快取資料而不呼叫 API
5. WHEN 快取資料過期，THE Bot SHALL 重新呼叫 API 並更新快取
6. THE Cache_Service SHALL 在記憶體中儲存快取資料
7. WHEN 顯示快取資料，THE Bot SHALL 註明資料更新時間

### Requirement 5: 距離計算與篩選

**User Story:** 作為系統，我需要計算交通事件與使用者位置的距離，以便篩選範圍內的資訊。

#### Acceptance Criteria

1. THE Distance_Filter SHALL 使用 Haversine 公式計算兩點間的距離
2. WHEN Traffic_Event 包含座標，THE Distance_Filter SHALL 計算與 User Location 的距離
3. WHEN Traffic_Event 不包含座標但包含道路名稱，THE Distance_Filter SHALL 嘗試使用道路名稱估算距離
4. THE Distance_Filter SHALL 只保留距離小於或等於 Search_Radius 的交通資訊
5. THE Distance_Filter SHALL 將距離轉換為公尺或公里顯示（小於 1000m 顯示公尺，否則顯示公里）
6. IF Traffic_Event 無法判斷距離，THEN THE Distance_Filter SHALL 排除該事件
7. THE Distance_Filter SHALL 在篩選後按距離排序結果

### Requirement 6: 城市判斷

**User Story:** 作為系統，我需要根據使用者的座標判斷所屬城市，以便呼叫正確的 TDX API 端點。

#### Acceptance Criteria

1. THE City_Resolver SHALL 根據座標的經緯度範圍判斷所屬城市
2. THE City_Resolver SHALL 支援台灣主要城市（台北市、新北市、桃園市、台中市、台南市、高雄市、基隆市）
3. WHEN 座標位於台北市範圍，THE City_Resolver SHALL 回傳 "Taipei"
4. WHEN 座標位於新北市範圍，THE City_Resolver SHALL 回傳 "NewTaipei"
5. IF 座標無法對應到支援的城市，THEN THE City_Resolver SHALL 回傳最近的城市
6. THE City_Resolver SHALL 使用城市邊界的經緯度範圍進行判斷
7. THE Bot SHALL 在無法判斷城市時顯示「該地區暫不支援交通查詢」

### Requirement 7: UX 流程一致性

**User Story:** 作為使用者，我希望 `/traffic` 指令的操作流程與 `/parking` 指令一致，以便快速上手。

#### Acceptance Criteria

1. THE Bot SHALL 使用與 `/parking` 相同的 Inline Keyboard 樣式顯示 Search_Radius 選項
2. THE Bot SHALL 使用與 `/parking` 相同的「分享位置」按鈕樣式
3. THE Bot SHALL 使用與 `/parking` 相同的訊息格式顯示結果
4. THE Bot SHALL 在處理過程中顯示與 `/parking` 相同的狀態訊息（如「查詢中...」）
5. THE Bot SHALL 複用 `/parking` 的位置處理邏輯
6. THE Bot SHALL 複用 `/parking` 的錯誤處理邏輯
7. THE Bot SHALL 在 `/help` 指令中以與 `/parking` 相似的格式說明 `/traffic` 指令

### Requirement 8: 錯誤處理

**User Story:** 作為使用者，我希望系統能妥善處理錯誤情況，以便了解問題並知道如何處理。

#### Acceptance Criteria

1. IF User 提供的 Location 不在台灣境內，THEN THE Bot SHALL 顯示「請提供台灣境內的位置」
2. IF TDX_API 無法連線，THEN THE Bot SHALL 顯示「交通資訊服務暫時無法使用，請稍後再試」
3. IF Cache_Service 和 TDX_API 都無法提供資料，THEN THE Bot SHALL 顯示「無法取得交通資訊」
4. WHEN 系統發生未預期錯誤，THE Bot SHALL 記錄錯誤詳情並顯示通用錯誤訊息
5. IF API 回應資料格式異常，THEN THE Bot SHALL 記錄錯誤並嘗試解析可用的部分資料
6. THE Bot SHALL 在錯誤訊息中提供重試建議
7. THE Bot SHALL 驗證 User 輸入的 Location 格式是否正確

### Requirement 9: 資料解析與轉換

**User Story:** 作為系統，我需要正確解析 TDX API 回應的資料，以便提取必要的交通資訊。

#### Acceptance Criteria

1. THE Bot SHALL 解析 Road_Condition_API 回應並提取道路名稱、壅塞程度、座標、時間資訊
2. THE Bot SHALL 解析 Traffic_Event_API 回應並提取事件類型、位置、描述、座標、時間資訊
3. THE Bot SHALL 將 TDX API 的事件類型代碼轉換為使用者友善的中文描述
4. THE Bot SHALL 將 TDX API 的時間格式轉換為本地時間顯示
5. WHERE API 回應欄位缺失，THE Bot SHALL 使用預設值或標示為「資訊未提供」
6. THE Bot SHALL 驗證解析後的資料完整性
7. IF 資料解析失敗，THEN THE Bot SHALL 記錄原始資料並跳過該筆記錄

### Requirement 10: 部署與整合

**User Story:** 作為開發者，我需要將交通查詢功能整合到現有的 Supabase Edge Function，以便維持統一的部署架構。

#### Acceptance Criteria

1. THE Bot SHALL 在現有的 Supabase Edge Function 中新增交通查詢處理邏輯
2. THE Bot SHALL 複用現有的 TDX Client 模組進行 API 呼叫
3. THE Bot SHALL 在現有的 Webhook Handler 中新增 `/traffic` 指令路由
4. THE Cache_Service SHALL 使用 Supabase Edge Function 的記憶體儲存快取
5. THE Bot SHALL 確保交通查詢功能不影響現有的停車查詢功能
6. THE Bot SHALL 在部署後通過整合測試驗證功能正常
7. THE Bot SHALL 記錄交通查詢的使用統計資訊

### Requirement 11: 測試與驗證

**User Story:** 作為開發者，我需要驗證交通查詢功能的正確性，以便確保使用者獲得準確的資訊。

#### Acceptance Criteria

1. THE Bot SHALL 提供測試腳本驗證 Road_Condition_API 的資料格式
2. THE Bot SHALL 提供測試腳本驗證 Traffic_Event_API 的資料格式
3. THE Bot SHALL 提供測試腳本驗證距離計算的準確性
4. THE Bot SHALL 提供測試腳本驗證城市判斷的準確性
5. THE Bot SHALL 提供測試腳本驗證快取機制的運作
6. THE Bot SHALL 在測試環境中驗證完整的 UX 流程
7. THE Bot SHALL 驗證錯誤處理邏輯的正確性

### Requirement 12: 效能與限制

**User Story:** 作為系統，我需要確保交通查詢功能在效能和成本限制內運作，以便維持服務的穩定性。

#### Acceptance Criteria

1. THE Bot SHALL 在 5 秒內完成交通查詢並回應 User
2. THE Cache_Service SHALL 確保快取命中率達到 80% 以上
3. THE Bot SHALL 限制每次查詢最多顯示 10 筆交通資訊
4. THE Bot SHALL 確保記憶體使用量不超過 Supabase Edge Function 限制
5. THE Bot SHALL 在 API 呼叫失敗時使用快取資料避免服務中斷
6. THE Bot SHALL 記錄 API 呼叫次數以監控使用量
7. THE Bot SHALL 在接近 API 限制時優先使用快取資料
