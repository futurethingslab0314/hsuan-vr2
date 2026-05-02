import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFinalizedTeamMember,
  buildTeamComposerInput,
  pickEnglishMemberName,
  type ProjectForTeamGeneration,
  type RoleTemplate,
  type StagePlaybook,
  type TeamComposerBlueprint,
} from "./team-generation.ts";

const projectData: ProjectForTeamGeneration = {
  project: "Health Service Redesign",
  input_prompt_user: "我需要了解健康醫療服務現狀並設計出一個產品",
  input_prompt_goal_user: "找出適合高齡照護情境的服務切入點",
  currentstage_user: "discover",
  project_summary_ai: "聚焦健康醫療服務探索的產品專案。",
  problem_statement_ai: "使用者對照護流程的痛點缺乏系統性整理。",
  target_users_ai: "高齡照護家庭\n第一線照護人員",
  core_goals_ai: "找出服務切入點\n釐清真實痛點",
  constraints_ai: "先做 MVP",
  open_questions_ai: "哪個情境最急迫",
};

const stagePlaybook: StagePlaybook = {
  id: "stage-1",
  stage_key: "discover",
  stage_goal: "理解現況",
  stage_core_principle: "先理解再下判斷",
  stage_behavior_rules: "以探索為主",
  stage_response_pattern: "條列問題與洞察",
  stage_collaboration_flow: "先發散再收斂",
};

const pmTemplate: RoleTemplate = {
  id: "template-pm",
  template_name: "discover_pm",
  role_key: "pm",
  role_display_name: "觀察者",
  role_type_ai: "PM",
  base_tone: "輕鬆、引導式、具備好奇心",
  base_behavior: "廣泛提出各種潛在的使用情境，嚴禁判斷可行性和商業價值",
  base_response_style: "誰會用這個產品？在什麼樣的特殊時刻他們會需要它？",
  base_tasks: "(1) 提出多元的使用情境\n(2) 探討市場的潛在需求",
  base_rules: "禁止收斂；情境優先；避免用術語",
};

const blueprint: TeamComposerBlueprint = {
  template_name: "discover_pm",
  role_key: "pm",
  role_type: "PM",
  custom_role_label: null,
  is_custom_role: false,
  background_focus: "高齡照護家庭在就醫與追蹤之間的服務落差",
  task_adaptations: ["補上居家照護與醫院往返之間的斷點情境"],
  knowledge: ["高齡照護服務旅程", "醫療服務接觸點"],
  rules_additions: ["討論時優先對焦高齡照護家庭的實際場景"],
  workflow: "先盤點現況，再與 Researcher 一起整理洞察。",
  response_format_additions: ["每次至少補充一個照護者視角的例子"],
  tone_additions: ["保持溫和但避免過度抽象"],
  why_this_role: "探索階段需要有人持續打開情境。",
  routing_hints: {
    good_for: ["使用情境探索"],
    avoid_for: ["技術實作細節"],
    pairs_well_with: ["Researcher"],
  },
  display_order: 1,
};

test("buildTeamComposerInput keeps raw prompts alongside analyzed fields", () => {
  const input = buildTeamComposerInput(projectData, stagePlaybook, [pmTemplate]);

  assert.equal(input.original_prompt, projectData.input_prompt_user);
  assert.equal(input.project_goal, projectData.input_prompt_goal_user);
  assert.deepEqual(input.target_users, ["高齡照護家庭", "第一線照護人員"]);
});

test("pickEnglishMemberName always returns an English pool name for the role", () => {
  const name = pickEnglishMemberName("project-123", "PM");

  assert.match(name, /^[A-Za-z]+ [A-Za-z]+$/);
  assert.equal(name, pickEnglishMemberName("project-123", "PM"));
});

test("buildFinalizedTeamMember preserves template skeleton and only appends project-specific detail", () => {
  const member = buildFinalizedTeamMember("project-123", projectData, pmTemplate, blueprint);

  assert.match(member.name, /^[A-Za-z]+ [A-Za-z]+$/);
  assert.match(member.background_identity, /找出適合高齡照護情境的服務切入點/);
  assert.match(member.background_identity, /輕鬆、引導式、具備好奇心/);
  assert.deepEqual(member.tasks.slice(0, 2), ["提出多元的使用情境", "探討市場的潛在需求"]);
  assert.match(member.rules, /禁止收斂；情境優先；避免用術語/);
  assert.match(member.rules, /專案情境補充/);
  assert.match(member.response_format, /誰會用這個產品/);
  assert.match(member.response_format, /此專案回應時請額外包含/);
});
