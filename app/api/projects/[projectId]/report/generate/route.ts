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
  checkbox?: boolean;
  number?: number | null;
  select?: { name?: string | null; options?: Array<{ name: string }> } | null;
  status?: { name?: string | null; options?: Array<{ name: string }> } | null;
};

type NotionCreatePageProperties = NonNullable<Parameters<typeof notion.pages.create>[0]["properties"]>;

type ProjectForReport = {
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
  chat_content: string;
  discussion_stage_ai: string;
  confirmed_points_ai: string;
  assumptions_ai: string;
  next_focus_ai: string;
  ready_for_report_ai: boolean;
};

type TeamMemberForReport = {
  member_name: string;
  role_type_ai: string;
  why_this_role: string;
};

type ReportGeneratorInput = {
  original_prompt: string;
  project_goal: string;
  project_stage: string;
  analysis_result: {
    project_summary: string;
    problem_statement: string;
    target_users: string[];
    core_goals: string[];
    constraints: string[];
    open_questions: string[];
  };
  final_members: TeamMemberForReport[];
  chat_summary: string;
  decision_points: {
    confirmed_points: string;
    assumptions: string;
    next_focus: string;
  };
};

type ReportGeneratorResult = {
  report_title: string;
  report_content: string;
};

const reportGeneratorSchema = z.object({
  report_title: z.string(),
  report_content: z.string(),
});

const REPORT_STAGE_LABELS: Record<string, string> = {
  discover: "Discover 探索階段",
  define: "Define 定義階段",
  develop: "Develop 發展階段",
  deliver: "Deliver 交付階段",
};

class ReportGenerationRouteError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ReportGenerationRouteError";
    this.statusCode = statusCode;
  }
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
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

function getCheckboxValue(properties: Record<string, DbProperty>, propertyName: string | undefined): boolean {
  if (!propertyName) return false;
  return Boolean(properties[propertyName]?.checkbox);
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

async function getProjectPage(projectId: string) {
  try {
    return await notion.pages.retrieve({ page_id: projectId });
  } catch (error) {
    console.error("[getProjectPage report/generate]", error);
    throw new ReportGenerationRouteError("Project not found", 404);
  }
}

function extractProjectForReport(projectPage: Awaited<ReturnType<typeof notion.pages.retrieve>>): ProjectForReport {
  if (!("properties" in projectPage)) {
    throw new ReportGenerationRouteError("Project page response is missing properties", 500);
  }

  const properties = projectPage.properties as Record<string, DbProperty>;

  return {
    project: getTitleValue(properties, "project"),
    input_prompt_user: getRichTextValue(properties, "input_prompt_user"),
    input_prompt_goal_user: getRichTextValue(properties, "input_prompt_goal_user"),
    currentstage_user: getSelectValue(properties, "currentstage_user"),
    project_summary_ai: getRichTextValue(properties, "project_summary_ai"),
    problem_statement_ai: getRichTextValue(properties, "problem_statement_ai"),
    target_users_ai: getRichTextValue(properties, "target_users_ai"),
    core_goals_ai: getRichTextValue(properties, "core_goals_ai"),
    constraints_ai: getRichTextValue(properties, "constraints_ai"),
    open_questions_ai: getRichTextValue(properties, "open_questions_ai"),
    chat_content: getRichTextValue(properties, "chat_content"),
    discussion_stage_ai: getSelectValue(properties, "discussion_stage_ai"),
    confirmed_points_ai: getRichTextValue(properties, "confirmed_points_ai"),
    assumptions_ai: getRichTextValue(properties, "assumptions_ai"),
    next_focus_ai: getRichTextValue(properties, "next_focus_ai"),
    ready_for_report_ai: getCheckboxValue(properties, "ready_for_report_ai"),
  };
}

async function listTeamMembersByProject(projectId: string) {
  const databaseId = getNotionDatabaseId("teamMembers");
  const db = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in db) || !db.data_sources?.length) {
    throw new ReportGenerationRouteError("TEAM_MEMBER database metadata is incomplete", 500);
  }

  const queryArgs: Parameters<typeof notion.dataSources.query>[0] = {
    data_source_id: db.data_sources[0].id,
    filter: {
      property: "project",
      relation: { contains: projectId },
    },
    sorts: [{ property: "display_order", direction: "ascending" }],
    page_size: 20,
  };

  const result = await notion.dataSources.query(queryArgs);
  return result.results;
}

function extractTeamMembersForReport(teamMemberPages: Array<Awaited<ReturnType<typeof notion.dataSources.query>>["results"][number]>): TeamMemberForReport[] {
  return teamMemberPages
    .filter((page): page is Extract<typeof page, { properties: Record<string, DbProperty> }> => "properties" in page)
    .map((page) => {
      const properties = page.properties as Record<string, DbProperty>;
      return {
        member_name: getTitleValue(properties, "member_name"),
        role_type_ai: getSelectValue(properties, "role_type_ai"),
        why_this_role: getRichTextValue(properties, "why_this_role"),
      };
    });
}

function validateProjectForReport(projectData: ProjectForReport, members: TeamMemberForReport[]) {
  if (!projectData.project_summary_ai || !projectData.problem_statement_ai || !projectData.chat_content) {
    throw new ReportGenerationRouteError("Project is missing required data for report generation", 400);
  }

  if (members.length === 0) {
    throw new ReportGenerationRouteError("Project is missing required data for report generation", 400);
  }
}

function buildReportGeneratorInput(projectData: ProjectForReport, members: TeamMemberForReport[]): ReportGeneratorInput {
  return {
    original_prompt: projectData.input_prompt_user,
    project_goal: projectData.input_prompt_goal_user,
    project_stage: projectData.currentstage_user,
    analysis_result: {
      project_summary: projectData.project_summary_ai,
      problem_statement: projectData.problem_statement_ai,
      target_users: splitLines(projectData.target_users_ai),
      core_goals: splitLines(projectData.core_goals_ai),
      constraints: splitLines(projectData.constraints_ai),
      open_questions: splitLines(projectData.open_questions_ai),
    },
    final_members: members,
    chat_summary: projectData.chat_content,
    decision_points: {
      confirmed_points: projectData.confirmed_points_ai,
      assumptions: projectData.assumptions_ai,
      next_focus: projectData.next_focus_ai,
    },
  };
}

async function runReportGenerator(input: ReportGeneratorInput): Promise<ReportGeneratorResult> {
  const response = await openai.responses.parse({
    model: "gpt-4o-2024-08-06",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are Report Generator for AI Team Builder.",
              "Your job is to create a concise one-page product strategy report.",
              "Return only valid structured output.",
              "The report must be readable as plain text.",
              "The report content should be structured with clear section headings.",
              "Focus on summary, decisions, assumptions, and next steps.",
              "Do not repeat the entire chat transcript verbatim.",
              "If information is uncertain, label it as assumption or open question.",
              "Project stages are: discover, define, develop, deliver.",
              "All output content must be written in Traditional Chinese used in Taiwan.",
              "Do not reply in English unless the user explicitly asks for English.",
              "report_title and report_content must both be written in Traditional Chinese.",
              "Use a concise Chinese report title suitable for a project plan or strategy summary.",
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
      format: zodTextFormat(reportGeneratorSchema, "report_generator_result"),
    },
  });

  const parsed = response.output_parsed;

  if (!parsed) {
    return {
      report_title: `${REPORT_STAGE_LABELS[input.project_stage] ?? input.project_stage} 專案計畫書`,
      report_content: [
        "【執行摘要】",
        "目前資料不足，系統未能成功生成完整的專案計畫書。",
        "",
        "【目前已知資訊】",
        `原始需求：${input.original_prompt || "未提供"}`,
        `設計目標：${input.project_goal || "未提供"}`,
        `專案階段：${input.project_stage || "未提供"}`,
        "",
        "【建議下一步】",
        "1. 補充更多討論內容",
        "2. 明確整理已確認的決策點",
        "3. 重新產生專案計畫書",
      ].join("\n"),
    };
  }

  return parsed satisfies ReportGeneratorResult;
}

async function buildReportNumber(): Promise<string> {
  const databaseId = getNotionDatabaseId("reportSections");
  const db = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in db) || !db.data_sources?.length) {
    throw new ReportGenerationRouteError("REPORT database metadata is incomplete", 500);
  }

  const result = await notion.dataSources.query({
    data_source_id: db.data_sources[0].id,
    page_size: 100,
  });

  const nextNumber = result.results.length + 1;
  return `Report ${String(nextNumber).padStart(3, "0")}`;
}

async function createReport(projectId: string, reportResult: ReportGeneratorResult) {
  const databaseId = getNotionDatabaseId("reportSections");
  const reportNumber = await buildReportNumber();
  const pageProperties: NotionCreatePageProperties = {
    report_number: buildTitleProperty(reportNumber),
    project: { relation: [{ id: projectId }] },
    report_content: buildRichTextProperty(reportResult.report_content),
  };

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: pageProperties,
  });

  return {
    page,
    report_number: reportNumber,
  };
}

function handleReportRouteError(error: unknown) {
  console.error("[report/generate]", error);

  if (error instanceof ReportGenerationRouteError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { ok: false, error: "Failed to generate report", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: false, error: "Failed to generate report" }, { status: 500 });
}

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;

    const projectPage = await getProjectPage(projectId);
    const projectData = extractProjectForReport(projectPage);
    const teamMemberPages = await listTeamMembersByProject(projectId);
    const members = extractTeamMembersForReport(teamMemberPages);

    validateProjectForReport(projectData, members);

    const reportInput = buildReportGeneratorInput(projectData, members);
    const reportResult = await runReportGenerator(reportInput);
    const { page, report_number } = await createReport(projectId, reportResult);

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      report_id: page.id,
      report_number,
      report_content: reportResult.report_content,
    });
  } catch (error) {
    return handleReportRouteError(error);
  }
}
