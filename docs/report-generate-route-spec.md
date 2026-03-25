# Report Generate Route Spec v1

## 1. Route 目的

`POST /api/projects/:projectId/report/generate` 的責任是：

- 讀取同一筆 `PROJECT`
- 讀取這個 project 對應的 `TEAM_MEMBER`
- 取出目前已累積的：
  - 使用者原始輸入
  - AI 分析結果
  - 對話狀態
  - `chat_content`
- 呼叫 `Report Generator`
- 在 `REPORT` 建立一筆新資料
- 透過 relation 連回 `PROJECT`

這條 route 只負責「生成一份一頁式報告」，不負責：

- 不建立 project
- 不重新分析需求
- 不重新生成 team
- 不更新 team member
- 不繼續處理聊天對話輪次

## 2. 這條 route 完成後的狀態

做完後應該達成：

- `REPORT` 新增一筆資料
- `REPORT.report_number` 有值
- `REPORT.report_content` 有完整一頁式報告內容
- `REPORT.project` relation 連回 `PROJECT`
- 前端 `PlanView` 或未來報告頁可直接顯示內容

## 3. 建議路由格式

建議使用：

`POST /api/projects/:projectId/report/generate`

在 Next.js App Router 中，建議位置：

`app/api/projects/[projectId]/report/generate/route.ts`

## 4. Request 規格

這條 route 和 `analyze`、`team-members/generate` 類似，v1 最簡版可使用空 body：

```json
{}
```

## 5. 主要輸入來源

### 來自 `PROJECT` 的欄位

- `project`
- `input_prompt_user`
- `input_prompt_goal_user`
- `currentstage_user`
- `project_summary_ai`
- `problem_statement_ai`
- `target_users_ai`
- `core_goals_ai`
- `constraints_ai`
- `open_questions_ai`
- `chat_content`
- `discussion_stage_ai`
- `confirmed_points_ai`
- `assumptions_ai`
- `next_focus_ai`
- `ready_for_report_ai`

`project_stage` / `currentstage_user` 在目前系統中應使用：

- `discover`
- `define`
- `develop`
- `deliver`

### 來自 `TEAM_MEMBER` 的欄位

整理成：

- `member_name`
- `role_type_ai`
- `why_this_role`

## 6. Report Generator 的輸出要寫到哪裡

這條 route 主要寫入 `REPORT`。

### 必寫欄位

- `report_number`
- `project` relation
- `report_content`

## 7. Response 規格

### 成功回應

```json
{
  "ok": true,
  "project_id": "notion-page-id",
  "report_id": "report-page-id",
  "report_number": "Report 001",
  "report_content": "Executive Summary\n...\n\nCore Need\n...\n\nUser Problem\n..."
}
```

### 失敗回應

#### 找不到 project

```json
{
  "ok": false,
  "error": "Project not found"
}
```

#### 缺少必要分析 / 對話資料

```json
{
  "ok": false,
  "error": "Project is missing required data for report generation"
}
```

#### AI 或 Notion 寫入失敗

```json
{
  "ok": false,
  "error": "Failed to generate report",
  "detail": "..."
}
```

## 8. 後端處理流程

1. 從 URL 取得 `projectId`
2. 讀取 `PROJECT`
3. 讀取這個 project 底下所有 `TEAM_MEMBER`
4. 驗證是否具備生成報告所需資料
5. 組成 `Report Generator` 的輸入
6. 呼叫 `Report Generator`
7. 在 `REPORT` 建立一筆資料並回傳結果

## 9. 最低限度需要的 helper function

### `getProjectPage(projectId)`

用途：讀取 project page。這個可直接重用前面的 helper。

### `extractProjectForReport(projectPage)`

用途：把 `PROJECT` 裡跟報告生成有關的欄位抽出來。

至少包含：

- `project`
- `input_prompt_user`
- `input_prompt_goal_user`
- `currentstage_user`
- `project_summary_ai`
- `problem_statement_ai`
- `target_users_ai`
- `core_goals_ai`
- `constraints_ai`
- `open_questions_ai`
- `chat_content`
- `discussion_stage_ai`
- `confirmed_points_ai`
- `assumptions_ai`
- `next_focus_ai`
- `ready_for_report_ai`

### `listTeamMembersByProject(projectId)`

用途：取得這個 project 對應的 team member。這個可直接重用 `chat` route 那條 helper。

### `extractTeamMembersForReport(teamMemberPages)`

用途：把 `TEAM_MEMBER` 資料整理成 report generator 可讀格式。

v1 建議最少取：

- `member_name`
- `role_type_ai`
- `why_this_role`

### `validateProjectForReport(projectData, members)`

用途：檢查是否具備生成報告的條件。

至少檢查：

- `project_summary_ai` 有值
- `problem_statement_ai` 有值
- `chat_content` 有值
- 至少有一位 team member

`ready_for_report_ai` 在 v1 放寬版中保留欄位，但不再作為 report 生成的硬性阻擋條件。

### `buildReportGeneratorInput(projectData, members)`

用途：把 `PROJECT` + `TEAM_MEMBER` 組成 `Report Generator` 的輸入。

應組出：

- `original_prompt`
- `project_goal`
- `project_stage`
- `analysis_result`
- `final_members`
- `chat_summary`
- `decision_points`

其中：

- `chat_summary`：先用 `chat_content`
- `decision_points`：先用
  - `confirmed_points_ai`
  - `assumptions_ai`
  - `next_focus_ai`

### `runReportGenerator(input)`

用途：呼叫 OpenAI / `Report Generator`

輸出建議：

```json
{
  "report_title": "AI Team Collaboration Tool MVP Strategy Summary",
  "report_content": "Executive Summary\n...\n\nCore Need\n...\n\nUser Problem\n..."
}
```

目前 `REPORT` 表只有一個 `report_content`。

### `buildReportNumber(projectId)`

用途：產生 `report_number`。

### `createReport(projectId, reportResult)`

用途：建立一筆 `REPORT`。

寫入：

- `report_number`
- `project` relation
- `report_content`

## 10. 這條 route 和前面幾條的差別

### `create`

- 建一筆 `PROJECT`

### `analyze`

- 更新 `PROJECT` 的 AI 分析欄位

### `team-members/generate`

- 建多筆 `TEAM_MEMBER`

### `chat`

- 持續更新 `PROJECT` 的對話狀態

### `report/generate`

- 讀整體資料，產生最後輸出到 `REPORT`

這條是輸出端，不是流程中段。

## 11. 資料處理細節建議

因為現在 `REPORT` 表只有：

- `report_number`
- `project`
- `report_content`

所以 `report_content` 的格式先固定成可讀的一頁式內容，例如：

```txt
Executive Summary
...

Core Need
...

User Problem
...

Product Direction
...

Key Assumptions
...

Next Steps
...
```

這樣：

- Notion 裡可直接讀
- 前端也可以直接 render

## 12. 這條 route 先不要做的事

v1 先不要混進：

- 不要修改 `PROJECT.currentstage_user`
- 不要回頭改 AI 分析欄位
- 不要修改 `TEAM_MEMBER`
- 不要把 report 同步回 `PROJECT`





