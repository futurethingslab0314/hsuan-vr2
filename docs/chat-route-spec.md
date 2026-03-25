# Chat Route Spec v1

## 1. Route 目的

`POST /api/projects/:projectId/chat` 的責任是：

- 讀取同一筆 `PROJECT`
- 讀取這個 project 對應的 `TEAM_MEMBER`
- 接收使用者這一輪的訊息
- 呼叫 `Conversation Orchestrator`
- 將本輪 AI 團隊回應與 system summary 寫回 `PROJECT.chat_content`
- 同時更新：
  - `discussion_stage_ai`
  - `confirmed_points_ai`
  - `assumptions_ai`
  - `next_focus_ai`
  - `ready_for_report_ai`

這條 route 只負責「處理一輪對話」，不負責：

- 不建立 project
- 不重新分析需求
- 不重新生成 team
- 不生成 report

## 2. 這條 route 完成後的狀態

- `PROJECT.chat_content` 已累積最新一輪對話
- `PROJECT.discussion_stage_ai` 被更新
- `PROJECT.confirmed_points_ai` 被更新
- `PROJECT.assumptions_ai` 被更新
- `PROJECT.next_focus_ai` 被更新
- `PROJECT.ready_for_report_ai` 被更新
- 前端 `ChatView` 可以顯示這輪 AI 團隊回應

## 3. 建議路由格式

建議使用：

`POST /api/projects/:projectId/chat`

在 Next.js App Router 中，建議位置為：

`app/api/projects/[projectId]/chat/route.ts`

## 4. Request 規格

### 建議 request

```json
{
  "user_message": "我覺得多人角色切換很酷，但第一版會不會太重？",
  "tagged_members": []
}
```

### 欄位說明

#### `user_message`

- 型態：`string`
- 必填：是
- 用途：這一輪使用者輸入的內容

#### `tagged_members`

- 型態：`string[]`
- 必填：否
- 用途：被 tag 的 member id

前端最後建議送 `member_id`，不要送 member name。

## 5. 主要輸入來源

除了 request body，這條 route 還會讀取 `PROJECT` 與 `TEAM_MEMBER` 的資料。

### 來自 `PROJECT` 的欄位

- `project`
- `currentstage_user`
- `project_summary_ai`
- `problem_statement_ai`
- `chat_content`
- `discussion_stage_ai`
- `confirmed_points_ai`
- `assumptions_ai`
- `next_focus_ai`
- `ready_for_report_ai`

### 來自 `TEAM_MEMBER` 的欄位

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

這些會組成 `Conversation Orchestrator` 的完整輸入。

## 6. Conversation Orchestrator 的輸出要寫到哪裡

這條 route 主要寫回 `PROJECT`。

### 必寫欄位

- `chat_content`
- `discussion_stage_ai`
- `confirmed_points_ai`
- `assumptions_ai`
- `next_focus_ai`
- `ready_for_report_ai`

其中：

- `chat_content` 承接本輪 user + AI + system summary 的累積文字
- 其他欄位承接對話狀態

## 7. Response 規格

### 成功回應

```json
{
  "ok": true,
  "project_id": "notion-page-id",
  "responses": [
    {
      "member_id": "member-page-id-1",
      "member_name": "Maya Chen",
      "role_type_ai": "PM",
      "content": "如果我們站在 MVP 的角度，我會建議先不要把完整多人角色切換做得太重。"
    },
    {
      "member_id": "member-page-id-3",
      "member_name": "David Wu",
      "role_type_ai": "Engineer",
      "content": "從實作面來看，完整多人角色切換會增加上下文管理和前端互動複雜度。"
    }
  ],
  "system_summary": "目前共識偏向：第一版應保留 AI 團隊協作感，但不必一開始就做完整複雜的多人角色切換機制。",
  "discussion_state": {
    "discussion_stage_ai": "framing",
    "confirmed_points_ai": "MVP 應先驗證協作感，而不是追求完整角色機制",
    "assumptions_ai": "簡化版角色協作已足夠讓使用者感受到價值",
    "next_focus_ai": "定義簡化版多人協作互動的最小範圍",
    "ready_for_report_ai": false
  }
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

#### 尚未生成 team members

```json
{
  "ok": false,
  "error": "Team members are required before starting chat"
}
```

#### `user_message` 為空

```json
{
  "ok": false,
  "error": "user_message is required"
}
```

#### tagged member 不存在

```json
{
  "ok": false,
  "error": "Tagged member not found"
}
```

#### AI 或 Notion 更新失敗

```json
{
  "ok": false,
  "error": "Failed to process chat round",
  "detail": "..."
}
```

## 8. 後端處理流程

1. 從 URL 取得 `projectId`
2. 讀取 `PROJECT`
3. 讀取這個 project 底下所有 `TEAM_MEMBER`
4. 驗證 chat round 所需資料是否完整
5. 組成 `Conversation Orchestrator` 的輸入
6. 呼叫 `Conversation Orchestrator`
7. 將本輪對話與狀態寫回 `PROJECT`
8. 回傳本輪回應結果

## 9. 最低限度需要的 helper function

### `getProjectPage(projectId)`

用途：讀取 project page，可直接重用前面的 helper。

### `extractProjectForChat(projectPage)`

用途：把 `PROJECT` 中跟 chat 有關的欄位抽出來。

至少包含：

- `project`
- `currentstage_user`
- `project_summary_ai`
- `problem_statement_ai`
- `chat_content`
- `discussion_stage_ai`
- `confirmed_points_ai`
- `assumptions_ai`
- `next_focus_ai`
- `ready_for_report_ai`

### `listTeamMembersByProject(projectId)`

用途：取得這個 project 對應的所有 `TEAM_MEMBER`。

### `extractTeamMembersForChat(teamMemberPages)`

用途：把 `TEAM_MEMBER` pages 轉成 `Conversation Orchestrator` 可讀格式。

至少包含：

- `member_id`
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

### `validateChatRequest(projectData, members, userMessage, taggedMembers)`

用途：檢查這輪 chat 是否可執行。

至少檢查：

- `user_message` 不為空
- `PROJECT` 已具備必要 AI 分析欄位
- 至少有一位 `TEAM_MEMBER`
- 若有 tag，tag 的成員存在

### `buildConversationOrchestratorInput(projectData, members, userMessage, taggedMembers)`

用途：把 `PROJECT` + `TEAM_MEMBER` + request body 組成 AI 輸入。

應組出：

- `project_brief`
- `project_stage`
- `members`
- `chat_history`
- `conversation_summary`
- `user_message`
- `tagged_members`
- `decision_state`
- `report_readiness`

### `runConversationOrchestrator(input)`

用途：呼叫 OpenAI / `Conversation Orchestrator`

輸出建議：

```json
{
  "message_type": "feature_scope",
  "discussion_stage": "framing",
  "selected_speakers": [],
  "responses": [],
  "system_summary": "....",
  "discussion_state_update": {
    "confirmed_points": ["..."],
    "assumptions": ["..."],
    "next_focus": "..."
  },
  "ready_for_report": false
}
```

### `discussion_stage_ai` 四階段規格

v1 的 `discussion_stage_ai` 採用累積對話狀態判斷，不以單一訊息分類。

正式值：

- `clarifying`
- `exploring`
- `framing`
- `wrapping`

判斷原則：

- 以目前既有的 `discussion_stage_ai` 為基準
- 綜合本輪 `user_message`、`system_summary`、`confirmed_points_ai`、`next_focus_ai` 判斷
- 採單向前進狀態機：
  - `clarifying -> exploring -> framing -> wrapping`
- v1 原則上不主動倒退
- 每輪最多升一階
- 若目前 `discussion_stage_ai` 為空，預設從 `clarifying` 開始

升階條件概要：

- `clarifying -> exploring`
  - 開始提出多種候選方向、做法或機會點
- `exploring -> framing`
  - 開始比較方案、收斂方向、形成初步共識
- `framing -> wrapping`
  - 已形成較明確結論，並開始整理下一步、交付或報告

### `appendChatContent(existingChatContent, userMessage, responses, systemSummary)`

用途：把這一輪 user + AI + system summary 拼回新的 `chat_content`。

### `buildProjectChatUpdatePayload(chatResult, nextChatContent)`

用途：把這輪 chat 結果轉成 Notion update payload。

會寫回：

- `chat_content`
- `discussion_stage_ai`
- `confirmed_points_ai`
- `assumptions_ai`
- `next_focus_ai`
- `ready_for_report_ai`

### `updateProjectChatState(projectId, payload)`

用途：執行 `notion.pages.update`。

## 10. 這條 route 和前兩條最大的差別

### `create`

- 建一筆 `PROJECT`

### `analyze`

- 更新 `PROJECT` 的 AI 分析欄位

### `chat`

- 同時依賴 `PROJECT` 與 `TEAM_MEMBER`
- 並且每一輪都要更新 `PROJECT` 狀態

## 11. 資料處理細節

因為 `chat_content` 是一整塊 Rich text，格式要先固定。

建議每輪累積成：

```txt
[User]
我覺得多人角色切換很酷，但第一版會不會太重？

[PM - Maya Chen]
如果我們站在 MVP 的角度...

[Engineer - David Wu]
從實作面來看...

[System Summary]
目前共識偏向...
```

這樣至少：

- Notion 裡可讀
- 後面 AI 也還能拿來當 history

## 12. 這條 route 先不要做的事

v1 先不要混進：

- 不要生成 report
- 不要重新生成 team
- 不要改 `currentstage_user`
- 不要改 `suggested_stage_ai`

這條只處理「對話進行中」的資訊。

