import { NextResponse } from "next/server";
import { notion } from "@/src/lib/notion";
import { PROJECT_STAGE_VALUES } from "@/src/constants/projectStages";

type DbProperty = {
  type: string;
  rich_text?: Array<{
    plain_text?: string;
  }>;
  title?: Array<{
    plain_text?: string;
  }>;
  select?: {
    name?: string | null;
    options?: Array<{ name: string }>;
  } | null;
  status?: {
    name?: string | null;
    options?: Array<{ name: string }>;
  } | null;
};

type NotionUpdatePageProperties = NonNullable<Parameters<typeof notion.pages.update>[0]["properties"]>;

type ProjectForAnalysis = {
  project: string;
  input_prompt_user: string;
  input_prompt_goal_user: string;
  currentstage_user: string;
  status: string;
  properties: Record<string, DbProperty>;
};

type RequirementAnalyzerInput = {
  project: string;
  original_prompt: string;
  project_goal: string;
  project_stage: string;
};

type RequirementAnalyzerResult = {
  project_summary: string;
  problem_statement: string;
  target_users: string[];
  core_goals: string[];
  constraints: string[];
  open_questions: string[];
  suggested_stage: string;
  analysis_confidence: number;
};

class AnalyzeRouteError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AnalyzeRouteError";
    this.statusCode = statusCode;
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function findPropertyName(
  properties: Record<string, DbProperty>,
  candidates: string[],
  expectedType?: string
): string | undefined {
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
    rich_text: [{ type: "text" as const, text: { content: value } }],
  };
}

function buildSelectProperty(properties: Record<string, DbProperty>, propertyName: string, value: string) {
  const property = properties[propertyName];
  const options = property.select?.options ?? property.status?.options ?? [];
  const matchedOption = options.find((option) => normalize(option.name) === normalize(value));

  if (property.type === "status") {
    return {
      status: { name: matchedOption?.name ?? value },
    };
  }

  return {
    select: { name: matchedOption?.name ?? value },
  };
}

function buildNumberProperty(value: number) {
  return {
    number: value,
  };
}

function joinLines(values: string[]): string {
  return values.join("\n");
}

async function getProjectPage(projectId: string) {
  try {
    return await notion.pages.retrieve({ page_id: projectId });
  } catch (error) {
    console.error("[getProjectPage]", error);
    throw new AnalyzeRouteError("Project not found", 404);
  }
}

function extractProjectForAnalysis(projectPage: Awaited<ReturnType<typeof notion.pages.retrieve>>): ProjectForAnalysis {
  if (!("properties" in projectPage)) {
    throw new AnalyzeRouteError("Project page response is missing properties", 500);
  }

  const properties = projectPage.properties as Record<string, DbProperty>;

  const projectPropertyName =
    findPropertyName(properties, ["project"], "title") ??
    findPropertyName(properties, ["project"], "rich_text");
  const inputPromptUserPropertyName = findPropertyName(properties, ["input_prompt_user"], "rich_text");
  const inputPromptGoalUserPropertyName = findPropertyName(properties, ["input_prompt_goal_user"], "rich_text");
  const currentStageUserPropertyName = findPropertyName(properties, ["currentstage_user"], "select");
  const statusPropertyName = findPropertyName(properties, ["status"], "status") ?? findPropertyName(properties, ["status"], "select");

  return {
    project: getTitleValue(properties, projectPropertyName) || getRichTextValue(properties, projectPropertyName),
    input_prompt_user: getRichTextValue(properties, inputPromptUserPropertyName),
    input_prompt_goal_user: getRichTextValue(properties, inputPromptGoalUserPropertyName),
    currentstage_user: getSelectValue(properties, currentStageUserPropertyName),
    status: getSelectValue(properties, statusPropertyName),
    properties,
  };
}

function validateProjectForAnalysis(projectInput: ProjectForAnalysis) {
  if (!projectInput.project) {
    throw new AnalyzeRouteError("project is empty", 400);
  }

  if (!projectInput.input_prompt_user) {
    throw new AnalyzeRouteError("input_prompt_user is empty", 400);
  }

  if (!projectInput.input_prompt_goal_user) {
    throw new AnalyzeRouteError("input_prompt_goal_user is empty", 400);
  }

  if (!projectInput.currentstage_user) {
    throw new AnalyzeRouteError("currentstage_user is empty", 400);
  }

  const allowedStages = new Set<string>(PROJECT_STAGE_VALUES);

  if (!allowedStages.has(normalize(projectInput.currentstage_user))) {
    throw new AnalyzeRouteError("currentstage_user is invalid", 400);
  }

  if (normalize(projectInput.status) === "archived") {
    throw new AnalyzeRouteError("Archived project cannot be analyzed", 400);
  }
}

function buildRequirementAnalyzerInput(projectInput: ProjectForAnalysis): RequirementAnalyzerInput {
  return {
    project: projectInput.project,
    original_prompt: projectInput.input_prompt_user,
    project_goal: projectInput.input_prompt_goal_user,
    project_stage: projectInput.currentstage_user,
  };
}

async function runRequirementAnalyzer(projectInput: ProjectForAnalysis): Promise<RequirementAnalyzerResult> {
  const analyzerInput = buildRequirementAnalyzerInput(projectInput);

  return {
    project_summary: `${analyzerInput.project} is a focused initiative for ${analyzerInput.project_goal}.`,
    problem_statement: `The team needs a clearer way to turn \"${analyzerInput.original_prompt}\" into an actionable product direction.`,
    target_users: ["Product teams", "Design collaborators"],
    core_goals: [
      analyzerInput.project_goal,
      "Clarify scope and decision-making inputs",
    ],
    constraints: [
      `Current stage: ${analyzerInput.project_stage}`,
      "v1 uses mock analysis output",
    ],
    open_questions: [
      "Which AI roles should be included first?",
      "What output format creates the most value for users?",
    ],
    suggested_stage: analyzerInput.project_stage,
    analysis_confidence: 0.78,
  };
}

function buildProjectAnalysisUpdatePayload(
  properties: Record<string, DbProperty>,
  analysisResult: RequirementAnalyzerResult
): NotionUpdatePageProperties {
  const payload: NotionUpdatePageProperties = {};

  const projectSummaryPropertyName = findPropertyName(properties, ["project_summary_ai"], "rich_text");
  const problemStatementPropertyName = findPropertyName(properties, ["problem_statement_ai"], "rich_text");
  const targetUsersPropertyName = findPropertyName(properties, ["target_users_ai"], "rich_text");
  const coreGoalsPropertyName = findPropertyName(properties, ["core_goals_ai"], "rich_text");
  const constraintsPropertyName = findPropertyName(properties, ["constraints_ai"], "rich_text");
  const openQuestionsPropertyName = findPropertyName(properties, ["open_questions_ai"], "rich_text");
  const suggestedStagePropertyName = findPropertyName(properties, ["suggested_stage_ai"], "select");
  const analysisConfidencePropertyName = findPropertyName(properties, ["analysis_confidence_ai"], "number");
  const statusPropertyName = findPropertyName(properties, ["status"], "status") ?? findPropertyName(properties, ["status"], "select");

  if (projectSummaryPropertyName) {
    payload[projectSummaryPropertyName] = buildRichTextProperty(analysisResult.project_summary);
  }
  if (problemStatementPropertyName) {
    payload[problemStatementPropertyName] = buildRichTextProperty(analysisResult.problem_statement);
  }
  if (targetUsersPropertyName) {
    payload[targetUsersPropertyName] = buildRichTextProperty(joinLines(analysisResult.target_users));
  }
  if (coreGoalsPropertyName) {
    payload[coreGoalsPropertyName] = buildRichTextProperty(joinLines(analysisResult.core_goals));
  }
  if (constraintsPropertyName) {
    payload[constraintsPropertyName] = buildRichTextProperty(joinLines(analysisResult.constraints));
  }
  if (openQuestionsPropertyName) {
    payload[openQuestionsPropertyName] = buildRichTextProperty(joinLines(analysisResult.open_questions));
  }
  if (suggestedStagePropertyName) {
    payload[suggestedStagePropertyName] = buildSelectProperty(properties, suggestedStagePropertyName, analysisResult.suggested_stage);
  }
  if (analysisConfidencePropertyName) {
    payload[analysisConfidencePropertyName] = buildNumberProperty(analysisResult.analysis_confidence);
  }
  if (statusPropertyName) {
    payload[statusPropertyName] = buildSelectProperty(properties, statusPropertyName, "active");
  }

  return payload;
}

async function updateProjectAnalysis(projectId: string, projectProperties: Record<string, DbProperty>, analysisResult: RequirementAnalyzerResult) {
  const properties = buildProjectAnalysisUpdatePayload(projectProperties, analysisResult);
  await notion.pages.update({
    page_id: projectId,
    properties,
  });
}

function mapAnalysisResponse(analysisResult: RequirementAnalyzerResult) {
  return {
    project_summary_ai: analysisResult.project_summary,
    problem_statement_ai: analysisResult.problem_statement,
    target_users_ai: joinLines(analysisResult.target_users),
    core_goals_ai: joinLines(analysisResult.core_goals),
    constraints_ai: joinLines(analysisResult.constraints),
    open_questions_ai: joinLines(analysisResult.open_questions),
    suggested_stage_ai: analysisResult.suggested_stage,
    analysis_confidence_ai: analysisResult.analysis_confidence,
  };
}

function handleAnalyzeRouteError(error: unknown) {
  if (error instanceof AnalyzeRouteError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: error.statusCode }
    );
  }

  const detail = error instanceof Error ? error.message : String(error);
  console.error("[POST /api/projects/[projectId]/analyze]", error);
  return NextResponse.json(
    {
      ok: false,
      error: "Analyze route failed",
      detail,
    },
    { status: 500 }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    void request;
    const { projectId } = await context.params;

    const projectPage = await getProjectPage(projectId);
    const projectInput = extractProjectForAnalysis(projectPage);

    validateProjectForAnalysis(projectInput);

    const analysisResult = await runRequirementAnalyzer(projectInput);

    await updateProjectAnalysis(projectId, projectInput.properties, analysisResult);

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      analysis: mapAnalysisResponse(analysisResult),
      status: "active",
    });
  } catch (error) {
    return handleAnalyzeRouteError(error);
  }
}



