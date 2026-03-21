# AI Team Builder v1 系統規格草案

## 1. 產品定位

這個產品的核心價值不是單純「幫使用者寫一份文件」，而是提供一種「像在跟一個 AI 團隊開會」的互動體驗。產品計畫書是重要產出，但定位上屬於輔助結果，不是唯一主角。

## 2. 產品目標

v1 要完成的事情有三個：

- 讓使用者輸入專案需求後，AI 能分析需求並組出一組合理團隊
- 讓使用者可以調整這些 AI 成員的設定，並在對話中與他們討論
- 讓系統在討論結束後，依據專案階段與討論內容產出對應的產品計畫書

## 3. AI 互動模式

建議 v1 採用「單一模型為主、模擬多角色協作」的架構，而不是一開始就做真正多代理系統。

原因：

- 你要賣的是「會議感」，不是 agent engineering 本身
- v1 先確保角色感、發言邏輯、流程完整，比較重要
- 未來若要升級成真多代理，可沿用目前的角色資料結構

也就是說，系統層可以維持多成員概念，但底層先由單一 orchestrator 加上角色 prompt/context 去模擬多角色回應。

## 4. 成員生成原則

團隊成員採混合式生成：

- 先從固定職能池挑選：UX、PM、UI、Engineer、Researcher
- 若使用者需求出現特定情境，再由 AI 補出特殊角色

例如：

- AI Workflow Designer
- Growth Strategist
- Service Designer
- Data Analyst

這樣可以兼顧穩定性與彈性。

## 5. 使用者可調整的內容

使用者修改的不是單純顯示資料，而是會真正影響 agent 行為的角色設定。這些欄位包含：

- 背景 `background`
- 任務 `tasks`
- 知識 `knowledge`
- 工作流 `workflow`
- 輸出格式 `response_format`
- 語氣 `tone`

這些欄位需要進入 agent context，後續 AI 發言與計畫書輸出都應受到影響。

## 6. 對話目的

對話不是客服問答，而是協作式探索。目標是讓使用者逐步釐清：

- 產品需求
- 使用者問題
- 功能優先序
- 設計方向
- 技術或商業限制

使用者可以在任意時間點按下結束，系統先做簡短摘要，再直接生成產品計畫書。

## 7. 計畫書定義

這份計畫書屬於「依專案階段切換模板的混合版」。

也就是說，計畫書不是單一固定格式，而是依使用者一開始輸入的專案階段，生成不同重點的文件，例如：

- 概念探索期：偏問題定義、用戶洞察、方向假設
- MVP 規劃期：偏功能範圍、優先級、流程、風險
- 設計細化期：偏體驗設計原則、流程拆解、介面策略
- 執行規劃期：偏 roadmap、分工、交付節點

本質上是「同一產品計畫書框架下的階段化變體」。

## 8. 人類 / AI / 系統責任矩陣

| 階段 | 人類 | AI | 系統 |
|---|---|---|---|
| 1. 輸入需求 | 輸入初始專案需求、目標、階段 | 無 | 建立 project、保存原始 prompt |
| 2. 需求分析 | 確認分析是否合理 | 將原始需求結構化，補出問題定義、目標、限制、未知點 | 呼叫分析流程、保存分析結果 |
| 3. 團隊生成 | 決定接受哪些成員 | 推薦固定角色組合，必要時生成特殊角色 | 建立 members 資料、顯示團隊地圖 |
| 4. 成員調整 | 編修角色設定與人格傾向 | 根據更新後設定重建 agent context | 保存成員版本、同步 UI 與對話上下文 |
| 5. 協作對話 | 補充背景、限制、tag 指定角色、確認決策 | 根據角色設定發言、提問、衝突、建議、整理 | 控制誰能發言、保存聊天、管理狀態 |
| 6. 討論結束 | 決定何時結束並生成計畫書 | 摘要對話、整理重點、生成文件 | 組合來源資料、保存 report、切換結果頁 |
| 7. 產出確認 | 閱讀、採納、必要時回頭補充 | 依階段輸出對應計畫書 | 保存版本、支援再次生成 |

更簡單地說：

- 人類負責方向與判斷
- AI 負責分析、建議、模擬專業觀點、整理與生成
- 系統負責資料、流程、上下文與發言控制

## 9. v1 系統流程

建議 v1 流程如下：

1. 使用者在首頁輸入：
   - 專案需求
   - 專案目標
   - 專案目前階段
2. 系統建立 `Project`
   - 保存原始輸入
   - 進入 loading
3. AI 執行需求分析
   - 產出結構化 brief
   - 推薦角色組合
   - 必要時增加特殊角色
4. 系統建立 `Analysis Result` 與 `Team Members`
   - 顯示團隊地圖
   - 顯示每位成員卡片
5. 使用者調整成員設定
   - 修改背景、任務、知識、工作流、輸出格式、語氣
   - 系統保存成員設定版本
6. 系統將成員設定轉成 agent context
   - 讓這些設定真正影響後續回應
7. 使用者進入聊天
   - 可自由發問
   - 可 tag 指定成員發言
   - AI 依角色與上下文回應
8. 使用者隨時可結束討論
   - 系統先做簡要摘要
   - 再依專案階段生成對應計畫書
9. 系統保存 `Report`
   - 顯示最終產品計畫書
   - 支援之後再次生成版本

## 10. v1 建議 AI 功能模組

v1 不用先做太複雜，但至少要拆這四個功能：

### 10.1 Requirement Analyzer

用途：把使用者輸入轉成 structured brief。

輸出建議：

- `project_summary`
- `project_stage`
- `target_users`
- `goals`
- `constraints`
- `open_questions`
- `suggested_roles`

### 10.2 Team Composer

用途：根據 brief 生團隊。

輸出建議：

- `selected_roles`
- `optional_roles`
- `custom_roles`
- 每位成員的初始設定

### 10.3 Conversation Orchestrator

用途：在聊天時決定誰回、怎麼回、要不要追問。

規則建議：

- 若使用者 tag 成員，優先該成員回答
- 若未 tag，由系統挑最相關 1 到 2 位回答
- 必要時增加一段系統摘要或主持人整理

### 10.4 Report Generator

用途：在結束對話後生成產品計畫書。

輸入來源：

- 原始需求
- 專案階段
- 結構化分析
- 最終成員設定
- 對話摘要
- 關鍵決策點

## 11. v1 是否要做 AI Skill

要。即使底層是同一個模型，也建議至少拆成四種 skill 或 prompt 模板：

- 需求分析 skill
- 團隊生成 skill
- 成員發言 skill
- 計畫書生成 skill

如果不拆，後面會很難維護，也不容易控制輸出品質。

## 12. v1 資料架構草案

以下是建議的核心資料模型。

### 12.1 Projects

主表，存專案全域資訊。

建議欄位：

- `id`
- `user_id`
- `title`
- `original_prompt`
- `project_goal`
- `project_stage`
- `status`
- `current_step`
- `analysis_summary`
- `active_chat_session_id`
- `latest_report_id`
- `created_at`
- `updated_at`

### 12.2 AnalysisResults

存需求分析結果。

建議欄位：

- `id`
- `project_id`
- `problem_statement`
- `target_users`
- `goals`
- `constraints`
- `open_questions`
- `suggested_roles`
- `raw_output`
- `created_at`

### 12.3 TeamMembers

存每個 project 底下的 AI 成員。

建議欄位：

- `id`
- `project_id`
- `name`
- `role_type`
- `is_custom_role`
- `background`
- `tasks`
- `knowledge`
- `workflow`
- `response_format`
- `tone`
- `agent_prompt`
- `is_active`
- `display_order`
- `created_at`
- `updated_at`

`role_type` 可先支援：

- `ux`
- `pm`
- `ui`
- `engineer`
- `researcher`
- `custom`

### 12.4 ChatSessions

存一次討論會話。

建議欄位：

- `id`
- `project_id`
- `status`
- `started_at`
- `ended_at`
- `summary`
- `created_at`

### 12.5 ChatMessages

存對話訊息。

建議欄位：

- `id`
- `session_id`
- `speaker_type`
- `speaker_id`
- `speaker_name`
- `content`
- `tagged_member_ids`
- `message_order`
- `created_at`

`speaker_type`：

- `user`
- `ai_member`
- `system`

### 12.6 Reports

存產品計畫書。

建議欄位：

- `id`
- `project_id`
- `session_id`
- `report_type`
- `project_stage`
- `title`
- `summary`
- `content`
- `version`
- `created_at`

## 13. v1 Database 選型建議

如果目前是為了先驗證流程，Notion 可以先用來存：

- Projects
- TeamMembers
- Reports

但如果聊天訊息會很多，不建議長期把 `ChatMessages` 放在 Notion。v1 可以暫時存，之後很可能要換到正式 DB，例如 PostgreSQL / Supabase。

原因：

- chat 是高頻寫入
- 訊息序列、查詢、摘要都比較依賴結構化資料
- 多輪上下文組裝會比 Notion 更適合正式資料庫

## 14. v1 最重要的落地原則

v1 建議守住這三件事：

- 先把「會議感」做出來，而不是追求最複雜的 agent 架構
- 所有使用者可改的成員設定，都必須真正影響回應
- 計畫書生成要依專案階段切換模板，而不是一份通用文件打到底
