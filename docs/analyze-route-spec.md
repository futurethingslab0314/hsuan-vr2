# Analyze Route Spec v1

## 1. Route 目的

`POST /api/projects/:projectId/analyze` 的責任是：

- 讀取某一筆 `PROJECT`
- 取出人類輸入欄位
- 呼叫 `Requirement Analyzer`
- 把 AI 分析結果寫回同一筆 `PROJECT`
- 不在這一步建立 `TEAM_MEMBER`
- 不在這一步生成 `REPORT`

這條 route 只負責分析，不負責後續流程。

## 2. 建議路由格式

建議使用：

`POST /api/projects/:projectId/analyze`

在 Next.js App Router 中，建議位置為：

`app/api/projects/[projectId]/analyze/route.ts`

## 3. Request 規格

v1 建議使用 URL param 傳入 `projectId`，body 可為空。

### Request body

```json
{}
```

若未來要支援重新分析，可擴充為：

```json
{
  "force_reanalyze": false
}
```

v1 先不一定需要。

## 4. 主要輸入來源

這條 route 的主要輸入不是前端 body，而是 `PROJECT` 中既有欄位：

- `project`
- `input_prompt_user`
- `input_prompt_goal_user`
- `currentstage_user`
- `status`

其中前四項為 `Requirement Analyzer` 的主要輸入。

## 5. Notion 讀取欄位對照

| 用途 | Notion 欄位 | 型態 |
|---|---|---|
| project 名稱 | `project` | Title |
| 使用者原始需求 | `input_prompt_user` | Rich text |
| 使用者目標 | `input_prompt_goal_user` | Rich text |
| 使用者選的目前階段 | `currentstage_user` | Select |
| 專案狀態 | `status` | Status |

## 6. OpenAI 輸入建議格式

從 Notion 讀出資料後，整理成以下格式再送給 `Requirement Analyzer`：

```json
{
  "project": "AI Team Builder MVP",
  "original_prompt": "我想做一個讓產品團隊可以跟 AI 團隊一起討論需求的工具。",
  "project_goal": "驗證 AI 團隊協作體驗是否有價值",
  "project_stage": "mvp_planning"
}
```

## 7. AI 輸出 -> Notion 寫回對照表

| Requirement Analyzer 輸出欄位 | Notion 欄位 | 型態 | 寫回方式 |
|---|---|---|---|
| `project_summary` | `project_summary_ai` | Rich text | 字串寫回 |
| `problem_statement` | `problem_statement_ai` | Rich text | 字串寫回 |
| `target_users` | `target_users_ai` | Rich text | 陣列先 join 成文字 |
| `core_goals` | `core_goals_ai` | Rich text | 陣列先 join 成文字 |
| `constraints` | `constraints_ai` | Rich text | 陣列先 join 成文字 |
| `open_questions` | `open_questions_ai` | Rich text | 陣列先 join 成文字 |
| `suggested_stage` | `suggested_stage_ai` | Select | 直接寫 select |
| `analysis_confidence` | `analysis_confidence_ai` | Number | 數字寫回 |
| 系統狀態更新 | `status` | Status | 設成 `active` |

## 8. Response 規格

### 成功回應

```json
{
  "ok": true,
  "project_id": "notion-page-id",
  "analysis": {
    "project_summary_ai": "一個讓產品團隊透過 AI 團隊協作方式釐清需求並產出產品策略摘要的工具。",
    "problem_statement_ai": "小型產品與設計團隊在需求探索與方向收斂過程中，缺乏一個能同時提供多職能視角並協助整理結論的輔助工具。",
    "target_users_ai": "小型產品團隊\n接案設計團隊",
    "core_goals_ai": "驗證 AI 團隊協作體驗是否有價值\n幫助使用者快速收斂產品方向",
    "constraints_ai": "v1 聚焦 MVP\n輸出以一頁式摘要為主",
    "open_questions_ai": "第一版應支援哪些角色\n摘要生成要多輕量",
    "suggested_stage_ai": "mvp_planning",
    "analysis_confidence_ai": 0.86
  },
  "status": "active"
}
```

### 失敗回應

```json
{
  "ok": false,
  "error": "Project is missing required fields for analysis",
  "detail": "input_prompt_goal_user is empty"
}
```

## 9. 後端處理流程

1. 從 URL 取得 `projectId`
2. 用 Notion 讀取這筆 `PROJECT`
3. 抽出需要欄位
4. 驗證必填欄位是否完整
5. 組成 `Requirement Analyzer` 的輸入
6. 呼叫 OpenAI
7. 驗證 AI 輸出欄位是否齊全
8. 組成 Notion update payload
9. 用 `notion.pages.update` 寫回 `PROJECT`
10. 回傳分析結果

## 10. 這條 route 不應處理的事情

v1 先不要在這條 route 混入以下責任：

- 不要建立 `TEAM_MEMBER`
- 不要生成 `REPORT`
- 不要更新 `discussion_stage_ai`
- 不要寫 `chat_content`

這些都屬於後續 API。

## 11. 最低限度需要的 helper function

建議至少準備以下 helper：

- `normalize(value: string): string`
- `findPropertyName(...)`
- `getRichTextValue(...)`
- `getTitleValue(...)`
- `getSelectValue(...)`
- `buildRichTextProperty(...)`
- `buildSelectProperty(...)`
- `buildNumberProperty(...)`

可選但推薦：

- `joinLines(values: string[]): string`
- `validateProjectForAnalysis(projectData)`

