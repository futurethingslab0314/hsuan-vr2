import { NextResponse } from "next/server";
import { notion, getNotionDatabaseId } from "@/src/lib/notion";

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

type TeamComposerMember = {
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
  members: TeamComposerMember[];
};

const ALLOWED_ROLE_TYPES = ["PM", "Researcher", "UX Designer", "Engineer"] as const;
type AllowedRoleType = (typeof ALLOWED_ROLE_TYPES)[number];

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

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
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
  const currentStageUserPropertyName = findPropertyName(properties, ["currentstage_user"], "select");
  const projectSummaryPropertyName = findPropertyName(properties, ["project_summary_ai"], "rich_text");
  const problemStatementPropertyName = findPropertyName(properties, ["problem_statement_ai"], "rich_text");
  const targetUsersPropertyName = findPropertyName(properties, ["target_users_ai"], "rich_text");
  const coreGoalsPropertyName = findPropertyName(properties, ["core_goals_ai"], "rich_text");
  const constraintsPropertyName = findPropertyName(properties, ["constraints_ai"], "rich_text");
  const openQuestionsPropertyName = findPropertyName(properties, ["open_questions_ai"], "rich_text");

  return {
    project: getTitleValue(properties, projectPropertyName) || getRichTextValue(properties, projectPropertyName),
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

  const roleKeys = templates.map((template) => template.role_key).filter(Boolean);
  if (new Set(roleKeys).size !== 4) {
    throw new TeamGenerationRouteError("Role templates are incomplete for current project stage", 400);
  }

  return templates.sort((a, b) => a.role_key.localeCompare(b.role_key));
}

function buildTeamComposerInput(
  projectData: ProjectForTeamGeneration,
  stagePlaybook: StagePlaybook,
  roleTemplates: RoleTemplate[]
): TeamComposerInput {
  return {
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
  const stageLabels: Record<string, string> = {
    discover: "Discover",
    define: "Define",
    develop: "Develop",
    deliver: "Deliver",
  };

  return {
    team_rationale: `${projectData.project} 目前處於雙鑽石流程的 ${stageLabels[input.project_stage] ?? input.project_stage}，因此建議配置一組精簡且可協作的跨職能 AI 團隊。`,
    members: [
      {
        name: "Maya Chen",
        role_type: "PM",
        custom_role_label: null,
        is_custom_role: false,
        background_identity: "專注於研究洞察整理、決策框定與跨職能協作的產品策略角色。",
        tasks: ["定義優先順序", "釐清決策標準", "維持團隊對階段目標的對齊"],
        knowledge: ["研究洞察整理", "決策框定", "雙鑽石流程方法"],
        rules: "優先提供清楚、可比較、可決策的內容。",
        workflow: "先協助框定問題，再與 Researcher、UX Designer 和 Engineer 協作收斂方向。",
        response_format: "決策摘要、選項比較與下一步建議。",
        tone: "結構化、務實、具策略性。",
        why_this_role: "這個角色能幫助團隊把分析結果轉成清楚的階段重點與決策方向。",
        routing_hints: {
          good_for: ["優先級判斷", "決策框定", "方向取捨"],
          avoid_for: ["細部視覺設計", "低階技術除錯"],
          pairs_well_with: ["Researcher", "Engineer"],
        },
        display_order: 1,
      },
      {
        name: "Alex Lin",
        role_type: "Researcher",
        custom_role_label: null,
        is_custom_role: false,
        background_identity: "擅長問題定義、使用者洞察整理與行為分析的研究角色。",
        tasks: ["詮釋使用者需求", "釐清目標使用者", "從使用者角度塑造解法方向"],
        knowledge: ["JTBD", "使用者訪談洞察整理", "資訊架構"],
        rules: "所有建議都應回到使用者情境與尚未解決的問題。",
        workflow: "與 PM 一起驗證目標方向，並與 UX Designer、Engineer 合作確保洞察能轉為可執行方案。",
        response_format: "使用者洞察摘要、機會點陳述與流程建議。",
        tone: "好奇、分析型、以使用者為中心。",
        why_this_role: "這個角色能確保團隊不是只回應系統輸出，而是真正回到使用者價值。",
        routing_hints: {
          good_for: ["使用者需求", "研究洞察", "問題框定"],
          avoid_for: ["發版規劃", "後端架構"],
          pairs_well_with: ["PM", "UX Designer"],
        },
        display_order: 2,
      },
      {
        name: "Sarah Miller",
        role_type: "UX Designer",
        custom_role_label: null,
        is_custom_role: false,
        background_identity: "擅長互動流程、介面邏輯與體驗細節整合的 UX 設計角色。",
        tasks: ["建立互動流程", "設計資訊架構", "確保介面與體驗的一致性"],
        knowledge: ["資訊架構", "用戶流程設計", "互動設計原則"],
        rules: "所有設計建議都應兼顧易用性、可理解性與整體體驗一致性。",
        workflow: "在 PM 與 Researcher 釐清目標與洞察後，把方向轉成可體驗、可理解的設計方案。",
        response_format: "用戶流程圖、互動動線腳本、設計規範。",
        tone: "細膩、具設計感、以人為本。",
        why_this_role: "這個角色能把抽象需求與洞察整理成可操作的體驗與介面策略。",
        routing_hints: {
          good_for: ["用戶流程", "互動體驗", "介面結構"],
          avoid_for: ["低階技術架構", "單純商務談判"],
          pairs_well_with: ["Researcher", "Engineer"],
        },
        display_order: 3,
      },
      {
        name: "David Wu",
        role_type: "Engineer",
        custom_role_label: null,
        is_custom_role: false,
        background_identity: "具產品思維的工程角色，擅長評估技術可行性並把規劃轉成可落地的系統做法。",
        tasks: ["辨識技術限制", "提出實作路徑", "降低交付風險"],
        knowledge: ["系統設計", "API 整合", "前後端協作"],
        rules: "所有建議都要可行、可分段推進，並考慮實作成本。",
        workflow: "通常在 PM、Researcher 與 UX Designer 完成問題框定後，進一步把方向轉成具體的執行方案。",
        response_format: "實作建議、技術取捨與交付安排。",
        tone: "直接、務實、以解法為導向。",
        why_this_role: "這個角色能把團隊討論拉回技術現實，避免停留在抽象規劃。",
        routing_hints: {
          good_for: ["技術可行性", "架構取捨", "實作排序"],
          avoid_for: ["純品牌定位", "單獨使用者研究整理"],
          pairs_well_with: ["PM", "UX Designer"],
        },
        display_order: 4,
      },
    ],
  };
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
    role_type_ai: { select: { name: member.role_type } },
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
    const templateRecord = roleTemplates.find((template) => template.role_type_ai === member.role_type);
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
    const createdMembers = await createTeamMembers(projectId, stageKey, teamComposerResult.members, roleTemplates);

    return NextResponse.json({ ok: true, project_id: projectId, members: createdMembers });
  } catch (error) {
    return handleTeamGenerationRouteError(error);
  }
}
