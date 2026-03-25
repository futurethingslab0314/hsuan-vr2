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

const teamComposerMemberSchema = z.object({
  name: z.string(),
  role_type: z.enum(["UX", "PM", "UI", "Engineer", "Researcher", "custom"]),
  custom_role_label: z.string().nullable(),
  is_custom_role: z.boolean(),
  background_identity: z.string(),
  tasks: z.array(z.string()),
  knowledge: z.array(z.string()),
  rules: z.string(),
  workflow: z.string(),
  response_format: z.string(),
  tone: z.string(),
  why_this_role: z.string(),
  routing_hints: z.object({
    good_for: z.array(z.string()),
    avoid_for: z.array(z.string()),
    pairs_well_with: z.array(z.string()),
  }),
  display_order: z.number().int().positive(),
});

const teamComposerSchema = z.object({
  team_rationale: z.string(),
  members: z.array(teamComposerMemberSchema).min(3).max(5),
});

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
              "Your job is to generate a compact AI team for product/design discussion.",
              "Return only valid structured output.",
              "Prefer a team of 3 to 5 members.",
              "Prefer fixed roles from this pool first: UX, PM, UI, Engineer, Researcher.",
              "Use role_type = custom only when clearly necessary.",
              "If role_type is not custom, custom_role_label must be null.",
              "If role_type is custom, custom_role_label must be a meaningful label.",
              "Members must have distinct responsibilities and complementary perspectives.",
              "Display order must start at 1 and increase sequentially.",
              "Project stages are: discover, define, develop, deliver.",
              "Match the team composition to the project stage and problem.",
            ].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                project_summary: input.project_summary,
                problem_statement: input.problem_statement,
                target_users: input.target_users,
                core_goals: input.core_goals,
                constraints: input.constraints,
                open_questions: input.open_questions,
                project_stage: input.project_stage,
              },
              null,
              2
            ),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(teamComposerSchema, "team_composer_result"),
    },
  });

  const parsed = response.output_parsed;

  if (!parsed) {
    throw new TeamGenerationRouteError("Team Composer returned no structured output", 500);
  }

  return parsed satisfies TeamComposerResult;
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

async function createTeamMembers(projectId: string, members: TeamComposerMember[]) {
  const databaseId = getNotionDatabaseId("teamMembers");
  const createdMembers = [];

  for (const member of members) {
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: buildTeamMemberCreatePayload(projectId, member),
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

    const teamComposerResult = await runTeamComposer(projectData);
    const createdMembers = await createTeamMembers(projectId, teamComposerResult.members);

    return NextResponse.json({ ok: true, project_id: projectId, members: createdMembers });
  } catch (error) {
    return handleTeamGenerationRouteError(error);
  }
}
