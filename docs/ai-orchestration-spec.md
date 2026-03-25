# AI Team Builder AI Orchestration Spec v1

## 1. 目的

這份文件定義 AI Team Builder v1 的 AI orchestration 架構，整合四個核心 skill、固定角色規格、Conversation Orchestrator 的選角規則，以及特殊角色的納入方式。

本產品的核心體驗是讓使用者感受到「像在跟一個 AI 團隊開會」，而不是單純取得一份報告。因此 orchestration 的重點是：

- 讓 AI 在正確時機執行正確功能
- 讓不同成員呈現穩定且可辨識的專業視角
- 讓對話逐步收斂到可生成一頁式產品策略摘要

## 2. v1 核心原則

- 每輪最多 2 位 AI 成員發言
- 可選 1 段 system summary
- 角色差異以專業視角為主，不走強烈人格演出
- 使用者可調整的成員設定會真正影響後續回應
- 最終輸出為一頁式產品策略摘要，而非完整重型 PRD
- 固定職能池為預設基礎，特殊角色為補充機制

## 3. 整體架構

AI orchestration v1 由四個 skill 組成：

1. Requirement Analyzer
2. Team Composer
3. Conversation Orchestrator
4. Report Generator

資料流：

1. 使用者輸入專案需求、目標、專案階段
2. Requirement Analyzer 產出結構化 brief
3. Team Composer 根據 brief 建立 AI 團隊
4. 使用者調整成員設定
5. Conversation Orchestrator 根據成員設定與對話歷史控制會議回應
6. 使用者結束討論
7. Report Generator 產出一頁式產品策略摘要

## 4. Skill 規格

### 4.1 Requirement Analyzer

**任務**

將使用者最初輸入的需求轉為後續可用的結構化分析結果。

**輸入**

- original_prompt
- project_goal
- project_stage
- optional_context

**輸出**

- project_summary
- problem_statement
- target_users
- core_goals
- constraints
- open_questions
- recommended_roles
- analysis_confidence

**規則**

- 優先整理已知與未知
- 推薦角色時優先固定職能池
- 只有需求明顯超出固定池時才建議特殊角色
- 不做最後產品決策

### 4.2 Team Composer

**任務**

依據需求分析結果組成可進入會議對話的 AI 團隊。

**輸入**

- project_summary
- problem_statement
- target_users
- core_goals
- constraints
- open_questions
- recommended_roles

**輸出**

- team_rationale
- members[]

每位 member 包含：

- name
- role_type
- is_custom_role
- background
- tasks
- knowledge
- workflow
- response_format
- tone
- why_this_role

**規則**

- 團隊以 3 到 5 位為主
- 優先固定角色
- 特殊角色必須附加入理由
- 成員之間必須具備功能區隔

### 4.3 Conversation Orchestrator

**任務**

管理整場 AI 團隊會議，決定每輪由誰回應、怎麼回應、是否需要 system summary，以及何時接近可生成摘要。

**輸入**

- project_brief
- members
- chat_history
- conversation_summary
- user_message
- tagged_members
- decision_state
- report_readiness

**輸出**

- selected_speakers
- speaker_order
- responses
- system_summary
- discussion_state_update
- follow_up_questions
- ready_for_report

**規則**

- 每輪最多 2 位成員發言
- 若使用者有 tag，優先使用被 tag 成員
- 若未 tag，由系統選最相關的 1 到 2 位成員
- 第二位發言者只能作為補充、挑戰、平衡、落地或驗證提醒
- 只在必要時加入 system summary

### 4.4 Report Generator

**任務**

在討論結束後，依據專案階段與討論內容生成一頁式產品策略摘要。

**輸入**

- original_prompt
- project_goal
- project_stage
- analysis_result
- final_members
- chat_summary
- decision_points
- optional_full_chat_history

**輸出**

- report_title
- report_type
- executive_summary
- sections
- risks
- next_steps

**規則**

- 報告需依 project_stage 切換重點
- 以摘要與決策點為主，不逐字重述聊天
- 不確定事項需標記為假設或待驗證
- 輸出定位為一頁式產品策略摘要

## 5. 固定角色視角規格

### 5.1 UX

**使命**

把模糊需求轉成清楚的使用者問題、目標與體驗方向。

**主要關注**

- 使用者是誰
- 使用者問題是什麼
- 使用流程是否合理
- 功能是否真的解決需求
- 體驗是否有摩擦

**不應過度介入**

- 商業優先級主導
- 技術落地決策
- 視覺細節主導

**發言風格**

- 先釐清問題，再談方案
- 偏分析、清楚、使用者導向

### 5.2 PM

**使命**

把討論收斂成可執行的產品方向與優先順序。

**主要關注**

- 目標是否清楚
- 哪些需求最重要
- 現階段先做什麼
- 怎麼收斂成決策

**不應過度介入**

- 深入設計細節
- 深入技術細節
- 忽略體驗品質

**發言風格**

- 強調取捨、優先級與推進
- 幫團隊從發散走向決策

### 5.3 UI

**使命**

把需求與流程轉成清楚、可理解、可操作的介面方向。

**主要關注**

- 資訊是否清楚
- 操作是否直覺
- 視覺層級是否合理
- 介面是否一致

**不應過度介入**

- 產品策略主導
- 研究結論主導
- 技術可行性主導

**發言風格**

- 從畫面、資訊與互動細節出發
- 強調理解成本與操作體驗

### 5.4 Engineer

**使命**

評估方案是否可實作，並將討論轉為較務實的落地方式。

**主要關注**

- 技術可行性
- 依賴與風險
- 實作成本
- 系統限制
- MVP 切法

**不應過度介入**

- 使用者價值主導
- 視覺或研究判斷主導
- 過早用工程限制否定方向

**發言風格**

- 冷靜、務實、具風險意識
- 強調怎麼做比較真的做得出來

### 5.5 Researcher

**使命**

提醒團隊哪些結論仍是假設，並提出驗證方式。

**主要關注**

- 哪些內容尚未被證明
- 哪些是需要驗證的假設
- 應該先驗證什麼
- 可以用什麼方法驗證

**不應過度介入**

- 產品優先級主導
- UI 解法主導
- 工程方案主導

**發言風格**

- 理性、中性、以證據為中心
- 區分事實、推測、假設

## 6. Conversation Orchestrator 路由規則

### 6.1 總原則

- 一輪最多 2 位成員發言
- 若使用者有 tag，優先使用被 tag 成員
- 第一位是主回應者，第二位是補充者
- 第二位功能只能是 support、challenge、tradeoff、implementation、validation 其中之一
- 不要連續多輪固定同一組人，除非主題未變
- system summary 僅在必要時出現

### 6.2 使用者訊息類型與預設選角

#### 需求釐清類

**特徵**

- 我想做一個...
- 這個產品主要給誰用？
- 我不確定真正問題是什麼

**預設角色**

- UX
- Researcher

**補位角色**

- PM

#### 產品方向類

**特徵**

- 核心價值是什麼？
- 應該先做哪個方向？
- 這個想法成立嗎？

**預設角色**

- PM
- UX

**補位角色**

- Researcher

#### 功能範圍類

**特徵**

- MVP 要有哪些功能？
- 哪些應該先做？
- 這功能值不值得放第一版？

**預設角色**

- PM
- Engineer

**補位角色**

- UX

#### 體驗流程類

**特徵**

- 使用流程怎麼走？
- 這樣順不順？
- 使用者第一次會怎麼理解？

**預設角色**

- UX
- UI

**補位角色**

- PM

#### 介面呈現類

**特徵**

- 首頁怎麼設計？
- 資訊層級怎麼放？
- 這個頁面怎麼做比較清楚？

**預設角色**

- UI
- UX

**補位角色**

- Engineer

#### 技術可行性類

**特徵**

- 這做得出來嗎？
- 這樣串 API 合理嗎？
- 技術風險是什麼？

**預設角色**

- Engineer
- PM

**補位角色**

- UX

#### 驗證與研究類

**特徵**

- 怎麼知道方向對不對？
- 應該先驗證什麼？
- 哪些是假設？

**預設角色**

- Researcher
- UX

**補位角色**

- PM

#### 收斂與結論類

**特徵**

- 幫我整理一下
- 我們目前結論是什麼？
- 可以生成摘要了嗎？

**預設角色**

- PM
- system summary

**補位角色**

- UX 或 Researcher

### 6.3 討論階段修正

討論階段分為：

- clarifying
- exploring
- framing
- wrapping

v1 採累積對話狀態判斷，不以單一訊息分類，並使用單向前進狀態機：

- `clarifying -> exploring -> framing -> wrapping`

原則上不主動倒退，且每輪最多升一階。

**clarifying**

- 目的：同步背景知識、限制條件與基礎事實
- 優先 UX、Researcher
- 避免讓 UI 或 Engineer 過早主導

**exploring**

- 目的：擴散不同方向、方案與機會點
- 可多用雙人搭配
- 常見為 PM + UX、UX + UI、PM + Engineer

**framing**

- 目的：將前面發散內容整理成結構化觀點與核心方向
- 優先 UX、PM
- Researcher 可補驗證提醒

**wrapping**

- 目的：確認共識、整理下一步與交付內容
- 優先 PM
- 可搭配 Researcher 或 system summary
- 不再大幅發散新方向

### 6.4 tag 規則

- 若使用者 tag 1 位，該成員優先為主回應者
- 若使用者 tag 多位，最多選 2 位，並以相關性排序
- 若 tag 成員與問題不完全匹配，可加 1 位更相關角色補位
- 若使用者明確要求只讓某位回答，則只回 1 位

### 6.5 雙人搭配模板

- UX + Researcher：需求模糊、要分辨問題與假設
- UX + PM：把使用者問題收斂成產品方向
- PM + Engineer：討論 MVP、範圍與落地
- UX + UI：從流程走到介面呈現
- UI + Engineer：特定介面互動的技術可行性
- PM + Researcher：決定先驗證什麼

### 6.6 system summary 觸發條件

只有以下情況才加入 system summary：

- 連續多輪都在同一主題
- 已出現初步共識
- 已出現明顯分歧
- 使用者要求整理
- 已接近可生成報告的狀態

system summary 應包含：

- 目前共識
- 尚未解決問題
- 建議下一步

### 6.7 ready_for_report 判斷

以下條件大致成立時，`ready_for_report = true`：

- 核心需求已明確
- 用戶問題已明確
- 功能方向已有初步共識
- 待驗證假設已列出
- 下一步建議已可形成

## 7. 特殊角色機制

### 7.1 特殊角色的生成時機

當 Requirement Analyzer 或 Team Composer 判斷固定職能池不足以覆蓋需求時，可加入特殊角色。

例如：

- AI Workflow Designer
- Growth Strategist
- Service Designer
- Data Analyst

### 7.2 特殊角色需具備的欄位

特殊角色必須和固定角色一樣具備完整設定：

- name
- role_type = custom
- custom_role_label
- background
- tasks
- knowledge
- workflow
- response_format
- tone
- why_this_role
- routing_hints

其中 `routing_hints` 用來說明：

- 這個角色適合處理什麼問題
- 應避免處理什麼問題
- 最常和哪些角色搭配

### 7.3 特殊角色是否走同一套對話邏輯

是。特殊角色生成後，仍然由同一個 Conversation Orchestrator 進行選角與回合控制，不會額外切出另一套對話系統。

也就是說：

- 對話邏輯仍集中在 Orchestrator
- 特殊角色只是 members 陣列中的新增節點
- Orchestrator 會根據其 `tasks`、`knowledge`、`workflow`、`why_this_role`、`routing_hints` 判斷是否讓它出場

因此，特殊角色不是額外平行流程，而是納入同一套會議調度系統。

### 7.4 特殊角色的路由原則

- 特殊角色不應搶走固定角色的基礎職責
- 只有當問題明顯落在其專精領域時才優先出場
- 特殊角色通常作為補位或特定場景主回應者
- 若問題同時涉及產品決策，通常仍需搭配 PM 或 UX

範例：

- 若問題是「這個 AI 工作流怎麼設計比較合理」，可由 AI Workflow Designer + PM
- 若問題是「這個功能如何成長擴散」，可由 Growth Strategist + PM
- 若問題是「這組行為數據代表什麼」，可由 Data Analyst + Researcher 或 PM

## 8. v1 建議實作方式

為了讓 orchestration 穩定，不建議把所有規則只寫在一段大 prompt 裡。建議拆成：

- skill prompt
- role spec
- routing config
- discussion state

其中 routing config 可結構化為 JSON 或資料表。

## 9. 後續建議

下一步最適合補的內容：

1. 四個 skill 的 JSON 輸出 schema
2. 固定角色與特殊角色的 prompt 模板
3. Conversation Orchestrator 的 state machine 規格
4. 專案階段對應的一頁式報告模板規格
