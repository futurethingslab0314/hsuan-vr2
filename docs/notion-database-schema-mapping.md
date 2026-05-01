# AI Team Builder Notion and Database Schema Mapping

## 1. 目的

這份文件用來對照目前產品規格中的資料模型，並映射到現有專案已預留的 Notion database 設定。目標是幫助團隊判斷：

- 哪些資料適合存在 Notion
- 哪些欄位應落在哪個 data source
- 哪些資料未來可能更適合移到正式資料庫
- 現有環境變數是否足以支援 v1

目前程式中已預留的 Notion data source 如下：

- `NOTION_PROJECT_DB_ID`
- `NOTION_TEAMMEMBERS_DB_ID`
- `NOTION_CHATS_DB_ID`
- `NOTION_REPORTSECTIONS_DB_ID`

## 2. 建議資料模型總覽

v1 建議的邏輯資料模型如下：

- Projects
- AnalysisResults
- TeamMembers
- ChatSessions
- ChatMessages
- Reports

其中要注意，現有 Notion data source 只有 4 個，因此 v1 需決定：

- `AnalysisResults` 是否併入 `Projects`
- `ChatSessions` 與 `ChatMessages` 是否合併成單一 `Chats`
- `Reports` 是否拆成報告主表與 section 表，或僅存 section 表

## 3. 對照建議

### 3.1 Projects 對照 `NOTION_PROJECT_DB_ID`

**建議保留在 Notion**

這是目前最適合先放 Notion 的主表，因為它屬於低頻更新、便於人工檢視與管理的資料。

**建議欄位**

- `title`
  - 型態：Title
  - 用途：專案名稱或 fallback title
- `user_name`
  - 型態：Rich text
  - 用途：建立專案的人
- `input_prompt`
  - 型態：Rich text
  - 用途：使用者最原始的專案需求輸入
- `project_goal`
  - 型態：Rich text
  - 用途：專案目標
- `project_stage`
  - 型態：Select
  - 建議選項：`discover`、`define`、`develop`、`deliver`
- `status`
  - 型態：Select
  - 建議選項：`draft`、`active`、`completed`、`archived`
- `is_public`
  - 型態：Checkbox
  - 用途：是否公開
- `problem_statement`
  - 型態：Rich text
  - 用途：Requirement Analyzer 產出的核心問題定義
- `project_summary`
  - 型態：Rich text
  - 用途：Requirement Analyzer 產出的整體摘要
- `target_users`
  - 型態：Rich text 或 Multi-select
  - 用途：目標使用者
- `core_goals`
  - 型態：Rich text
  - 用途：核心目標
- `constraints`
  - 型態：Rich text
  - 用途：已知限制
- `open_questions`
  - 型態：Rich text
  - 用途：待釐清問題
- `analysis_confidence`
  - 型態：Number
  - 用途：分析信心值
- `active_chat_session_id`
  - 型態：Rich text
  - 用途：目前進行中的 chat session 識別值
- `latest_report_id`
  - 型態：Rich text
  - 用途：最近一次報告識別值

**建議結論**

v1 可先把 `AnalysisResults` 併入 `Projects`，不一定要額外開第 5 個 database。

---

### 3.2 TeamMembers 對照 `NOTION_TEAMMEMBERS_DB_ID`

**建議保留在 Notion**

這張表適合放角色設定，因為使用者會編輯它，而且它屬於結構化但更新頻率相對可控的資料。

**建議欄位**

- `title`
  - 型態：Title
  - 用途：成員名稱
- `project_id`
  - 型態：Rich text 或 Relation
  - 用途：關聯到專案
- `role_type`
  - 型態：Select
  - 建議選項：`PM`、`Researcher`、`UX Designer`、`Engineer`、`custom`
- `custom_role_label`
  - 型態：Rich text
  - 用途：特殊角色名稱
- `is_custom_role`
  - 型態：Checkbox
  - 用途：是否特殊角色
- `background_years`
  - 型態：Rich text
- `background_experience`
  - 型態：Rich text
- `background_profession`
  - 型態：Rich text
- `background_expertise`
  - 型態：Rich text
- `tasks`
  - 型態：Rich text
- `knowledge`
  - 型態：Rich text
- `workflow`
  - 型態：Rich text
- `response_format`
  - 型態：Rich text
- `tone`
  - 型態：Rich text
- `why_this_role`
  - 型態：Rich text
- `routing_good_for`
  - 型態：Rich text
- `routing_avoid_for`
  - 型態：Rich text
- `routing_pairs_well_with`
  - 型態：Rich text
- `display_order`
  - 型態：Number
- `is_active`
  - 型態：Checkbox

**建議結論**

v1 在 Notion 裡可先把陣列型欄位壓成 Rich text 儲存，例如用換行或逗號分隔。若未來進入正式 DB，再轉成結構化陣列或 JSON。

---

### 3.3 Chats 對照 `NOTION_CHATS_DB_ID`

**建議：Notion 可暫用，但未來最可能要搬走**

聊天資料屬於高頻寫入、順序敏感、後續又要做摘要與上下文組裝，因此長期不建議只靠 Notion。

v1 若要先快做，可以把 `ChatSessions` 和 `ChatMessages` 合併在單一 Notion data source。

**建議欄位**

- `title`
  - 型態：Title
  - 用途：session 或 message 顯示名，例如 `Session 1 - Msg 003`
- `project_id`
  - 型態：Rich text 或 Relation
- `session_id`
  - 型態：Rich text
- `message_order`
  - 型態：Number
- `speaker_type`
  - 型態：Select
  - 建議選項：`user`、`ai_member`、`system`
- `speaker_id`
  - 型態：Rich text
- `speaker_name`
  - 型態：Rich text
- `content`
  - 型態：Rich text
- `message_type`
  - 型態：Select
  - 建議選項：`clarification`、`product_direction`、`feature_scope`、`user_flow`、`interface_design`、`technical_feasibility`、`validation`、`wrap_up`
- `discussion_stage`
  - 型態：Select
  - 建議選項：`clarifying`、`framing`、`exploring`、`aligning`、`wrapping`
- `selected_speakers`
  - 型態：Rich text
  - 用途：這輪被選中的角色摘要
- `system_summary`
  - 型態：Rich text
- `confirmed_points`
  - 型態：Rich text
- `open_questions`
  - 型態：Rich text
- `assumptions`
  - 型態：Rich text
- `next_focus`
  - 型態：Rich text
- `ready_for_report`
  - 型態：Checkbox
- `created_at`
  - 型態：Created time

**建議結論**

v1 可以先用 Notion 存聊天，但若聊天輪數或訊息量變大，優先搬到 PostgreSQL / Supabase。

---

### 3.4 Reports 對照 `NOTION_REPORTSECTIONS_DB_ID`

**建議保留在 Notion，但建議釐清表的定位**

現有環境變數叫 `reportSections`，代表目前比較接近「報告段落表」，而不是完整報告主表。

v1 有兩種做法：

**做法 A：只用 section 表**

每個 section 一列，透過 `report_id` 關聯同一份報告。

**做法 B：補一張 report 主表**

如果之後需要存多版本報告，建議新增 `Reports` 主表，再讓 `reportSections` 存段落。

若 v1 想先簡化，可先採做法 A。

**建議欄位**

- `title`
  - 型態：Title
  - 用途：section 標題
- `project_id`
  - 型態：Rich text 或 Relation
- `report_id`
  - 型態：Rich text
- `report_title`
  - 型態：Rich text
- `report_type`
  - 型態：Select
  - 建議選項：`one_page_product_strategy`
- `project_stage`
  - 型態：Select
  - 建議選項：`discover`、`define`、`develop`、`deliver`
- `section_key`
  - 型態：Select
  - 建議選項：`executive_summary`、`core_need`、`user_problem`、`product_direction`、`assumptions`、`next_steps`
- `section_order`
  - 型態：Number
- `content`
  - 型態：Rich text
- `risks`
  - 型態：Rich text
  - 用途：可只放在某個總結 section，或每份報告只存一次
- `next_steps_list`
  - 型態：Rich text
- `version`
  - 型態：Number
- `created_at`
  - 型態：Created time

**建議結論**

如果報告會有版本概念，建議未來補 `Reports` 主表；若只是 v1 驗證，`reportSections` 單表可先撐住。

## 4. 邏輯資料模型 vs 現有 Notion 對照表

| 邏輯模型 | 現有/建議 Notion data source | v1 建議 |
|---|---|---|
| Projects | `NOTION_PROJECT_DB_ID` | 直接使用 |
| AnalysisResults | 併入 `NOTION_PROJECT_DB_ID` | 先併入 Projects |
| TeamMembers | `NOTION_TEAMMEMBERS_DB_ID` | 直接使用 |
| ChatSessions | 併入 `NOTION_CHATS_DB_ID` | 先合併存放 |
| ChatMessages | `NOTION_CHATS_DB_ID` | 先合併存放 |
| Reports | 由 `NOTION_REPORTSECTIONS_DB_ID` 部分承擔 | v1 可先不拆主表 |
| ReportSections | `NOTION_REPORTSECTIONS_DB_ID` | 直接使用 |

## 5. 建議是否需要新增 data source

### v1 最簡化版本

不新增。

只使用目前已有的 4 個：

- Projects
- TeamMembers
- Chats
- ReportSections

其中：

- `AnalysisResults` 併入 Projects
- `ChatSessions` / `ChatMessages` 併入 Chats
- `Reports` / `ReportSections` 先由 ReportSections 單表承接

### v1.5 或後續版本建議新增

若之後資料量增加，建議優先新增或搬移：

1. `Reports` 主表
2. 正式 chat database（例如 PostgreSQL / Supabase）
3. 若分析結果變複雜，再考慮拆出 `AnalysisResults`

## 6. 對程式現況的影響

目前 `app/api/projects/create/route.ts` 已能寫入：

- title
- user_name
- input_prompt
- status
- is_public

若要支援完整 v1，接下來至少還需要補：

### Projects API

- `project_goal`
- `project_stage`
- `problem_statement`
- `project_summary`
- `target_users`
- `core_goals`
- `constraints`
- `open_questions`
- `analysis_confidence`

### TeamMembers API

- 建立 team members
- 更新使用者編輯後的成員設定

### Chats API

- 建立 chat session / message
- 寫入 orchestrator 輸出

### Reports API

- 建立報告 sections
- 依 `project_stage` 組出一頁式摘要

## 7. Notion 與正式資料庫的分工建議

### 適合先放 Notion 的資料

- Projects
- TeamMembers
- Reports / ReportSections

原因：

- 容易人工閱讀與編修
- 適合原型驗證
- 與目前程式預留結構相容

### 長期更適合正式資料庫的資料

- ChatSessions
- ChatMessages
- 若 orchestration state 很複雜，包含 decision_state / routing state 也更適合正式 DB

原因：

- 高頻寫入
- 順序敏感
- 查詢與摘要組裝需求高

## 8. 建議的下一步

最實際的下一步有兩個：

1. 依照這份對照表整理出實際的 Notion 欄位建立清單
2. 把四個 skill 的 schema 對應到 API request / response 規格

若是先為了落地，我會建議先做第 1 個，也就是直接列出 Notion 每張表應該建立哪些欄位與型態。

