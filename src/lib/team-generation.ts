export type AllowedRoleType = "PM" | "Researcher" | "UX Designer" | "Engineer";

export type ProjectForTeamGeneration = {
  project: string;
  input_prompt_user: string;
  input_prompt_goal_user: string;
  currentstage_user: string;
  project_summary_ai: string;
  problem_statement_ai: string;
  target_users_ai: string;
  core_goals_ai: string;
  constraints_ai: string;
  open_questions_ai: string;
};

export type StagePlaybook = {
  id: string;
  stage_key: string;
  stage_goal: string;
  stage_core_principle: string;
  stage_behavior_rules: string;
  stage_response_pattern: string;
  stage_collaboration_flow: string;
};

export type RoleTemplate = {
  id: string;
  template_name: string;
  role_key: string;
  role_display_name: string;
  role_type_ai: AllowedRoleType;
  base_tone: string;
  base_behavior: string;
  base_response_style: string;
  base_tasks: string;
  base_rules: string;
};

export type TeamComposerInput = {
  original_prompt: string;
  project_goal: string;
  project_summary: string;
  problem_statement: string;
  target_users: string[];
  core_goals: string[];
  constraints: string[];
  open_questions: string[];
  project_stage: string;
  stage_playbook: {
    stage_goal: string;
    stage_core_principle: string;
    stage_behavior_rules: string;
    stage_response_pattern: string;
    stage_collaboration_flow: string;
  };
  role_templates: Array<{
    template_name: string;
    role_key: string;
    role_display_name: string;
    role_type_ai: AllowedRoleType;
    base_tone: string;
    base_behavior: string;
    base_response_style: string;
    base_tasks: string;
    base_rules: string;
  }>;
};

export type TeamComposerBlueprint = {
  template_name: string;
  role_key: string;
  role_type: AllowedRoleType;
  custom_role_label: string | null;
  is_custom_role: boolean;
  background_focus: string;
  task_adaptations: string[];
  knowledge: string[];
  rules_additions: string[];
  workflow: string;
  response_format_additions: string[];
  tone_additions: string[];
  why_this_role: string;
  routing_hints: {
    good_for: string[];
    avoid_for: string[];
    pairs_well_with: string[];
  };
  display_order: number;
};

export type FinalizedTeamMember = {
  template_name: string;
  role_key: string;
  name: string;
  role_type: AllowedRoleType;
  custom_role_label: string | null;
  is_custom_role: boolean;
  background_identity: string;
  tasks: string[];
  knowledge: string[];
  rules: string;
  workflow: string;
  response_format: string;
  tone: string;
  why_this_role: string;
  routing_hints: {
    good_for: string[];
    avoid_for: string[];
    pairs_well_with: string[];
  };
  display_order: number;
};

const ROLE_NAME_POOLS: Record<AllowedRoleType, string[]> = {
  PM: ["Maya Chen", "Olivia Park", "Sophia Lin", "Chloe Wang", "Avery Lee"],
  Researcher: ["Ethan Wu", "Noah Kim", "Leo Chang", "Ian Hsu", "Ryan Kuo"],
  "UX Designer": ["Emma Liu", "Grace Tsai", "Nora Yeh", "Hannah Wu", "Zoe Cheng"],
  Engineer: ["David Lin", "Lucas Chen", "Owen Huang", "Nathan Ho", "Caleb Su"],
};

function normalizeLine(value: string): string {
  return value.trim().replace(/^[\-\d\.\)\(]+\s*/, "").trim();
}

export function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean);
}

function uniqueLines(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeLine(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function stableHash(value: string): number {
  return Array.from(value).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}

function summarizeTemplateSnippet(value: string): string {
  const firstLine = splitLines(value)[0] ?? value.trim();
  return firstLine.replace(/[。；;，,]+$/, "");
}

export function pickEnglishMemberName(projectId: string, roleType: AllowedRoleType): string {
  const pool = ROLE_NAME_POOLS[roleType];
  const index = stableHash(`${projectId}:${roleType}`) % pool.length;
  return pool[index];
}

export function mergeTemplateList(baseValue: string, additions: string[]): string[] {
  return uniqueLines([...splitLines(baseValue), ...additions]);
}

export function mergeTemplateText(baseValue: string, additions: string[], heading: string): string {
  const base = baseValue.trim();
  const uniqueAdditions = uniqueLines(additions);

  if (!uniqueAdditions.length) return base;

  return `${base}\n\n${heading}\n${uniqueAdditions.map((item) => `- ${item}`).join("\n")}`;
}

export function composeBackgroundIdentity(
  template: RoleTemplate,
  projectData: ProjectForTeamGeneration,
  backgroundFocus: string
): string {
  const focus = backgroundFocus.trim();
  const roleName = template.role_display_name || template.role_type_ai;
  const projectAnchor = projectData.input_prompt_goal_user.trim() || projectData.project_summary_ai.trim();
  const toneAnchor = summarizeTemplateSnippet(template.base_tone);
  const behaviorAnchor = summarizeTemplateSnippet(template.base_behavior);

  return [
    `${roleName}，聚焦於「${projectAnchor}」脈絡中的${focus}。`,
    `角色基調維持 ${toneAnchor}。`,
    `工作習慣維持 ${behaviorAnchor}。`,
  ].join("");
}

export function buildFinalizedTeamMember(
  projectId: string,
  projectData: ProjectForTeamGeneration,
  template: RoleTemplate,
  blueprint: TeamComposerBlueprint
): FinalizedTeamMember {
  return {
    template_name: blueprint.template_name,
    role_key: blueprint.role_key,
    name: pickEnglishMemberName(projectId, blueprint.role_type),
    role_type: blueprint.role_type,
    custom_role_label: blueprint.custom_role_label,
    is_custom_role: blueprint.is_custom_role,
    background_identity: composeBackgroundIdentity(template, projectData, blueprint.background_focus),
    tasks: mergeTemplateList(template.base_tasks, blueprint.task_adaptations),
    knowledge: uniqueLines(blueprint.knowledge),
    rules: mergeTemplateText(template.base_rules, blueprint.rules_additions, "專案情境補充"),
    workflow: blueprint.workflow.trim(),
    response_format: mergeTemplateText(
      template.base_response_style,
      blueprint.response_format_additions,
      "此專案回應時請額外包含"
    ),
    tone: mergeTemplateText(template.base_tone, blueprint.tone_additions, "此專案語氣補充"),
    why_this_role: blueprint.why_this_role.trim(),
    routing_hints: {
      good_for: uniqueLines(blueprint.routing_hints.good_for),
      avoid_for: uniqueLines(blueprint.routing_hints.avoid_for),
      pairs_well_with: uniqueLines(blueprint.routing_hints.pairs_well_with),
    },
    display_order: blueprint.display_order,
  };
}

export function buildTeamComposerInput(
  projectData: ProjectForTeamGeneration,
  stagePlaybook: StagePlaybook,
  roleTemplates: RoleTemplate[]
): TeamComposerInput {
  return {
    original_prompt: projectData.input_prompt_user,
    project_goal: projectData.input_prompt_goal_user,
    project_summary: projectData.project_summary_ai,
    problem_statement: projectData.problem_statement_ai,
    target_users: splitLines(projectData.target_users_ai),
    core_goals: splitLines(projectData.core_goals_ai),
    constraints: splitLines(projectData.constraints_ai),
    open_questions: splitLines(projectData.open_questions_ai),
    project_stage: projectData.currentstage_user,
    stage_playbook: {
      stage_goal: stagePlaybook.stage_goal,
      stage_core_principle: stagePlaybook.stage_core_principle,
      stage_behavior_rules: stagePlaybook.stage_behavior_rules,
      stage_response_pattern: stagePlaybook.stage_response_pattern,
      stage_collaboration_flow: stagePlaybook.stage_collaboration_flow,
    },
    role_templates: roleTemplates.map((template) => ({
      template_name: template.template_name,
      role_key: template.role_key,
      role_display_name: template.role_display_name,
      role_type_ai: template.role_type_ai,
      base_tone: template.base_tone,
      base_behavior: template.base_behavior,
      base_response_style: template.base_response_style,
      base_tasks: template.base_tasks,
      base_rules: template.base_rules,
    })),
  };
}
