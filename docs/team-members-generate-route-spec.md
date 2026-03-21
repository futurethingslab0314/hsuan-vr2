# Team Members Generate Route Spec v1

## 1. Route 目的

`POST /api/projects/:projectId/team-members/generate` 的責任是：

- 讀取同一筆 `PROJECT`
- 取出 `Requirement Analyzer` 已經寫回的分析結果
- 呼叫 `Team Composer`
- 在 `TEAM_MEMBER` 建立多筆成員資料
- 透過 relation 連回 `PROJECT`
- 不在這一步處理聊天
- 不在這一步生成 report

它只負責「依分析結果建立團隊」。

## 2. 這條 route 完成後的狀態

- `PROJECT` 已經有 AI 分析欄位
- `TEAM_MEMBER` 下面已經有這個 project 對應的角色
- 前端 `MapView` 可以改成讀真實 team member，而不是假資料

## 3. 建議路由格式

建議使用：

`POST /api/projects/:projectId/team-members/generate`

在 Next.js App Router 中，建議位置為：

`app/api/projects/[projectId]/team-members/generate/route.ts`

## 4. Request 規格

v1 最簡版可使用空 body：

```json
{}
```

因為主要資料都已經在 `PROJECT` 與 `TEAM_MEMBER` 對應的 Notion 裡。

## 5. 主要輸入來源

這條 route 的主要輸入，來自 `PROJECT` 已經存在的欄位：

- `project`
- `currentstage_user`
- `project_summary_ai`
- `problem_statement_ai`
- `target_users_ai`
- `core_goals_ai`
- `constraints_ai`
- `open_questions_ai`

這些就是 `Team Composer` 的主要輸入。

因此這條 route 預設依賴 `analyze` 已先成功執行。若 AI 分析欄位為空，這條應該報錯，而不是硬生成 team。

## 6. Team Composer 的輸出要寫到哪裡

這條 route 主要寫入 `TEAM_MEMBER`。

每位 member 應建立一筆 Notion page，至少寫入：

- `member_name`
- `project` relation
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

## 7. Response 規格

### 成功回應

```json
{
  "ok": true,
  "project_id": "notion-page-id",
  "members": [
    {
      "member_id": "member-page-id-1",
      "member_name": "Maya Chen",
      "role_type_ai": "PM",
      "is_custom_role": false
    },
    {
      "member_id": "member-page-id-2",
      "member_name": "Alex Lin",
      "role_type_ai": "UX",
      "is_custom_role": false
    },
    {
      "member_id": "member-page-id-3",
      "member_name": "David Wu",
      "role_type_ai": "Engineer",
      "is_custom_role": false
    }
  ]
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

#### project 尚未完成分析

```json
{
  "ok": false,
  "error": "Project is missing required analysis fields for team generation"
}
```

#### 已經有 team members

```json
{
  "ok": false,
  "error": "Team members already exist for this project"
}
```

#### AI 或 Notion 建立失敗

```json
{
  "ok": false,
  "error": "Failed to generate team members",
  "detail": "..."
}
```

## 8. 後端處理流程

1. 從 URL 取得 `projectId`
2. 讀取 `PROJECT`
3. 抽出 team generation 所需欄位
4. 驗證 project 是否具備生成 team 的條件
5. 呼叫 `Team Composer`
6. 在 `TEAM_MEMBER` 建立多筆資料
7. 回傳建立結果

## 9. 最低限度需要的 helper function

### `getProjectPage(projectId)`

用途：讀取 project page。這個可直接重用 `analyze` 那條的 helper。

### `extractProjectForTeamGeneration(projectPage)`

用途：把 `PROJECT` page 轉成 `Team Composer` 需要的乾淨輸入。

應抽出的欄位：

- `project`
- `currentstage_user`
- `project_summary_ai`
- `problem_statement_ai`
- `target_users_ai`
- `core_goals_ai`
- `constraints_ai`
- `open_questions_ai`

### `validateProjectForTeamGeneration(projectData)`

用途：檢查這筆 project 是否可以生成 team。

至少檢查：

- `project_summary_ai` 有值
- `problem_statement_ai` 有值
- `currentstage_user` 有值

### `buildTeamComposerInput(projectData)`

用途：把 `PROJECT` 裡的資料轉成 `Team Composer` 的輸入格式。

例如：

```json
{
  "project_summary": "...",
  "problem_statement": "...",
  "target_users": ["..."],
  "core_goals": ["..."],
  "constraints": ["..."],
  "open_questions": ["..."],
  "project_stage": "mvp_planning"
}
```

### `runTeamComposer(teamComposerInput)`

用途：呼叫 OpenAI / Team Composer skill，回傳成員陣列。

輸出建議：

```json
{
  "team_rationale": "...",
  "members": [
    {
      "name": "Maya Chen",
      "role_type": "PM",
      "custom_role_label": null,
      "is_custom_role": false,
      "background_identity": "...",
      "tasks": ["..."],
      "knowledge": ["..."],
      "rules": "...",
      "workflow": "...",
      "response_format": "...",
      "tone": "...",
      "why_this_role": "...",
      "routing_hints": {
        "good_for": ["..."],
        "avoid_for": ["..."],
        "pairs_well_with": ["..."]
      },
      "display_order": 1
    }
  ]
}
```

### `buildTeamMemberCreatePayload(projectId, member, index)`

用途：把單一 member 轉成 Notion `pages.create` payload。

### `createTeamMembers(projectId, members)`

用途：逐筆建立 `TEAM_MEMBER` page。

責任：

- loop members
- 每一筆呼叫 `notion.pages.create`
- 帶上 `project` relation

### `listExistingTeamMembers(projectId)`

用途：避免重複建立 team。

若這個 project 底下已經有 team member，就先擋掉。

## 10. 這條 route 和 analyze route 的差別

### `analyze`

- 更新同一筆 `PROJECT`

### `team-members/generate`

- 讀 `PROJECT`
- 新增多筆 `TEAM_MEMBER`

## 11. 資料處理細節

統一規則：

- `target_users_ai`
  - Notion 存換行字串
  - Team Composer 輸入時拆成陣列
- `core_goals_ai`
  - 同上
- `constraints_ai`
  - 同上
- `open_questions_ai`
  - 同上
- `role_target`
  - 存換行字串
- `role_knowledge_reference`
  - 存換行字串
- `routing_good_for`
  - 存換行字串

## 12. 這條 route 先不要做的事

v1 先不要在這條 route 混進以下責任：

- 不要更新 `chat_content`
- 不要更新 `discussion_stage_ai`
- 不要寫 `REPORT`
- 不要在這裡直接進行成員編輯

