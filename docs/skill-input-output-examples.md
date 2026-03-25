# AI Team Builder Skill Input Output Examples

## 1. Requirement Analyzer

### Input example

```json
{
  "original_prompt": "我想做一個讓產品經理、設計師和工程師可以一起跟 AI 討論產品需求的工具，使用者可以先描述專案需求，AI 會組出一個團隊一起開會，最後整理成一份產品策略摘要。",
  "project_goal": "先做出第一版可以驗證這種 AI 團隊協作體驗是否有價值",
  "project_stage": "define",
  "optional_context": "目標使用者是小型產品團隊與接案設計團隊"
}
```

### Output example

```json
{
  "project_summary": "一個讓產品團隊透過 AI 團隊協作方式釐清需求並產出產品策略摘要的工具。",
  "problem_statement": "小型產品與設計團隊在需求探索與方向收斂過程中，缺乏一個能同時提供多職能視角並協助整理結論的輔助工具。",
  "target_users": [
    "小型產品團隊",
    "接案設計團隊",
    "需要快速整理需求方向的 PM 或設計師"
  ],
  "core_goals": [
    "驗證 AI 團隊協作體驗是否能幫助需求收斂",
    "讓使用者在討論中更快釐清產品方向",
    "產出可供後續規劃使用的一頁式摘要"
  ],
  "constraints": [
    "v1 需先聚焦 MVP，不適合涵蓋過多複雜功能",
    "最終產出以輕量摘要為主，不是完整 PRD"
  ],
  "open_questions": [
    "使用者最在意的是討論過程感還是最終文件品質",
    "第一版要支援多少團隊角色",
    "討論結束的判定與摘要生成條件要多嚴格"
  ],
  "recommended_roles": [
    {
      "role_type": "PM",
      "reason": "需要協助收斂功能範圍與 MVP 優先級",
      "priority": "high"
    },
    {
      "role_type": "UX",
      "reason": "需要釐清使用者問題與協作流程價值",
      "priority": "high"
    },
    {
      "role_type": "Engineer",
      "reason": "需要評估 AI 對話與多角色機制的實作可行性",
      "priority": "high"
    },
    {
      "role_type": "UI",
      "reason": "需要思考會議式互動介面的呈現方式",
      "priority": "medium"
    }
  ],
  "analysis_confidence": 0.86
}
```

## 2. Team Composer

### Input example

```json
{
  "project_summary": "一個讓產品團隊透過 AI 團隊協作方式釐清需求並產出產品策略摘要的工具。",
  "problem_statement": "小型產品與設計團隊在需求探索與方向收斂過程中，缺乏一個能同時提供多職能視角並協助整理結論的輔助工具。",
  "target_users": [
    "小型產品團隊",
    "接案設計團隊"
  ],
  "core_goals": [
    "驗證 AI 團隊協作體驗是否有價值",
    "幫助使用者快速收斂產品方向"
  ],
  "constraints": [
    "v1 聚焦 MVP",
    "輸出以一頁式摘要為主"
  ],
  "open_questions": [
    "第一版應支援哪些角色",
    "摘要生成要多輕量"
  ],
  "recommended_roles": [
    {
      "role_type": "PM",
      "reason": "MVP 收斂",
      "priority": "high"
    },
    {
      "role_type": "UX",
      "reason": "需求釐清",
      "priority": "high"
    },
    {
      "role_type": "Engineer",
      "reason": "技術可行性",
      "priority": "high"
    },
    {
      "role_type": "UI",
      "reason": "介面呈現",
      "priority": "medium"
    }
  ],
  "project_stage": "define"
}
```

### Output example

```json
{
  "team_rationale": "此專案目前處於 MVP 規劃階段，因此團隊需要同時涵蓋需求釐清、範圍收斂、介面呈現與技術可行性。",
  "members": [
    {
      "id": "pm-1",
      "name": "Maya Chen",
      "role_type": "PM",
      "custom_role_label": null,
      "is_custom_role": false,
      "background": {
        "years": "8 years",
        "experience": "SaaS product lead",
        "profession": "Product Management",
        "expertise": ["MVP planning", "prioritization", "roadmapping"]
      },
      "tasks": [
        "收斂 MVP 範圍",
        "排序功能優先級",
        "推進決策"
      ],
      "knowledge": [
        "product strategy",
        "lean prioritization",
        "roadmap planning"
      ],
      "workflow": "與 UX 一起釐清需求，與 Engineer 一起評估可行性。",
      "response_format": "重點條列與決策建議",
      "tone": "清楚、果斷、聚焦取捨",
      "why_this_role": "目前最需要先決定第一版做什麼，因此 PM 是核心角色。",
      "routing_hints": {
        "good_for": ["feature prioritization", "MVP scope", "decision framing"],
        "avoid_for": ["deep visual polish", "research methodology details"],
        "pairs_well_with": ["UX", "Engineer"]
      }
    },
    {
      "id": "ux-1",
      "name": "Alex Lin",
      "role_type": "UX",
      "custom_role_label": null,
      "is_custom_role": false,
      "background": {
        "years": "7 years",
        "experience": "UX strategist for digital products",
        "profession": "User Experience",
        "expertise": ["user journeys", "problem framing"]
      },
      "tasks": [
        "釐清使用者問題",
        "定義需求脈絡",
        "檢查體驗合理性"
      ],
      "knowledge": [
        "user-centered design",
        "journey mapping",
        "problem framing"
      ],
      "workflow": "與 PM 一起收斂方向，與 UI 一起轉成介面流程。",
      "response_format": "問題分析與流程建議",
      "tone": "理性、使用者導向、分析型",
      "why_this_role": "這個產品核心是會議協作體驗，必須先確認真正的使用者需求。",
      "routing_hints": {
        "good_for": ["user problems", "workflow clarity", "experience risks"],
        "avoid_for": ["implementation sequencing", "low-level tech tradeoffs"],
        "pairs_well_with": ["PM", "UI", "Researcher"]
      }
    },
    {
      "id": "eng-1",
      "name": "David Wu",
      "role_type": "Engineer",
      "custom_role_label": null,
      "is_custom_role": false,
      "background": {
        "years": "9 years",
        "experience": "Full-stack product engineer",
        "profession": "Software Engineering",
        "expertise": ["web apps", "AI integration", "system architecture"]
      },
      "tasks": [
        "評估技術可行性",
        "拆解落地方式",
        "指出系統風險"
      ],
      "knowledge": [
        "system design",
        "AI integration",
        "frontend-backend architecture"
      ],
      "workflow": "與 PM 討論 MVP 可行性，與 UX/UI 對齊產品落地限制。",
      "response_format": "可行性分析與落地建議",
      "tone": "務實、冷靜、風險導向",
      "why_this_role": "多角色協作與摘要生成都涉及實作限制，需要工程視角支撐。",
      "routing_hints": {
        "good_for": ["technical feasibility", "implementation tradeoffs", "system constraints"],
        "avoid_for": ["user interview interpretation", "brand expression"],
        "pairs_well_with": ["PM", "UI"]
      }
    }
  ]
}
```

## 3. Conversation Orchestrator

### Input example

```json
{
  "project_brief": {
    "project_summary": "一個讓產品團隊透過 AI 團隊協作方式釐清需求並產出產品策略摘要的工具。",
    "problem_statement": "小型團隊缺乏多職能視角協作與整理結論的工具。"
  },
  "project_stage": "define",
  "members": [
    {
      "id": "pm-1",
      "name": "Maya Chen",
      "role_type": "PM",
      "tasks": ["收斂 MVP 範圍", "排序功能優先級"],
      "routing_hints": {
        "good_for": ["feature prioritization", "MVP scope"],
        "pairs_well_with": ["UX", "Engineer"]
      }
    },
    {
      "id": "ux-1",
      "name": "Alex Lin",
      "role_type": "UX",
      "tasks": ["釐清使用者問題", "檢查體驗合理性"],
      "routing_hints": {
        "good_for": ["user problems", "workflow clarity"],
        "pairs_well_with": ["PM", "UI"]
      }
    },
    {
      "id": "eng-1",
      "name": "David Wu",
      "role_type": "Engineer",
      "tasks": ["評估技術可行性", "指出系統風險"],
      "routing_hints": {
        "good_for": ["technical feasibility", "implementation tradeoffs"],
        "pairs_well_with": ["PM"]
      }
    }
  ],
  "chat_history": [
    {
      "speaker_type": "user",
      "content": "我想先知道第一版到底要不要先做多人 AI 角色切換。"
    }
  ],
  "conversation_summary": "使用者正在討論 MVP 要先聚焦哪些核心功能。",
  "user_message": "我覺得多人角色切換很酷，但會不會第一版太重？",
  "tagged_members": [],
  "decision_state": {
    "confirmed_points": [],
    "open_questions": ["第一版是否要完整支援多人角色切換"],
    "assumptions": ["多人角色切換會提升體驗價值"]
  },
  "report_readiness": false
}
```

### Output example

```json
{
  "message_type": "feature_scope",
  "discussion_stage": "aligning",
  "selected_speakers": [
    {
      "member_id": "pm-1",
      "role_type": "PM",
      "speaker_role": "primary",
      "function": "answer"
    },
    {
      "member_id": "eng-1",
      "role_type": "Engineer",
      "speaker_role": "secondary",
      "function": "tradeoff"
    }
  ],
  "speaker_order": ["pm-1", "eng-1"],
  "responses": [
    {
      "member_id": "pm-1",
      "name": "Maya Chen",
      "role": "PM",
      "content": "如果我們站在 MVP 的角度，我會建議先不要把完整多人角色切換做得太重，而是先驗證使用者是否真的需要『多視角協作感』。第一版可以先保留團隊感與不同角色回應，但控制在較簡化的互動方式。"
    },
    {
      "member_id": "eng-1",
      "name": "David Wu",
      "role": "Engineer",
      "content": "從實作面來看，完整多人角色切換會增加上下文管理、角色路由和前端互動複雜度。若第一版先做簡化版 orchestrator，仍能保留核心體驗，同時降低技術風險。"
    }
  ],
  "system_summary": {
    "enabled": true,
    "content": "目前共識偏向：第一版應保留 AI 團隊協作感，但不必一開始就做完整複雜的多人角色切換機制。"
  },
  "discussion_state_update": {
    "confirmed_points": [
      "MVP 應先驗證協作感，而不是追求完整角色機制"
    ],
    "open_questions": [
      "簡化版多人協作體驗的最小形式應該長什麼樣"
    ],
    "assumptions": [
      "簡化版角色協作已足夠讓使用者感受到價值"
    ],
    "next_focus": "定義簡化版多人協作互動的最小範圍"
  },
  "follow_up_questions": [
    "如果只保留最核心的協作感，你最想保留哪一個互動？",
    "你認為使用者需要明確切換角色，還是只要看到不同角色的回應就夠？"
  ],
  "ready_for_report": false
}
```

## 4. Report Generator

### Input example

```json
{
  "original_prompt": "我想做一個讓產品經理、設計師和工程師可以一起跟 AI 討論產品需求的工具。",
  "project_goal": "驗證 AI 團隊協作體驗是否有價值",
  "project_stage": "define",
  "analysis_result": {
    "problem_statement": "小型團隊缺乏多職能視角協作與整理結論的工具。",
    "target_users": ["小型產品團隊", "接案設計團隊"]
  },
  "final_members": [
    { "name": "Maya Chen", "role_type": "PM" },
    { "name": "Alex Lin", "role_type": "UX" },
    { "name": "David Wu", "role_type": "Engineer" }
  ],
  "chat_summary": "團隊傾向第一版先聚焦 AI 團隊協作感與需求收斂，不把多人角色切換做得過重。",
  "decision_points": [
    "MVP 先驗證協作感，不追求完整多人機制",
    "保留多角色回應，但互動方式要簡化",
    "下一步需要定義最小可行的協作互動流程"
  ]
}
```

### Output example

```json
{
  "report_title": "AI Team Collaboration Tool MVP Strategy Summary",
  "report_type": "one_page_product_strategy",
  "project_stage": "define",
  "executive_summary": "本專案的第一階段應聚焦驗證 AI 團隊協作體驗是否能幫助小型產品與設計團隊更快收斂需求。MVP 不應一開始投入過多成本在完整多人角色切換，而應優先保留多視角回應與討論整理的核心價值。",
  "sections": [
    {
      "section_key": "core_need",
      "title": "Core Need",
      "content": "使用者需要一個能快速整合多職能觀點、協助需求收斂並整理結論的協作工具。"
    },
    {
      "section_key": "user_problem",
      "title": "User Problem",
      "content": "小型團隊缺乏足夠的跨職能討論資源，常在需求探索與方向收斂上花費大量時間。"
    },
    {
      "section_key": "product_direction",
      "title": "Product Direction",
      "content": "MVP 應優先提供需求輸入、AI 團隊回應、基礎協作對話與討論摘要生成功能，並以簡化版多角色互動體驗驗證核心價值。"
    },
    {
      "section_key": "assumptions",
      "title": "Key Assumptions",
      "content": "目前假設使用者真正重視的是多視角協作感，而不是完整複雜的角色控制機制。此假設仍需透過實際使用驗證。"
    },
    {
      "section_key": "next_steps",
      "title": "Next Steps",
      "content": "定義簡化版多人協作流程、確認 MVP 功能範圍、設計最小可行互動介面，並規劃第一輪使用者測試。"
    }
  ],
  "risks": [
    "可能高估了多人角色體驗對使用者的吸引力",
    "若摘要品質不穩，可能削弱整體產品價值感"
  ],
  "next_steps": [
    "定義 MVP 的最小功能組合",
    "完成簡化版 AI 團隊互動流程草案",
    "安排第一輪概念測試"
  ]
}
```

## 5. Skill 串接關係總結

整體資料流如下：

1. 使用者原始需求輸入
2. `Requirement Analyzer` 轉成結構化 brief
3. `Team Composer` 根據 brief 產生團隊角色
4. `Conversation Orchestrator` 根據對話內容動態選角與更新狀態
5. `Report Generator` 把分析結果與對話結論整理成一頁式摘要

