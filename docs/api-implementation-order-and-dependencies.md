# AI Team Builder API Implementation Order and Dependency Map

## 1. 目的

這份文件整理 AI Team Builder v1 的 5 條主 API 的實作優先順序與依賴關係，目標是幫助開發時先打通最小可行主流程，再逐步往後擴充。

5 條主 API：

1. `POST /api/projects/create`
2. `POST /api/projects/:projectId/analyze`
3. `POST /api/projects/:projectId/team-members/generate`
4. `POST /api/projects/:projectId/chat`
5. `POST /api/projects/:projectId/report/generate`

## 2. 實作優先順序

建議實作順序如下：

1. `POST /api/projects/create`
2. `POST /api/projects/:projectId/analyze`
3. `POST /api/projects/:projectId/team-members/generate`
4. `POST /api/projects/:projectId/chat`
5. `POST /api/projects/:projectId/report/generate`

這個順序的原因是：

- 每一條都依賴前一條的資料結果
- 越後面的 route 越依賴整體系統狀態
- 先打通前段主流程，比先做最複雜的 chat / report 更穩

## 3. 依賴關係總覽

### 3.1 `POST /api/projects/create`

**依賴**

- Notion `PROJECT` database

**產出**

- 一筆新的 `PROJECT`
- `project_id`

**後續誰會依賴它**

- `analyze`
- `team-members/generate`
- `chat`
- `report/generate`

這是所有後續流程的起點。

---

### 3.2 `POST /api/projects/:projectId/analyze`

**依賴**

- `create` 已成功建立 `PROJECT`
- `PROJECT` 具備：
  - `project`
  - `input_prompt_user`
  - `input_prompt_goal_user`
  - `currentstage_user`

**產出**

- 更新 `PROJECT` 的 AI 分析欄位：
  - `project_summary_ai`
  - `problem_statement_ai`
  - `target_users_ai`
  - `core_goals_ai`
  - `constraints_ai`
  - `open_questions_ai`
  - `suggested_stage_ai`
  - `analysis_confidence_ai`
- `status` -> `active`

**後續誰會依賴它**

- `team-members/generate`
- `chat`
- `report/generate`

這條是所有 AI 流程的第一個正式入口。

---

### 3.3 `POST /api/projects/:projectId/team-members/generate`

**依賴**

- `create` 已成功建立 `PROJECT`
- `analyze` 已成功寫回 AI 分析欄位

至少需要：

- `project_summary_ai`
- `problem_statement_ai`
- `target_users_ai`
- `core_goals_ai`
- `constraints_ai`
- `open_questions_ai`
- `currentstage_user`

**產出**

- 建立多筆 `TEAM_MEMBER`
- relation 連回 `PROJECT`

**後續誰會依賴它**

- `chat`
- `report/generate`

這條完成後，前端 team map 才能改讀真實資料。

---

### 3.4 `POST /api/projects/:projectId/chat`

**依賴**

- `PROJECT` 已存在
- `PROJECT` 已完成 AI 分析
- `TEAM_MEMBER` 已建立

至少需要：

- `project_summary_ai`
- `problem_statement_ai`
- `chat_content`（可為空字串）
- `discussion_stage_ai`（可初始為空）
- `confirmed_points_ai`
- `assumptions_ai`
- `next_focus_ai`
- `ready_for_report_ai`
- 至少 1 筆 `TEAM_MEMBER`

**產出**

- 更新 `PROJECT.chat_content`
- 更新 `discussion_stage_ai`
- 更新 `confirmed_points_ai`
- 更新 `assumptions_ai`
- 更新 `next_focus_ai`
- 更新 `ready_for_report_ai`

**後續誰會依賴它**

- `report/generate`

這條是整個系統中最核心、最複雜的 route。

---

### 3.5 `POST /api/projects/:projectId/report/generate`

**依賴**

- `PROJECT` 已存在
- `PROJECT` 已完成 AI 分析
- `TEAM_MEMBER` 已建立
- 至少已有一輪以上 chat 或至少具備足夠內容生成摘要

至少需要：

- `input_prompt_user`
- `input_prompt_goal_user`
- `currentstage_user`
- `project_summary_ai`
- `problem_statement_ai`
- `chat_content`
- `confirmed_points_ai`
- `assumptions_ai`
- `next_focus_ai`
- 至少 1 筆 `TEAM_MEMBER`

**產出**

- 建立 1 筆 `REPORT`
- relation 連回 `PROJECT`

這條是 v1 主流程的最終輸出端。

## 4. 開發時的分段 milestone 建議

### Milestone 1：打通前段主流程

目標：

- 使用者輸入
- 建立 project
- 完成 AI 分析
- 生成 team

包含：

1. `create`
2. `analyze`
3. `team-members/generate`

做到這裡後，產品就能從首頁走到真實 team map。

### Milestone 2：打通討論流程

目標：

- 使用者進入 chat
- AI 團隊可以真實回應
- 對話狀態可被持續更新

包含：

4. `chat`

做到這裡後，產品的核心價值「像跟 AI 團隊開會」才真正成立。

### Milestone 3：打通最終輸出

目標：

- 討論完成後可生成一頁式報告

包含：

5. `report/generate`

做到這裡後，整條 v1 主流程才完整閉環。

## 5. 建議先做的實作策略

### `create`

- 先直接接 Notion
- 這條目前已有雛形，最適合先改造

### `analyze`

- 先用 mock `Requirement Analyzer`
- 確認 Notion 讀寫無誤後，再接 OpenAI

### `team-members/generate`

- 先用 mock `Team Composer`
- 先確認 TEAM_MEMBER 建立與 relation 正確

### `chat`

- 先用 mock `Conversation Orchestrator`
- 先把 `chat_content` 累積格式跑通

### `report/generate`

- 先用 mock `Report Generator`
- 先確認 REPORT 建立與前端顯示可行

## 6. 推薦的實作節奏

最穩的節奏是：

1. 先打通 Notion 讀寫
2. 再用 mock AI 輸出打通資料流
3. 最後再把 mock 換成真正的 OpenAI 呼叫

原因：

- 這樣能把問題清楚切成「資料流問題」和「模型輸出問題」
- 不會一開始就把 Notion、OpenAI、前端三邊問題糾纏在一起

## 7. 最終建議

若要開始真正開發，最推薦的起手順序是：

1. 改造現有 `POST /api/projects/create`
2. 實作 `POST /api/projects/:projectId/analyze`
3. 實作 `POST /api/projects/:projectId/team-members/generate`
4. 確認首頁 -> 分析 -> 團隊頁主流程跑通
5. 再進入 `chat`
6. 最後做 `report/generate`

