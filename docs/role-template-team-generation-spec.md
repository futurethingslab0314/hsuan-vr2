# Role Template Team Generation Spec v1

## 1. 目標

這份規格定義新的團隊生成邏輯：

1. 使用者送出專案資料
2. `analyze route` 生成：
   - `project_summary_ai`
   - `problem_statement_ai`
   - `target_users_ai`
   - `core_goals_ai`
   - `constraints_ai`
   - `open_questions_ai`
   - `suggested_stage_ai`
   - `analysis_confidence_ai`
3. `team-members/generate` 讀 `PROJECT.currentstage_user`
4. 根據 `currentstage_user` 讀：
   - 1 筆 `STAGE_PLAYBOOK`
   - 該階段 4 筆 `ROLE_TEMPLATE`
5. 將：
   - 階段規則
   - 角色模板
   - 專案分析結果
   一起送給 OpenAI
6. OpenAI 產生這個專案專屬的 4 位 `TEAM_MEMBER`
7. 使用者再到 UI 手動微調

這個版本的核心改變是：

- 不再讓 OpenAI 自由決定角色集合
- 角色集合固定為同一組 4 個角色
- 依 `currentstage_user` 選擇對應階段的 4 個模板
- OpenAI 的任務改為「根據模板與專案內容進行微調」

---

## 2. 哪些 Notion database 需要先建立 relation

### 必要 relation

#### `TEAM_MEMBER.project -> PROJECT`

這條 relation 必須保留，因為：

- 每一位生成出的團隊成員都屬於某一個專案
- `chat route`
- `report/generate route`
- 成員編輯頁面

都依賴這條 relation 找回同一個 project 的成員。

#### `REPORT.project -> PROJECT`

這條 relation 也應保留，因為 report 是專案輸出的一部分。

---

### 建議 relation（可選，但推薦）

#### `TEAM_MEMBER.role_template -> ROLE_TEMPLATE`

這條 relation 不是 v1 必要條件，但我建議建立。

用途：

- 追蹤這個成員是從哪一個模板生成出來的
- 後續若你要重生成、回溯、比較模板差異，會方便很多
- 之後若模板內容有更新，也能知道既有專案成員原本使用的是哪一版人格骨架

如果不建立 relation，至少也建議在 `TEAM_MEMBER` 存：

- `template_name`
- `stage_key`

作為來源追蹤。

---

### 不一定要建立 relation 的部分

#### `PROJECT -> STAGE_PLAYBOOK`

不需要 relation。

原因：

- `PROJECT.currentstage_user` 已經能直接決定階段
- `team-members/generate` 可以用 `currentstage_user` 去查 `STAGE_PLAYBOOK.stage_key`

所以這裡用欄位值比對即可，不必建立 relation。

#### `ROLE_TEMPLATE -> STAGE_PLAYBOOK`

也不一定要建立 relation。

原因：

- `ROLE_TEMPLATE.stage_key`
- `STAGE_PLAYBOOK.stage_key`

已經能靠相同值做查詢與對應。

如果你很在意 Notion 內部瀏覽關聯，也可以補 relation，但對目前程式邏輯不是必要條件。

---

## 3. 建議最終資料庫關係

### 必須有

- `PROJECT`
- `STAGE_PLAYBOOK`
- `ROLE_TEMPLATE`
- `TEAM_MEMBER`
- `REPORT`

### 關聯建議

- `TEAM_MEMBER.project -> PROJECT`：必要
- `REPORT.project -> PROJECT`：必要
- `TEAM_MEMBER.role_template -> ROLE_TEMPLATE`：推薦，但可選

---

## 4. `STAGE_PLAYBOOK` v1 欄位

目前欄位：

- `stage_key`
- `stage_goal`
- `stage_core_principle`
- `stage_behavior_rules`
- `stage_response_pattern`
- `stage_collaboration_flow`

這些已足夠支撐 v1。

用途：

- 定義這個階段的對話目的
- 定義整體原則與禁則
- 定義這個階段的回應模式
- 定義 4 角色之間的協作順序

---

## 5. `ROLE_TEMPLATE` v1 欄位

目前欄位：

- `template_name`
- `stage_key`
- `role_key`
- `role_display_name`
- `role_type_ai`
- `base_tone`
- `base_behavior`
- `base_response_style`
- `base_tasks`
- `base_rules`

這些也足夠支撐 v1。

用途：

- 定義每個階段下每個角色的人格骨架
- 定義角色語氣、行為方式、回應風格、任務與規則
- 讓 OpenAI 在固定模板上針對專案內容做微調

---

## 6. 新的團隊生成邏輯

### Step 1. 使用者建立專案

`create route` 寫入：

- `project`
- `input_prompt_user`
- `input_prompt_goal_user`
- `currentstage_user`
- `status`

---

### Step 2. 分析專案

`analyze route` 根據使用者輸入產出：

- `project_summary_ai`
- `problem_statement_ai`
- `target_users_ai`
- `core_goals_ai`
- `constraints_ai`
- `open_questions_ai`
- `suggested_stage_ai`
- `analysis_confidence_ai`

這一步的輸出，是後續團隊生成的分析基礎。

---

### Step 3. 根據 `currentstage_user` 選模板

`team-members/generate` 讀：

- `PROJECT.currentstage_user`

接著：

- 到 `STAGE_PLAYBOOK` 找 `stage_key = currentstage_user`
- 到 `ROLE_TEMPLATE` 找 `stage_key = currentstage_user`

此時應該得到：

- 1 筆階段規則
- 4 筆角色模板

---

### Step 4. 將三類資料組成新的 Team Composer 輸入

新的 `Team Composer` 輸入應包含三層：

#### A. Project analysis

- `project_summary_ai`
- `problem_statement_ai`
- `target_users_ai`
- `core_goals_ai`
- `constraints_ai`
- `open_questions_ai`
- `currentstage_user`

#### B. Stage playbook

- `stage_goal`
- `stage_core_principle`
- `stage_behavior_rules`
- `stage_response_pattern`
- `stage_collaboration_flow`

#### C. Four role templates

每個角色模板至少帶入：

- `template_name`
- `role_key`
- `role_display_name`
- `role_type_ai`
- `base_tone`
- `base_behavior`
- `base_response_style`
- `base_tasks`
- `base_rules`

---

## 7. OpenAI 在這一步要做的事情

OpenAI 在新邏輯下的責任不是：

- 發明一組角色

而是：

- 讀取固定的 4 個角色模板
- 保留這 4 個角色的階段人格骨架
- 根據專案分析結果，將角色內容微調成這個專案專屬版本

換句話說，模型要做的是：

### `adapt role template to project`

而不是：

### `invent a team from scratch`

---

## 8. 新的 `TEAM_MEMBER` 寫入方式

OpenAI 產出的仍然是專案實例化後的成員，因此寫入 `TEAM_MEMBER` 的仍應是：

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

另外建議補來源追蹤欄位：

- `template_name`
- `stage_key`

如果有建立 relation，則再補：

- `role_template` relation

---

## 9. `TEAM_MEMBER` 來源追蹤建議

為了讓後續 UI 編輯與重新生成比較穩，建議 `TEAM_MEMBER` 至少能回答這些問題：

- 這個成員是在哪個 stage 生成的？
- 這個成員原本來自哪一個模板？
- 這個成員是否已被使用者手動修改過？

因此 v1 建議至少新增：

- `template_name`
- `stage_key`

v2 若需要更完整追蹤，可再新增：

- `role_template` relation
- `is_user_edited`

---

## 10. route 邏輯應如何修改

### 目前

`team-members/generate` 直接把：

- `project_summary_ai`
- `problem_statement_ai`
- `target_users_ai`
- `core_goals_ai`
- `constraints_ai`
- `open_questions_ai`
- `project_stage`

丟給 OpenAI，讓模型自己決定團隊內容。

### 修改後

`team-members/generate` 應改成：

1. 讀 `PROJECT`
2. 驗證分析欄位存在
3. 讀 `currentstage_user`
4. 查 `STAGE_PLAYBOOK`
5. 查 4 筆 `ROLE_TEMPLATE`
6. 組新的 Team Composer 輸入
7. 呼叫 OpenAI 做模板微調
8. 將結果寫入 `TEAM_MEMBER`

---

## 11. 建議新增的 helper function

### `getStagePlaybookByStageKey(stageKey)`

用途：

- 從 `STAGE_PLAYBOOK` 取得當前階段規則

### `listRoleTemplatesByStageKey(stageKey)`

用途：

- 從 `ROLE_TEMPLATE` 取得這個階段的 4 個角色模板

### `buildTeamComposerInput(projectData, stagePlaybook, roleTemplates)`

用途：

- 組新的 Team Composer 輸入

### `runTeamComposerWithTemplates(input)`

用途：

- 呼叫 OpenAI
- 固定輸出 4 個角色
- 依模板與專案內容做微調

### `buildTeamMemberCreatePayload(projectId, member)`

用途：

- 將微調後的角色寫入 `TEAM_MEMBER`
- 可一併寫入 `template_name`
- 若有 relation，則寫入 `role_template`

---

## 12. v1 建議採用的最小策略

為了先把流程穩定跑通，建議 v1 先採用：

- `TEAM_MEMBER.project -> PROJECT` relation：必要
- `REPORT.project -> PROJECT` relation：必要
- `TEAM_MEMBER.role_template -> ROLE_TEMPLATE`：可先不做
- 先只在 `TEAM_MEMBER` 加：
  - `template_name`
  - `stage_key`

這樣你先不需要在 Notion 裡增加過多 relation，也能保留模板來源資訊。

---

## 13. 一句話總結

新的邏輯可以改成：

1. 使用者送出專案資料
2. `analyze route` 生成專案分析結果
3. `team-members/generate` 讀 `currentstage_user`
4. 根據 `currentstage_user` 讀 1 筆 `STAGE_PLAYBOOK` 與 4 筆 `ROLE_TEMPLATE`
5. 把階段規則、角色模板、專案分析結果一起送給 OpenAI
6. OpenAI 依固定模板骨架產生這個專案專屬的 4 位 `TEAM_MEMBER`
7. 使用者再到 UI 手動微調

這個設計成立，而且比目前「讓模型自由決定角色集合」更穩定，也更符合雙鑽石四階段模板庫的目標。
