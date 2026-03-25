# AI Skill Output to Notion Mapping v1

## 1. 說明

這份文件整理四個 AI skill 的輸出欄位，並對應到目前 v1 已建立的 Notion database 欄位。

原則：

- 只列出目前已建立的 Notion 欄位
- 不包含尚未建立、且 v1 暫時不補的欄位
- 以目前實際使用的三張表為準：`PROJECT`、`TEAM_MEMBER`、`REPORT`

## 2. Requirement Analyzer

用途：將使用者原始輸入整理成結構化分析結果。

主要寫入：`PROJECT`

| AI skill 輸出欄位 | Notion 欄位 | 資料表 | 備註 |
|---|---|---|---|
| `project_summary` | `project_summary_ai` | `PROJECT` | AI 產出的整體摘要 |
| `problem_statement` | `problem_statement_ai` | `PROJECT` | AI 定義的核心問題 |
| `target_users` | `target_users_ai` | `PROJECT` | 建議以換行格式寫入 |
| `core_goals` | `core_goals_ai` | `PROJECT` | AI 整理出的核心目標 |
| `constraints` | `constraints_ai` | `PROJECT` | AI 判斷的限制條件 |
| `open_questions` | `open_questions_ai` | `PROJECT` | AI 整理出的待釐清問題 |
| `suggested_stage` | `suggested_stage_ai` | `PROJECT` | AI 建議的專案階段 |
| `analysis_confidence` | `analysis_confidence_ai` | `PROJECT` | AI 分析信心值 |

### Requirement Analyzer 輸入來源

這個 skill 的輸入主要來自 `PROJECT` 中的人類輸入欄位：

- `input_prompt_user`
- `input_prompt_goal_user`
- `currentstage_user`

`currentstage_user` 與 `suggested_stage_ai` 現在採用的階段值為：

- `discover`
- `define`
- `develop`
- `deliver`

## 3. Team Composer

用途：根據分析結果建立 AI 團隊角色。

主要寫入：`TEAM_MEMBER`

| AI skill 輸出欄位 | Notion 欄位 | 資料表 | 備註 |
|---|---|---|---|
| `name` | `member_name` | `TEAM_MEMBER` | 成員名稱 |
| `role_type` | `role_type_ai` | `TEAM_MEMBER` | UX / PM / UI / Engineer / Researcher / custom |
| `custom_role_label` | `custom_role_label_ai` | `TEAM_MEMBER` | 特殊角色名稱 |
| `is_custom_role` | `is_custom_role` | `TEAM_MEMBER` | 是否為特殊角色 |
| `background_identity` | `role_background_identity` | `TEAM_MEMBER` | 角色背景、身分、專長 |
| `tasks` | `role_target` | `TEAM_MEMBER` | 角色主要任務 |
| `knowledge` | `role_knowledge_reference` | `TEAM_MEMBER` | 知識框架、專業依據 |
| `rules` | `role_rules` | `TEAM_MEMBER` | 行為準則 |
| `workflow` | `role_workflow` | `TEAM_MEMBER` | 協作方式 |
| `response_format` | `role_response_format` | `TEAM_MEMBER` | 輸出形式 |
| `tone` | `role_tone` | `TEAM_MEMBER` | 語氣 |
| `why_this_role` | `why_this_role` | `TEAM_MEMBER` | 為什麼加入團隊 |
| `routing_hints.good_for` | `routing_good_for` | `TEAM_MEMBER` | 適合回答的問題 |
| `routing_hints.avoid_for` | `routing_avoid_for` | `TEAM_MEMBER` | 不適合回答的問題 |
| `routing_hints.pairs_well_with` | `routing_pairs_well_with` | `TEAM_MEMBER` | 適合搭配哪些角色 |
| `display_order` | `display_order` | `TEAM_MEMBER` | UI 排序 |

### Team Composer 關聯寫入

| 系統動作 | Notion 欄位 | 資料表 | 備註 |
|---|---|---|---|
| project relation | `project` | `TEAM_MEMBER` | 連回所屬 project |

### 前端目前實際接收與編輯的欄位

雖然 `TEAM_MEMBER` 在 Notion 中已寫入完整角色資料，但目前前端 [`src/App.tsx`](C:/Users/User/Documents/Playground/ai-team-builder/src/App.tsx) 與 [`src/components/views/MapView.tsx`](C:/Users/User/Documents/Playground/ai-team-builder/src/components/views/MapView.tsx) 只實際接收並使用其中一部分欄位。

目前前端有接到並映射的主要欄位：

- `member_name`
- `role_type_ai`
- `is_custom_role`
- `role_background_identity`
- `role_target`
- `role_knowledge_reference`
- `role_rules`
- `role_workflow`
- `role_response_format`
- `role_tone`
- `display_order`

目前前端尚未帶進 UI 的欄位：

- `custom_role_label_ai`
- `why_this_role`
- `routing_good_for`
- `routing_avoid_for`
- `routing_pairs_well_with`

因此，v1 文件若提到「系統可用欄位」，需要區分：

- Notion / 後端已寫入欄位
- 前端目前已實際接入並可顯示 / 編輯的欄位

## 4. Conversation Orchestrator

用途：控制每輪討論狀態、更新共識與是否可生成報告。

目前 v1 主要寫入：`PROJECT`

| AI skill 輸出欄位 | Notion 欄位 | 資料表 | 備註 |
|---|---|---|---|
| `discussion_stage` | `discussion_stage_ai` | `PROJECT` | clarifying / framing / exploring / aligning / wrapping |
| `discussion_state_update.confirmed_points` | `confirmed_points_ai` | `PROJECT` | 共識內容 |
| `discussion_state_update.assumptions` | `assumptions_ai` | `PROJECT` | 假設內容 |
| `discussion_state_update.next_focus` | `next_focus_ai` | `PROJECT` | 下一輪建議聚焦主題 |
| `ready_for_report` | `ready_for_report_ai` | `PROJECT` | 是否可生成報告 |
| `responses + system_summary + user messages` | `chat_content` | `PROJECT` | v1 先把完整討論文字累積寫入 |

## 5. Report Generator

用途：生成一頁式產品策略摘要。

主要寫入：`REPORT`

| AI skill 輸出欄位 | Notion 欄位 | 資料表 | 備註 |
|---|---|---|---|
| `report_title` | `report_number` | `REPORT` | 報告名稱 |
| `full_report_content` | `report_content` | `REPORT` | 一頁式報告完整內容 |

### Report Generator 關聯寫入

| 系統動作 | Notion 欄位 | 資料表 | 備註 |
|---|---|---|---|
| project relation | `project` | `REPORT` | 連回所屬 project |

## 6. 整體資料流總結

### Step 1 人類輸入

寫入 `PROJECT`：

- `input_prompt_user`
- `input_prompt_goal_user`
- `currentstage_user`
- `status`

### Step 2 Requirement Analyzer

寫回 `PROJECT`：

- `project_summary_ai`
- `problem_statement_ai`
- `target_users_ai`
- `core_goals_ai`
- `constraints_ai`
- `open_questions_ai`
- `suggested_stage_ai`
- `analysis_confidence_ai`

### Step 3 Team Composer

建立多筆 `TEAM_MEMBER`：

- `member_name`
- `role_type_ai`
- `custom_role_label_ai`
- `is_custom_role`
- `role_background_identity`
- `role_target`
- `role_knowledge_reference`
- `role_rules`
- `role_workflow`
- `role_response_format`
- `role_tone`
- `why_this_role`
- `routing_good_for`
- `routing_avoid_for`
- `routing_pairs_well_with`
- `display_order`
- `project` relation

### Step 4 Conversation Orchestrator

更新 `PROJECT`：

- `chat_content`
- `discussion_stage_ai`
- `confirmed_points_ai`
- `assumptions_ai`
- `next_focus_ai`
- `ready_for_report_ai`

### Step 5 Report Generator

建立 1 筆 `REPORT`：

- `report_number`
- `report_content`
- `project` relation

## 7. 補充

`PROJECT.status` 建議保留，因為它和 `currentstage_user` 不同：

- `currentstage_user`：產品流程目前在哪個階段
- `status`：這筆專案資料目前是否仍在進行中

v1 建議使用：

- `draft`
- `active`
- `archived`





