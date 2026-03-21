import { NextResponse } from "next/server";
import { notion, getNotionDatabaseId } from "@/src/lib/notion";

type DbProperty = {
  id?: string;
  type: string;
  rich_text?: Array<{ plain_text?: string }>;
  title?: Array<{ plain_text?: string }>;
  select?: { name?: string | null; options?: Array<{ name: string }> } | null;
  status?: { name?: string | null; options?: Array<{ name: string }> } | null;
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

type TeamComposerInput = {
  project_summary: string;
  problem_statement: string;
  target_users: string[];
  core_goals: string[];
  constraints: string[];
  open_questions: string[];
  project_stage: string;
};

type TeamComposerMember = {
  name: string;
  role_type: string;
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

class TeamGenerationRouteError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "TeamGenerationRouteError";
    this.statusCode = statusCode;
  }
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
  return { rich_text: [{ type: "text" as const, text: { content: value } }] };
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

function buildTeamComposerInput(projectData: ProjectForTeamGeneration): TeamComposerInput {
  return {
    project_summary: projectData.project_summary_ai,
    problem_statement: projectData.problem_statement_ai,
    target_users: splitLines(projectData.target_users_ai),
    core_goals: splitLines(projectData.core_goals_ai),
    constraints: splitLines(projectData.constraints_ai),
    open_questions: splitLines(projectData.open_questions_ai),
    project_stage: projectData.currentstage_user,
  };
}

async function runTeamComposer(projectData: ProjectForTeamGeneration): Promise<TeamComposerResult> {
  const input = buildTeamComposerInput(projectData);
  const stageLabels: Record<string, string> = {
    discover: "Discover",
    define: "Define",
    develop: "Develop",
    deliver: "Deliver",
  };

  return {
    team_rationale: `A compact cross-functional team for ${projectData.project} in the ${stageLabels[input.project_stage] ?? input.project_stage} phase of the Double Diamond process.`,
    members: [
      {
        name: "Maya Chen",
        role_type: "PM",
        custom_role_label: null,
        is_custom_role: false,
        background_identity: "Product strategist focused on research synthesis, decision framing, and cross-functional alignment.",
        tasks: ["Define priorities", "Clarify decision criteria", "Keep the team aligned on phase outcomes"],
        knowledge: ["Research synthesis", "Decision framing", "Double Diamond facilitation"],
        rules: "Prioritize clarity, tradeoffs, and decision-ready outputs.",
        workflow: "Works first to frame questions, then coordinates with UX and Engineering.",
        response_format: "Decision notes, framed options, and next-step recommendations.",
        tone: "Structured, pragmatic, and strategic.",
        why_this_role: "This role keeps the project focused and translates analysis into clear phase priorities.",
        routing_hints: { good_for: ["Prioritization", "Decision framing", "Direction tradeoffs"], avoid_for: ["Detailed visual design", "Low-level implementation debugging"], pairs_well_with: ["UX", "Engineer"] },
        display_order: 1,
      },
      {
        name: "Alex Lin",
        role_type: "UX",
        custom_role_label: null,
        is_custom_role: false,
        background_identity: "UX researcher and interaction strategist experienced in problem framing and user insight synthesis.",
        tasks: ["Interpret user needs", "Clarify target users", "Shape solution direction from a user lens"],
        knowledge: ["JTBD", "User interview synthesis", "Information architecture"],
        rules: "Anchor recommendations in user context and unresolved questions.",
        workflow: "Partners with PM to validate goals and with Engineering to keep flows realistic.",
        response_format: "User insight summaries, opportunity statements, and flow recommendations.",
        tone: "Curious, analytical, and user-centered.",
        why_this_role: "This role ensures the generated team reflects real user value instead of only system output.",
        routing_hints: { good_for: ["User needs", "Flow design", "Problem framing"], avoid_for: ["Release planning", "Backend architecture"], pairs_well_with: ["PM", "Engineer"] },
        display_order: 2,
      },
      {
        name: "David Wu",
        role_type: "Engineer",
        custom_role_label: null,
        is_custom_role: false,
        background_identity: "Product-minded engineer who evaluates technical feasibility and translates plans into buildable systems.",
        tasks: ["Identify technical constraints", "Suggest implementation paths", "Reduce delivery risk"],
        knowledge: ["System design", "API integration", "Frontend-backend collaboration"],
        rules: "Keep recommendations feasible, incremental, and implementation-aware.",
        workflow: "Responds after PM and UX framing to turn direction into practical execution options.",
        response_format: "Implementation notes, technical tradeoffs, and delivery suggestions.",
        tone: "Direct, practical, and solution-focused.",
        why_this_role: "This role grounds the team in technical reality and helps the project move beyond abstract planning.",
        routing_hints: { good_for: ["Technical feasibility", "Architecture tradeoffs", "Implementation sequencing"], avoid_for: ["Pure brand positioning", "Standalone user research synthesis"], pairs_well_with: ["PM", "UX"] },
        display_order: 3,
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

function buildTeamMemberCreatePayload(projectId: string, member: TeamComposerMember) {
  const payload: NotionCreatePageProperties = {
    member_name: buildTitleProperty(member.name),
    project: { relation: [{ id: projectId }] },
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
  };

  return payload;
}

async function createTeamMembers(projectId: string, members: TeamComposerMember[]) {
  const databaseId = getNotionDatabaseId("teamMembers");
  const createdMembers = [];

  for (const member of members) {
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: buildTeamMemberCreatePayload(projectId, member),
    });

    createdMembers.push({
      member_id: page.id,
      member_name: member.name,
      role_type_ai: member.role_type,
      is_custom_role: member.is_custom_role,
    });
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

    const teamComposerResult = await runTeamComposer(projectData);
    const createdMembers = await createTeamMembers(projectId, teamComposerResult.members);

    return NextResponse.json({ ok: true, project_id: projectId, members: createdMembers });
  } catch (error) {
    return handleTeamGenerationRouteError(error);
  }
}



