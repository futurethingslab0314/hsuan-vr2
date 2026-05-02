import { NextResponse } from "next/server";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { notion, getNotionDatabaseId } from "@/src/lib/notion";
import { openai } from "@/src/lib/openai";

type DbProperty = {
  id?: string;
  type: string;
  rich_text?: Array<{ plain_text?: string }>;
  title?: Array<{ plain_text?: string }>;
  select?: { name?: string | null; options?: Array<{ name: string }> } | null;
  status?: { name?: string | null; options?: Array<{ name: string }> } | null;
  relation?: Array<{ id: string }>;
};

type NotionCreatePageProperties = NonNullable<Parameters<typeof notion.pages.create>[0]["properties"]>;

type ProjectForTeamGeneration = {
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

type StagePlaybook = {
  id: string;
  stage_key: string;
  stage_goal: string;
  stage_core_principle: string;
  stage_behavior_rules: string;
  stage_response_pattern: string;
  stage_collaboration_flow: string;
};

type RoleTemplate = {
  id: string;
  template_name: string;
  role_key: string;
  role_display_name: string;
  role_type_ai: string;
  base_tone: string;
  base_behavior: string;
  base_response_style: string;
  base_tasks: string;
  base_rules: string;
};

type TeamComposerInput = {
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
    role_type_ai: string;
    base_tone: string;
    base_behavior: string;
    base_response_style: string;
    base_tasks: string;
    base_rules: string;
  }>;
};

type TeamComposerModelMember = {
  template_name: string;
  role_key: string;
  custom_role_label: string | null;
  is_custom_role: boolean;
  background_identity_focus: string;
  task_focus: string[];
  knowledge: string[];
  rules_focus: string;
  workflow: string;
  response_format_focus: string;
  why_this_role: string;
  routing_hints: {
    good_for: string[];
    avoid_for: string[];
    pairs_well_with: string[];
  };
  display_order: number;
};

type TeamComposerMember = {
  template_name: string;
  role_key: string;
  name: string;
  role_type: "PM" | "Researcher" | "UX Designer" | "Engineer";
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

type TeamComposerResult = {
  team_rationale: string;
  members: TeamComposerModelMember[];
};

type AllowedRoleType = "PM" | "Researcher" | "UX Designer" | "Engineer";

class TeamGenerationRouteError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "TeamGenerationRouteError";
    this.statusCode = statusCode;
  }
}

function normalizeRoleType(value: string): AllowedRoleType {
  const normalized = value.trim().toLowerCase();

  if (normalized === "pm" || normalized === "product manager") return "PM";
  if (normalized === "researcher" || normalized === "ux strategist") return "Researcher";
  if (normalized === "ux designer" || normalized === "ux" || normalized === "ui" || normalized === "ui designer") return "UX Designer";
  if (normalized === "engineer" || normalized === "prototyper") return "Engineer";

  throw new TeamGenerationRouteError(`Unsupported role_type_ai value: ${value}`, 400);
}

const ROLE_NAME_POOL = {
  pm: ["Maya Chen", "Olivia Lin", "Emma Wang", "Sophia Wu"],
  researcher: ["Alex Lin", "Ethan Chang", "Noah Liu", "Daniel Hsu"],
  ux: ["Sarah Miller", "Chloe Chen", "Grace Lee", "Hannah Lin"],
  engineer: ["David Wu", "Ryan Chen", "Kevin Lin", "Jason Huang"],
} as const;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeRoleKey(value: string): "pm" | "researcher" | "ux" | "engineer" {
  const normalized = normalize(value);

  if (normalized === "pm") return "pm";
  if (normalized === "researcher") return "researcher";
  if (normalized === "ux" || normalized === "ux_designer" || normalized === "ui") return "ux";
  if (normalized === "engineer") return "engineer";

  throw new TeamGenerationRouteError(`Unsupported role_key value: ${value}`, 400);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickEnglishName(roleKey: string, projectId: string): string {
  const normalizedRoleKey = normalizeRoleKey(roleKey);
  const pool = ROLE_NAME_POOL[normalizedRoleKey];
  const index = hashString(`${projectId}:${normalizedRoleKey}`) % pool.length;
  return pool[index];
}

function buildTeamComposerResultSchema(roleTemplates: RoleTemplate[]) {
  const templateNames = roleTemplates.map((template) => template.template_name.trim());
  const roleKeys = roleTemplates.map((template) => normalizeRoleKey(template.role_key));

  if (templateNames.length !== 4 || roleKeys.length !== 4) {
    throw new TeamGenerationRouteError("Role templates are incomplete for current project stage", 400);
  }

  return z.object({
    team_rationale: z.string(),
    members: z.array(
      z.object({
        template_name: z.enum([
          templateNames[0],
          templateNames[1],
          templateNames[2],
          templateNames[3],
        ] as [string, string, string, string]),
        role_key: z.enum([
          roleKeys[0],
          roleKeys[1],
          roleKeys[2],
          roleKeys[3],
        ] as ["pm" | "researcher" | "ux" | "engineer", "pm" | "researcher" | "ux" | "engineer", "pm" | "researcher" | "ux" | "engineer", "pm" | "researcher" | "ux" | "engineer"]),
        custom_role_label: z.string().nullable(),
        is_custom_role: z.boolean(),
        background_identity_focus: z.string(),
        task_focus: z.array(z.string()).min(1).max(3),
        knowledge: z.array(z.string()).min(1),
        rules_focus: z.string(),
        workflow: z.string(),
        response_format_focus: z.string(),
        why_this_role: z.string(),
        routing_hints: z.object({
          good_for: z.array(z.string()),
          avoid_for: z.array(z.string()),
          pairs_well_with: z.array(z.string()),
        }),
        display_order: z.number().int().min(1).max(4),
      })
    ).length(4),
  });
}

function buildBackgroundIdentityFromTemplate(template: RoleTemplate, backgroundIdentityFocus: string): string {
  const base = [template.role_display_name, template.base_tone, template.base_behavior]
    .map((item) => item.trim())
    .filter(Boolean)
    .join("。");

  if (!backgroundIdentityFocus.trim()) return base;
  return `${base}\n\n本專案聚焦：${backgroundIdentityFocus.trim()}`;
}

function buildRoleTargetFromTemplate(template: RoleTemplate, taskFocus: string[]): string[] {
  const focusLines = taskFocus.map((item) => item.trim()).filter(Boolean).map((item) => `專案聚焦：${item}`);
  return [template.base_tasks.trim(), ...focusLines].filter(Boolean);
}

function buildRoleRulesFromTemplate(template: RoleTemplate, rulesFocus: string): string {
  const base = template.base_rules.trim();
  if (!rulesFocus.trim()) return base;
  return `${base}\n\n本專案補充原則：${rulesFocus.trim()}`;
}

function buildRoleResponseFormatFromTemplate(template: RoleTemplate, responseFormatFocus: string): string {
  const base = template.base_response_style.trim();
  if (!responseFormatFocus.trim()) return base;
  return `${base}\n\n本專案輸出聚焦：${responseFormatFocus.trim()}`;
}

function splitLines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function joinLines(values: string[]): string {
  return values.join("\n");
}

function splitRichTextContent(value: string, maxLength = 2000) {
  if (value.length <= maxLength) return [value];

  const chunks: string[] = [];
  let start = 0;

  while (start < value.length) {
    chunks.push(value.slice(start, start + maxLength));
    start += maxLength;
  }

  return chunks;
}

function findPropertyName(properties: Record<string, DbProperty>, candidates: string[], expectedType?: string): string | undefined {
  const normalizedCandidates = new Set(candidates.map(normalize));
  const exactMatch = Object.entries(properties).find(([name, prop]) => {
    const typeMatches = expectedType ? prop.type === expectedType : true;
    return typeMatches && normalizedCandidates.has(normalize(name));
  });
  if (exactMatch) return exactMatch[0];

  const partialMatch = Object.entries(properties).find(([name, prop]) => {
    const typeMatches = expectedType ? prop.type === expectedType : true;
    const normalizedName = normalize(name);
    return typeMatches && Array.from(normalizedCandidates).some((candidate) => normalizedName.includes(candidate));
  });

  return partialMatch?.[0];
}

function getRichTextValue(properties: Record<string, DbProperty>, propertyName: string | undefined): string {
  if (!propertyName) return "";
  const richText = properties[propertyName]?.rich_text ?? [];
  return richText.map((item) => item.plain_text ?? "").join("").trim();
}

function getTitleValue(properties: Record<string, DbProperty>, propertyName: string | undefined): string {
  if (!propertyName) return "";
  const title = properties[propertyName]?.title ?? [];
  return title.map((item) => item.plain_text ?? "").join("").trim();
}

function getSelectValue(properties: Record<string, DbProperty>, propertyName: string | undefined): string {
  if (!propertyName) return "";
  const property = properties[propertyName];
  if (!property) return "";
  return property.select?.name?.trim() ?? property.status?.name?.trim() ?? "";
}

function buildRichTextProperty(value: string) {
  return {
    rich_text: splitRichTextContent(value).map((chunk) => ({
      type: "text" as const,
      text: { content: chunk },
    })),
  };
}

function buildTitleProperty(value: string) {
  return { title: [{ type: "text" as const, text: { content: value } }] };
}

function buildCheckboxProperty(value: boolean) {
  return { checkbox: value };
}

function buildNumberProperty(value: number) {
  return { number: value };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new TeamGenerationRouteError(`Missing required environment variable: ${name}`, 500);
  }
  return value;
}

async function getProjectPage(projectId: string) {
  try {
    return await notion.pages.retrieve({ page_id: projectId });
  } catch (error) {
    console.error("[getProjectPage team-members/generate]", error);
    throw new TeamGenerationRouteError("Project not found", 404);
  }
}

function extractProjectForTeamGeneration(projectPage: Awaited<ReturnType<typeof notion.pages.retrieve>>): ProjectForTeamGeneration {
  if (!("properties" in projectPage)) {
    throw new TeamGenerationRouteError("Project page response is missing properties", 500);
  }

  const properties = projectPage.properties as Record<string, DbProperty>;
  const projectPropertyName = findPropertyName(properties, ["project"], "title") ?? findPropertyName(properties, ["project"], "rich_text");
  const inputPromptUserPropertyName = findPropertyName(properties, ["input_prompt_user"], "rich_text");
  const inputPromptGoalUserPropertyName = findPropertyName(properties, ["input_prompt_goal_user"], "rich_text");
  const currentStageUserPropertyName = findPropertyName(properties, ["currentstage_user"], "select");
  const projectSummaryPropertyName = findPropertyName(properties, ["project_summary_ai"], "rich_text");
  const problemStatementPropertyName = findPropertyName(properties, ["problem_statement_ai"], "rich_text");
  const targetUsersPropertyName = findPropertyName(properties, ["target_users_ai"], "rich_text");
  const coreGoalsPropertyName = findPropertyName(properties, ["core_goals_ai"], "rich_text");
  const constraintsPropertyName = findPropertyName(properties, ["constraints_ai"], "rich_text");
  const openQuestionsPropertyName = findPropertyName(properties, ["open_questions_ai"], "rich_text");

  return {
    project: getTitleValue(properties, projectPropertyName) || getRichTextValue(properties, projectPropertyName),
    input_prompt_user: getRichTextValue(properties, inputPromptUserPropertyName),
    input_prompt_goal_user: getRichTextValue(properties, inputPromptGoalUserPropertyName),
    currentstage_user: getSelectValue(properties, currentStageUserPropertyName),
    project_summary_ai: getRichTextValue(properties, projectSummaryPropertyName),
    problem_statement_ai: getRichTextValue(properties, problemStatementPropertyName),
    target_users_ai: getRichTextValue(properties, targetUsersPropertyName),
    core_goals_ai: getRichTextValue(properties, coreGoalsPropertyName),
    constraints_ai: getRichTextValue(properties, constraintsPropertyName),
    open_questions_ai: getRichTextValue(properties, openQuestionsPropertyName),
  };
}

function validateProjectForTeamGeneration(projectData: ProjectForTeamGeneration) {
  if (!projectData.project_summary_ai || !projectData.problem_statement_ai || !projectData.currentstage_user) {
    throw new TeamGenerationRouteError("Project is missing required analysis fields for team generation", 400);
  }
}

function extractStagePlaybook(page: Awaited<ReturnType<typeof notion.dataSources.query>>["results"][number]): StagePlaybook {
  if (!("properties" in page)) {
    throw new TeamGenerationRouteError("Stage playbook page response is missing properties", 500);
  }
  const properties = page.properties as Record<string, DbProperty>;
  const stageKeyPropertyName = findPropertyName(properties, ["stage_key"], "title") ?? findPropertyName(properties, ["stage_key"], "rich_text");
  const stageGoalPropertyName = findPropertyName(properties, ["stage_goal"], "rich_text");
  const stageCorePrinciplePropertyName = findPropertyName(properties, ["stage_core_principle"], "rich_text");
  const stageBehaviorRulesPropertyName = findPropertyName(properties, ["stage_behavior_rules"], "rich_text");
  const stageResponsePatternPropertyName = findPropertyName(properties, ["stage_response_pattern"], "rich_text");
  const stageCollaborationFlowPropertyName = findPropertyName(properties, ["stage_collaboration_flow"], "rich_text");

  return {
    id: page.id,
    stage_key: getTitleValue(properties, stageKeyPropertyName) || getRichTextValue(properties, stageKeyPropertyName),
    stage_goal: getRichTextValue(properties, stageGoalPropertyName),
    stage_core_principle: getRichTextValue(properties, stageCorePrinciplePropertyName),
    stage_behavior_rules: getRichTextValue(properties, stageBehaviorRulesPropertyName),
    stage_response_pattern: getRichTextValue(properties, stageResponsePatternPropertyName),
    stage_collaboration_flow: getRichTextValue(properties, stageCollaborationFlowPropertyName),
  };
}

function extractRoleTemplate(page: Awaited<ReturnType<typeof notion.dataSources.query>>["results"][number]): RoleTemplate {
  if (!("properties" in page)) {
    throw new TeamGenerationRouteError("Role template page response is missing properties", 500);
  }
  const properties = page.properties as Record<string, DbProperty>;
  const templateNamePropertyName = findPropertyName(properties, ["template_name"], "title") ?? findPropertyName(properties, ["template_name"], "rich_text");
  const roleKeyPropertyName = findPropertyName(properties, ["role_key"], "select") ?? findPropertyName(properties, ["role_key"], "rich_text");
  const roleDisplayNamePropertyName = findPropertyName(properties, ["role_display_name"], "rich_text");
  const roleTypePropertyName = findPropertyName(properties, ["role_type_ai"], "select") ?? findPropertyName(properties, ["role_type_ai"], "rich_text");
  const baseTonePropertyName = findPropertyName(properties, ["base_tone"], "rich_text");
  const baseBehaviorPropertyName = findPropertyName(properties, ["base_behavior"], "rich_text");
  const baseResponseStylePropertyName = findPropertyName(properties, ["base_response_style"], "rich_text");
  const baseTasksPropertyName = findPropertyName(properties, ["base_tasks"], "rich_text");
  const baseRulesPropertyName = findPropertyName(properties, ["base_rules"], "rich_text");

  return {
    id: page.id,
    template_name: getTitleValue(properties, templateNamePropertyName) || getRichTextValue(properties, templateNamePropertyName),
    role_key: getSelectValue(properties, roleKeyPropertyName) || getRichTextValue(properties, roleKeyPropertyName),
    role_display_name: getRichTextValue(properties, roleDisplayNamePropertyName),
    role_type_ai: normalizeRoleType(getSelectValue(properties, roleTypePropertyName) || getRichTextValue(properties, roleTypePropertyName)),
    base_tone: getRichTextValue(properties, baseTonePropertyName),
    base_behavior: getRichTextValue(properties, baseBehaviorPropertyName),
    base_response_style: getRichTextValue(properties, baseResponseStylePropertyName),
    base_tasks: getRichTextValue(properties, baseTasksPropertyName),
    base_rules: getRichTextValue(properties, baseRulesPropertyName),
  };
}

async function getStagePlaybookByStageKey(stageKey: string): Promise<StagePlaybook> {
  const databaseId = getRequiredEnv("NOTION_STAGE_PLAYBOOK_DB_ID");
  const db = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in db) || !db.data_sources?.length) {
    throw new TeamGenerationRouteError("STAGE_PLAYBOOK database is missing data source metadata", 500);
  }

  const result = await notion.dataSources.query({
    data_source_id: db.data_sources[0].id,
    filter: {
      property: "stage_key",
      title: { equals: stageKey },
    },
    page_size: 1,
  });

  if (!result.results.length) {
    throw new TeamGenerationRouteError("Stage playbook not found for current project stage", 404);
  }

  return extractStagePlaybook(result.results[0]);
}

async function listRoleTemplatesByStagePlaybookId(stagePlaybookId: string): Promise<RoleTemplate[]> {
  const databaseId = getRequiredEnv("NOTION_ROLE_TEMPLATE_DB_ID");
  const db = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in db) || !db.data_sources?.length) {
    throw new TeamGenerationRouteError("ROLE_TEMPLATE database is missing data source metadata", 500);
  }

  const result = await notion.dataSources.query({
    data_source_id: db.data_sources[0].id,
    filter: {
      property: "stage_key",
      relation: { contains: stagePlaybookId },
    },
    page_size: 10,
  });

  const templates = result.results.map(extractRoleTemplate);
  if (templates.length !== 4) {
    throw new TeamGenerationRouteError("Role templates are incomplete for current project stage", 400);
  }

  const roleKeys = templates.map((template) => normalize(template.role_key)).filter(Boolean);
  const requiredRoleKeys = ["pm", "researcher", "ux", "engineer"];

  if (new Set(roleKeys).size !== 4) {
    throw new TeamGenerationRouteError("Role templates are incomplete for current project stage", 400);
  }

  for (const requiredRoleKey of requiredRoleKeys) {
    if (!roleKeys.includes(requiredRoleKey)) {
      throw new TeamGenerationRouteError("Role templates are incomplete for current project stage", 400);
    }
  }

  return templates.sort((a, b) => a.role_key.localeCompare(b.role_key));
}

function buildTeamComposerInput(
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

async function runTeamComposerWithTemplates(
  projectData: ProjectForTeamGeneration,
  stagePlaybook: StagePlaybook,
  roleTemplates: RoleTemplate[]
): Promise<TeamComposerResult> {
  const input = buildTeamComposerInput(projectData, stagePlaybook, roleTemplates);
  const teamComposerResultSchema = buildTeamComposerResultSchema(roleTemplates);

  const response = await openai.responses.parse({
    model: "gpt-4o-2024-08-06",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are Team Composer for AI Team Builder.",
              "Your task is NOT to invent a new team from scratch.",
              "Your task is to adapt exactly four provided stage-role templates into project-specific team members.",
              "You must preserve the provided role set and map each generated member to one provided template.",
              "Return exactly 4 members.",
              "Each member must use one of the provided template_name values.",
              "Each member must use one of the provided role_key values.",
              "Do not add extra roles.",
              "Do not remove any role.",
              "Do not output person names. The system will assign English names separately.",
              "Do not rewrite the full template content.",
              "For background_identity_focus, output only the project-specific addition to the template persona.",
              "For task_focus, output only 1 to 3 project-specific emphasis points that will be appended to the template task skeleton.",
              "For rules_focus, output only the project-specific addition to the template rules.",
              "For response_format_focus, output only the project-specific addition to the template response style.",
              "workflow can be project-specific, but should stay consistent with the stage collaboration logic.",
              "Use both the raw user prompt and the analyzed project summary.",
              "All output must be written in Traditional Chinese used in Taiwan.",
              "Do not write English unless the user explicitly asks for English.",
              "Keep the stage persona logic strong and distinct.",
            ].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(input, null, 2),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(teamComposerResultSchema, "team_composer_result"),
    },
  });

  const parsed = response.output_parsed;

  if (!parsed) {
    throw new TeamGenerationRouteError("Team Composer returned no structured output", 500);
  }

  return parsed satisfies TeamComposerResult;
}

function buildFinalTeamMembers(
  projectId: string,
  modelMembers: TeamComposerModelMember[],
  roleTemplates: RoleTemplate[]
): TeamComposerMember[] {
  return modelMembers.map((member) => {
    const normalizedMemberTemplateName = member.template_name.trim();
    const normalizedMemberRoleKey = normalizeRoleKey(member.role_key);

    const templateRecord =
      roleTemplates.find((template) => template.template_name.trim() === normalizedMemberTemplateName) ??
      roleTemplates.find((template) => normalizeRoleKey(template.role_key) === normalizedMemberRoleKey);

    if (!templateRecord) {
      throw new TeamGenerationRouteError("Generated member cannot be mapped to a role template", 500);
    }

    return {
      template_name: templateRecord.template_name,
      role_key: templateRecord.role_key,
      name: pickEnglishName(templateRecord.role_key, projectId),
      role_type: normalizeRoleType(templateRecord.role_type_ai),
      custom_role_label: member.custom_role_label,
      is_custom_role: member.is_custom_role,
      background_identity: buildBackgroundIdentityFromTemplate(templateRecord, member.background_identity_focus),
      tasks: buildRoleTargetFromTemplate(templateRecord, member.task_focus),
      knowledge: member.knowledge,
      rules: buildRoleRulesFromTemplate(templateRecord, member.rules_focus),
      workflow: member.workflow,
      response_format: buildRoleResponseFormatFromTemplate(templateRecord, member.response_format_focus),
      tone: templateRecord.base_tone,
      why_this_role: member.why_this_role,
      routing_hints: member.routing_hints,
      display_order: member.display_order,
    };
  });
}

async function listExistingTeamMembers(projectId: string) {
  const databaseId = getNotionDatabaseId("teamMembers");
  const db = await notion.databases.retrieve({ database_id: databaseId });

  if (!("data_sources" in db) || !db.data_sources?.length) {
    throw new TeamGenerationRouteError("TEAM_MEMBER database is missing data source metadata", 500);
  }

  const result = await notion.dataSources.query({
    data_source_id: db.data_sources[0].id,
    filter: {
      property: "project",
      relation: { contains: projectId },
    },
    page_size: 10,
  });

  return result.results;
}

function buildTeamMemberCreatePayload(
  projectId: string,
  member: TeamComposerMember,
  templateRecord: RoleTemplate,
  stageKey: string
) {
  const payload: NotionCreatePageProperties = {
    member_name: buildTitleProperty(member.name),
    project: { relation: [{ id: projectId }] },
    role_template: { relation: [{ id: templateRecord.id }] },
    role_type_ai: { select: { name: templateRecord.role_type_ai } },
    custom_role_label_ai: buildRichTextProperty(member.custom_role_label ?? ""),
    is_custom_role: buildCheckboxProperty(member.is_custom_role),
    role_background_identity: buildRichTextProperty(member.background_identity),
    role_target: buildRichTextProperty(joinLines(member.tasks)),
    role_knowledge_reference: buildRichTextProperty(joinLines(member.knowledge)),
    role_rules: buildRichTextProperty(member.rules),
    role_workflow: buildRichTextProperty(member.workflow),
    role_response_format: buildRichTextProperty(member.response_format),
    role_tone: buildRichTextProperty(member.tone),
    why_this_role: buildRichTextProperty(member.why_this_role),
    routing_good_for: buildRichTextProperty(joinLines(member.routing_hints.good_for)),
    routing_avoid_for: buildRichTextProperty(joinLines(member.routing_hints.avoid_for)),
    routing_pairs_well_with: buildRichTextProperty(joinLines(member.routing_hints.pairs_well_with)),
    display_order: buildNumberProperty(member.display_order),
    template_name: buildRichTextProperty(templateRecord.template_name),
    stage_key: { select: { name: stageKey } },
  };

  return payload;
}

function mapCreatedMemberResponse(pageId: string, member: TeamComposerMember) {
  return {
    member_id: pageId,
    member_name: member.name,
    role_type_ai: member.role_type,
    is_custom_role: member.is_custom_role,
    role_background_identity: member.background_identity,
    role_target: joinLines(member.tasks),
    role_knowledge_reference: joinLines(member.knowledge),
    role_rules: member.rules,
    role_workflow: member.workflow,
    role_response_format: member.response_format,
    role_tone: member.tone,
    display_order: member.display_order,
  };
}

async function createTeamMembers(projectId: string, stageKey: string, members: TeamComposerMember[], roleTemplates: RoleTemplate[]) {
  const databaseId = getNotionDatabaseId("teamMembers");
  const createdMembers = [];

  for (const member of members) {
    const normalizedMemberTemplateName = member.template_name.trim();
    const normalizedMemberRoleKey = normalizeRoleKey(member.role_key);

    const templateRecord =
      roleTemplates.find((template) => template.template_name.trim() === normalizedMemberTemplateName) ??
      roleTemplates.find((template) => normalizeRoleKey(template.role_key) === normalizedMemberRoleKey);

    if (!templateRecord) {
      throw new TeamGenerationRouteError("Generated member cannot be mapped to a role template", 500);
    }

    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: buildTeamMemberCreatePayload(projectId, member, templateRecord, stageKey),
    });

    createdMembers.push(mapCreatedMemberResponse(page.id, member));
  }

  return createdMembers;
}

function handleTeamGenerationRouteError(error: unknown) {
  if (error instanceof TeamGenerationRouteError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
  }

  const detail = error instanceof Error ? error.message : String(error);
  console.error("[POST /api/projects/[projectId]/team-members/generate]", error);
  return NextResponse.json({ ok: false, error: "Failed to generate team members", detail }, { status: 500 });
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    void request;
    const { projectId } = await context.params;
    const existingMembers = await listExistingTeamMembers(projectId);
    if (existingMembers.length > 0) {
      throw new TeamGenerationRouteError("Team members already exist for this project", 409);
    }

    const projectPage = await getProjectPage(projectId);
    const projectData = extractProjectForTeamGeneration(projectPage);
    validateProjectForTeamGeneration(projectData);
    const stageKey = projectData.currentstage_user;
    const stagePlaybook = await getStagePlaybookByStageKey(stageKey);
    const roleTemplates = await listRoleTemplatesByStagePlaybookId(stagePlaybook.id);

    const teamComposerResult = await runTeamComposerWithTemplates(projectData, stagePlaybook, roleTemplates);
    const finalMembers = buildFinalTeamMembers(projectId, teamComposerResult.members, roleTemplates);
    const createdMembers = await createTeamMembers(projectId, stageKey, finalMembers, roleTemplates);

    return NextResponse.json({ ok: true, project_id: projectId, members: createdMembers });
  } catch (error) {
    return handleTeamGenerationRouteError(error);
  }
}
