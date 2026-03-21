# AI Team Builder Human-Readable Field Spec v1

## 1. Requirement Analyzer 欄位規格

用途：把使用者一開始輸入的需求，整理成結構化專案 brief。

### `project_summary`

- 用途：整體摘要這個專案在做什麼
- 型態：文字
- 必填：是
- 備註：應該是精簡版總結，方便後續所有 skill 快速理解專案

### `problem_statement`

- 用途：定義目前真正要解決的核心問題
- 型態：文字
- 必填：是
- 備註：要聚焦問題，不是直接寫方案

### `target_users`

- 用途：描述目標使用者族群
- 型態：文字陣列
- 必填：是
- 備註：可有多種目標族群，例如新手、團隊管理者、設計師

### `core_goals`

- 用途：列出這個專案最重要的目標
- 型態：文字陣列
- 必填：是
- 備註：偏成果導向，例如提升效率、降低理解成本、驗證概念

### `constraints`

- 用途：列出目前已知限制
- 型態：文字陣列
- 必填：否
- 備註：例如時程、技術限制、團隊資源、資料來源限制

### `open_questions`

- 用途：列出目前還沒釐清、需要在對話中繼續確認的問題
- 型態：文字陣列
- 必填：是
- 備註：這會直接影響後續聊天的補問方向

### `recommended_roles`

- 用途：推薦需要哪些 AI 角色參與討論
- 型態：物件陣列
- 必填：是
- 備註：每筆建議至少包含角色名稱、推薦原因、優先程度

建議子欄位：

#### `role_type`

- 用途：角色類型
- 型態：固定值
- 必填：是
- 備註：UX、PM、UI、Engineer、Researcher、custom

#### `reason`

- 用途：為什麼需要這個角色
- 型態：文字
- 必填：是

#### `priority`

- 用途：重要程度
- 型態：固定值
- 必填：是
- 備註：high / medium / low

### `analysis_confidence`

- 用途：AI 對目前分析結果的信心程度
- 型態：數字
- 必填：是
- 備註：建議 0 到 1 之間

## 2. Team Composer 欄位規格

用途：根據需求分析結果，組出一組 AI 團隊成員。

### `team_rationale`

- 用途：說明為什麼這組團隊適合這個專案
- 型態：文字
- 必填：是
- 備註：讓使用者理解這個 team composition 的邏輯

### `members`

- 用途：團隊成員清單
- 型態：物件陣列
- 必填：是
- 備註：每位 member 都要能成為後續對話中的 agent

每位 member 建議欄位如下：

### `id`

- 用途：成員唯一識別碼
- 型態：文字
- 必填：是

### `name`

- 用途：成員名稱
- 型態：文字
- 必填：是
- 備註：給 UI 顯示與聊天辨識用

### `role_type`

- 用途：角色類型
- 型態：固定值
- 必填：是
- 備註：UX、PM、UI、Engineer、Researcher、custom

### `custom_role_label`

- 用途：若是特殊角色，填入特殊角色名稱
- 型態：文字或空值
- 必填：否
- 備註：例如 AI Workflow Designer

### `is_custom_role`

- 用途：是否為特殊角色
- 型態：布林值
- 必填：是

### `background`

- 用途：角色背景設定
- 型態：物件
- 必填：是
- 備註：可細分年資、經驗、職能、專長

建議子欄位：

#### `years`

- 用途：年資
- 型態：文字
- 必填：否

#### `experience`

- 用途：過往經驗
- 型態：文字
- 必填：否

#### `profession`

- 用途：職能定位
- 型態：文字
- 必填：否

#### `expertise`

- 用途：專長領域
- 型態：文字陣列
- 必填：否

### `tasks`

- 用途：這位角色主要負責的任務
- 型態：文字陣列
- 必填：是

### `knowledge`

- 用途：這位角色會依據哪些知識框架、標準或專業觀點
- 型態：文字陣列
- 必填：是

### `workflow`

- 用途：描述這位角色通常如何與其他角色協作
- 型態：文字
- 必填：是

### `response_format`

- 用途：這位角色偏好的輸出方式
- 型態：文字
- 必填：是
- 備註：例如條列式、重點摘要、行動建議

### `tone`

- 用途：角色說話語氣
- 型態：文字
- 必填：是
- 備註：以專業差異為主，不建議過度人格化

### `why_this_role`

- 用途：為什麼這位角色應該加入這場討論
- 型態：文字
- 必填：是

### `routing_hints`

- 用途：給 Conversation Orchestrator 的出場提示
- 型態：物件
- 必填：建議是
- 備註：特別重要，特殊角色尤其需要

建議子欄位：

#### `good_for`

- 用途：適合回答哪些問題
- 型態：文字陣列

#### `avoid_for`

- 用途：不適合處理哪些問題
- 型態：文字陣列

#### `pairs_well_with`

- 用途：適合和哪些角色搭配
- 型態：文字陣列

## 3. Conversation Orchestrator 欄位規格

用途：控制每一輪會議的選角、發言與整理。

### `message_type`

- 用途：判斷這輪使用者訊息屬於哪種討論類型
- 型態：固定值
- 必填：是
- 備註：建議固定分類，不要自由文字

建議值：

- `clarification`
- `product_direction`
- `feature_scope`
- `user_flow`
- `interface_design`
- `technical_feasibility`
- `validation`
- `wrap_up`

### `discussion_stage`

- 用途：目前整場討論處於哪個階段
- 型態：固定值
- 必填：是

建議值：

- `clarifying`
- `framing`
- `exploring`
- `aligning`
- `wrapping`

### `selected_speakers`

- 用途：這輪被選中回應的成員
- 型態：物件陣列
- 必填：是
- 備註：最多兩位

每筆建議包含：

#### `member_id`

- 用途：成員 ID
- 型態：文字
- 必填：是

#### `role_type`

- 用途：角色類型
- 型態：固定值
- 必填：是

#### `speaker_role`

- 用途：主回應或第二補充
- 型態：固定值
- 必填：是
- 備註：`primary` / `secondary`

#### `function`

- 用途：第二位發言者的功能定位
- 型態：固定值
- 必填：是
- 備註：`answer`、`support`、`challenge`、`tradeoff`、`implementation`、`validation`

### `speaker_order`

- 用途：定義誰先發言
- 型態：文字陣列
- 必填：是

### `responses`

- 用途：實際顯示在聊天中的回應內容
- 型態：物件陣列
- 必填：是

每筆建議包含：

#### `member_id`

- 用途：成員 ID
- 型態：文字
- 必填：是

#### `name`

- 用途：成員名稱
- 型態：文字
- 必填：是

#### `role`

- 用途：顯示角色名稱
- 型態：文字
- 必填：是

#### `content`

- 用途：實際回覆文字
- 型態：文字
- 必填：是

### `system_summary`

- 用途：是否附上一段系統整理
- 型態：物件
- 必填：是
- 備註：即使沒有，也建議保留欄位

建議子欄位：

#### `enabled`

- 用途：這輪是否顯示系統整理
- 型態：布林值

#### `content`

- 用途：整理內容
- 型態：文字

### `discussion_state_update`

- 用途：更新這輪之後的討論狀態
- 型態：物件
- 必填：是

建議子欄位：

#### `confirmed_points`

- 用途：目前已形成共識的內容
- 型態：文字陣列

#### `open_questions`

- 用途：還未解決的問題
- 型態：文字陣列

#### `assumptions`

- 用途：目前仍屬假設的判斷
- 型態：文字陣列

#### `next_focus`

- 用途：建議下一輪聚焦的主題
- 型態：文字

### `follow_up_questions`

- 用途：若資訊不足，建議接下來可追問的問題
- 型態：文字陣列
- 必填：否

### `ready_for_report`

- 用途：是否已達到可生成摘要的狀態
- 型態：布林值
- 必填：是

## 4. Report Generator 欄位規格

用途：在對話結束後生成一頁式產品策略摘要。

### `report_title`

- 用途：報告標題
- 型態：文字
- 必填：是

### `report_type`

- 用途：報告類型
- 型態：固定值
- 必填：是
- 備註：v1 建議固定為 `one_page_product_strategy`

### `project_stage`

- 用途：專案所處階段
- 型態：文字或固定值
- 必填：是
- 備註：後續可考慮限制成固定選項

### `executive_summary`

- 用途：整份摘要的總結
- 型態：文字
- 必填：是

### `sections`

- 用途：一頁式摘要的主內容區塊
- 型態：物件陣列
- 必填：是

每筆 section 建議欄位：

#### `section_key`

- 用途：段落識別碼
- 型態：固定值
- 必填：是
- 備註：建議固定以下五種

- `core_need`
- `user_problem`
- `product_direction`
- `assumptions`
- `next_steps`

#### `title`

- 用途：段落標題
- 型態：文字
- 必填：是

#### `content`

- 用途：段落內容
- 型態：文字
- 必填：是

### `risks`

- 用途：列出目前風險與待確認點
- 型態：文字陣列
- 必填：否

### `next_steps`

- 用途：列出建議下一步
- 型態：文字陣列
- 必填：是

## 5. 優先確認的關鍵欄位

若要往下做系統設計，建議先優先確認以下欄位：

### Requirement Analyzer

- `problem_statement`
- `core_goals`
- `open_questions`
- `recommended_roles`

### Team Composer

- `role_type`
- `is_custom_role`
- `tasks`
- `knowledge`
- `routing_hints`

### Conversation Orchestrator

- `message_type`
- `discussion_stage`
- `selected_speakers`
- `discussion_state_update`
- `ready_for_report`

### Report Generator

- `project_stage`
- `sections`
- `next_steps`
