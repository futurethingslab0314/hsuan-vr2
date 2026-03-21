# AI Team Builder v1 Minimal API Flow and Endpoints

## 1. 目標

這份文件定義 AI Team Builder v1 的最小可行 API 流程與端點草案。

目標是先跑通最核心流程：

使用者輸入 -> AI 分析 -> 建立團隊 -> 對話 -> 生成報告

## 2. v1 建議 API 列表

1. `POST /api/projects/create`
2. `POST /api/projects/:projectId/analyze`
3. `POST /api/projects/:projectId/team-members/generate`
4. `POST /api/projects/:projectId/chat`
5. `POST /api/projects/:projectId/report/generate`

## 3. 流程順序

1. 前端送出使用者輸入，建立 `PROJECT`
2. 後端呼叫 `Requirement Analyzer`，把分析結果寫回 `PROJECT`
3. 後端呼叫 `Team Composer`，建立多筆 `TEAM_MEMBER`
4. 使用者進入討論，持續呼叫 `Conversation Orchestrator`
5. 使用者結束討論後，呼叫 `Report Generator`，建立 `REPORT`

## 4. API 草案

### 4.1 `POST /api/projects/create`

用途：建立專案主資料，只處理人類輸入與初始狀態。

#### Request

```json
{
  "project": "AI Team Builder MVP",
  "input_prompt_user": "我想做一個讓產品團隊可以跟 AI 團隊一起討論需求的工具。",
  "input_prompt_goal_user": "驗證 AI 團隊協作體驗是否有價值",
  "currentstage_user": "mvp_planning",
  "status": "draft"
}
```

#### 寫入 Notion

`PROJECT`

- `project`
- `input_prompt_user`
- `input_prompt_goal_user`
- `currentstage_user`
- `status`

#### Response

```json
{
  "ok": true,
  "project_id": "notion-page-id",
  "status": "draft"
}
```

#### 備註

這一步不先做 AI 分析，先單純建立專案。

---

### 4.2 `POST /api/projects/:projectId/analyze`

用途：執行 `Requirement Analyzer`，把 AI 分析結果寫回 `PROJECT`。

#### Request

```json
{
  "project_id": "notion-page-id"
}
```

#### 後端處理

1. 讀取 `PROJECT`
   - `input_prompt_user`
   - `input_prompt_goal_user`
   - `currentstage_user`
2. 呼叫 `Requirement Analyzer`
3. 寫回 `PROJECT`

#### 寫回 Notion

- `project_summary_ai`
- `problem_statement_ai`
- `target_users_ai`
- `core_goals_ai`
- `constraints_ai`
- `open_questions_ai`
- `suggested_stage_ai`
- `analysis_confidence_ai`
- `status` -> 可更新為 `active`

#### Response

```json
{
  "ok": true,
  "project_id": "notion-page-id",
  "analysis": {
    "project_summary_ai": "...",
    "problem_statement_ai": "...",
    "suggested_stage_ai": "mvp_planning",
    "analysis_confidence_ai": 0.86
  }
}
```

#### 備註

這一步完成後，前端可進 loading -> analysis complete -> map。

---

### 4.3 `POST /api/projects/:projectId/team-members/generate`

用途：執行 `Team Composer`，建立此專案的 AI 成員。

#### Request

```json
{
  "project_id": "notion-page-id"
}
```

#### 後端處理

1. 讀取 `PROJECT`
   - `project_summary_ai`
   - `problem_statement_ai`
   - `target_users_ai`
   - `core_goals_ai`
   - `constraints_ai`
   - `open_questions_ai`
   - `currentstage_user`
2. 呼叫 `Team Composer`
3. 在 `TEAM_MEMBER` 建立多筆資料
4. 透過 relation 連回 `PROJECT`

#### 寫入 Notion

`TEAM_MEMBER`

- `member_name`
- `project`
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

#### Response

```json
{
  "ok": true,
  "project_id": "notion-page-id",
  "members": [
    {
      "member_id": "member-page-id-1",
      "member_name": "Maya Chen",
      "role_type_ai": "PM"
    },
    {
      "member_id": "member-page-id-2",
      "member_name": "Alex Lin",
      "role_type_ai": "UX"
    }
  ]
}
```

#### 備註

這一步完成後，前端可進入 team map。

---

### 4.4 `POST /api/projects/:projectId/chat`

用途：執行 `Conversation Orchestrator`，處理一輪對話。

#### Request

```json
{
  "project_id": "notion-page-id",
  "user_message": "我覺得多人角色切換很酷，但第一版會不會太重？",
  "tagged_members": []
}
```

#### 後端處理

1. 讀取 `PROJECT`
   - `currentstage_user`
   - `project_summary_ai`
   - `problem_statement_ai`
   - `chat_content`
   - `discussion_stage_ai`
   - `confirmed_points_ai`
   - `assumptions_ai`
   - `next_focus_ai`
   - `ready_for_report_ai`
2. 讀取此專案所有 `TEAM_MEMBER`
3. 呼叫 `Conversation Orchestrator`
4. 將本輪結果累積寫回 `PROJECT`

#### 寫回 Notion

`PROJECT`

- `chat_content`
- `discussion_stage_ai`
- `confirmed_points_ai`
- `assumptions_ai`
- `next_focus_ai`
- `ready_for_report_ai`

#### Response

```json
{
  "ok": true,
  "project_id": "notion-page-id",
  "responses": [
    {
      "member_name": "Maya Chen",
      "role_type_ai": "PM",
      "content": "..."
    },
    {
      "member_name": "David Wu",
      "role_type_ai": "Engineer",
      "content": "..."
    }
  ],
  "system_summary": "目前共識偏向先做簡化版多人協作體驗。",
  "ready_for_report_ai": false
}
```

#### 備註

v1 因為沒有獨立 `CHAT` 表，所以這一步的關鍵是把整段討論文字穩定累積到 `chat_content`。

---

### 4.5 `POST /api/projects/:projectId/report/generate`

用途：執行 `Report Generator`，建立一份一頁式報告。

#### Request

```json
{
  "project_id": "notion-page-id"
}
```

#### 後端處理

1. 讀取 `PROJECT`
   - 人類輸入欄位
   - AI 分析欄位
   - 對話狀態欄位
   - `chat_content`
2. 讀取此專案的 `TEAM_MEMBER`
3. 呼叫 `Report Generator`
4. 建立一筆 `REPORT`

#### 寫入 Notion

`REPORT`

- `report_number`
- `project`
- `report_content`

#### Response

```json
{
  "ok": true,
  "project_id": "notion-page-id",
  "report_id": "report-page-id",
  "report_number": "Report 001"
}
```

## 5. 狀態轉移建議

建議 `PROJECT.status` 用途如下：

- `draft`
  - 專案剛建立，尚未完成分析
- `active`
  - 已完成分析或正在團隊討論中
- `archived`
  - 討論完成、報告已產出、暫不再使用

簡單狀態流：

1. `create` 後 -> `draft`
2. `analyze` 成功後 -> `active`
3. `report/generate` 完成後 -> 可保留 `active` 或由使用者手動改 `archived`

v1 不建議自動封存，先讓使用者決定是否 archive。

## 6. 前端畫面對應 API

### `HomeView`

- 呼叫 `POST /api/projects/create`
- 成功後再呼叫 `POST /api/projects/:id/analyze`
- 接著呼叫 `POST /api/projects/:id/team-members/generate`

### `MapView`

- 顯示 `TEAM_MEMBER`
- 若未來支援編輯，可再補 `PATCH /api/team-members/:memberId`

### `ChatView`

- 每送一則訊息呼叫 `POST /api/projects/:id/chat`

### `PlanView`

- 呼叫 `POST /api/projects/:id/report/generate`

## 7. v1 建議實作順序

1. `POST /api/projects/create`
2. `POST /api/projects/:projectId/analyze`
3. `POST /api/projects/:projectId/team-members/generate`
4. `POST /api/projects/:projectId/chat`
5. `POST /api/projects/:projectId/report/generate`

不要先加太多 `PATCH`、`DELETE`、版本控制 API，先把主路徑跑通。

