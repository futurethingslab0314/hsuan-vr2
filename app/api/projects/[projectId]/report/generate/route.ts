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

const REPORT_COMMON_RULES = [
  "你正在根據「本階段使用者與 AI persona 團隊的對話紀錄」生成階段報告。",
  "請嚴格遵守以下規則：",
  "1. 報告只能根據本階段對話紀錄、使用者明確輸入、AI persona 已提出的內容生成。",
  "2. 不可以自行補完對話中沒有提到的決策、功能、技術細節、使用者洞察、數據、工時或風險等級。",
  "3. 如果某個報告欄位在對話中沒有被討論，請不要生成假內容。",
  "4. 未被討論的欄位請標示為：",
  "   狀態：待釐清",
  "   並簡短說明「本階段尚未討論此項目」。",
  "5. 若該項目對本階段任務很重要，請補上：",
  "   - 待補問問題",
  "   - 建議詢問的 AI persona",
  "   - 下一步行動",
  "6. 若能根據對話做合理推論，必須明確標示：",
  "   根據目前對話推測",
  "   不可寫成已確認事實。",
  "7. 請在主要段落開頭標示內容狀態：",
  "   - 狀態：已討論",
  "   - 狀態：已決策",
  "   - 狀態：合理推測",
  "   - 狀態：待釐清",
  "狀態定義：",
  "- 已討論：對話中明確提到，但未必形成決策。",
  "- 已決策：使用者或團隊已明確選擇、刪除、排序、確認。",
  "- 合理推測：可由對話內容推導，但尚未被明確確認。",
  "- 待釐清：對話中資訊不足，不能生成結論。",
  "如果某段落是待釐清，請使用以下格式：",
  "## 欄位名稱",
  "狀態：待釐清",
  "本階段尚未討論此項目。",
  "待補問問題：",
  "- 問題 1",
  "- 問題 2",
  "- 問題 3",
  "建議詢問：",
  "- 建議詢問的 AI persona：",
  "- 建議提問：",
  "下一步行動：",
  "- 行動內容：",
].join("\n");

const REPORT_STAGE_INSTRUCTIONS: Record<string, string> = {
  discover: `
你現在要生成一份「Discover 發散報告」。

此階段的任務是理解脈絡、擴展可能性、看見更多使用情境、需求、情緒與初步服務可能。
請不要進行功能刪減、MVP 選擇、可行性判斷或成本評估。
即使對話中出現不成熟或不現實的想法，也請整理為「可能性」或「待後續驗證的想法」，不要直接否定。

請使用繁體中文，語氣清楚、具設計研究感。

請依照以下格式輸出：

# Discover 發散報告

## 1. 專案脈絡摘要
請根據對話內容整理本階段討論到的背景脈絡。
若對話中有提到，請包含：
- 專案目標
- 主要使用者
- 系統可能包含的元素
- 「取得藥品」被如何理解
- 本階段主要探索的問題
若以上內容未被討論，請不要補寫，改標示為待釐清。

## 2. 使用情境整理
請整理對話中實際出現的使用情境。
每一種情境包含：
- 情境名稱
- 時間 / 觸發時刻
- 場域
- 使用者心理
- 遇到的問題
- 產品可能扮演的角色

## 3. 使用者心理與情緒需求
請整理對話中實際提到的心理或情緒需求。
每一點請包含：
- 心理 / 情緒需求
- 對話依據
- 對設計的啟示

## 4. 可能的使用族群
請整理對話中實際提到的使用族群。
每個族群包含：
- 族群描述
- 主要困難
- 可能需要的支援
- 與產品的關係

## 5. AI Persona 觀點整理
請只整理對話中實際被使用或實際發言的 AI persona。
每個角色請整理：
- 該角色提出的觀點
- 該觀點如何拓展問題空間
- 對後續階段的價值

## 6. 初步功能與服務可能性
請整理對話中實際出現的初步功能或服務想法。
請使用表格：
| 初步功能 / 服務 | 對應需求 | 可能價值 | 待釐清問題 | 狀態 |
|---|---|---|---|---|

## 7. 仍未被理解的問題
請根據本階段缺口整理問題。

## 8. 帶往 Define 階段的材料
請整理本階段已經產生、可帶往 Define 階段批判與收斂的材料。

## 9. 一句話總結
請用一句話總結本階段已完成的探索。
`.trim(),

  define: `
你現在要生成一份「Define 決策報告」。

此階段的任務是批判、排序、刪減與定義 MVP。
請不要繼續大量發散新點子，也不要把所有功能都保留下來。
報告必須清楚呈現：哪些功能被保留、哪些被延後、哪些被刪除，以及是否已經做出 2 個 MVP 功能的決策。

請使用繁體中文，語氣理性、清楚、具決策紀錄感。

請依照以下格式輸出：

# Define 決策報告

## 1. 本階段任務摘要

## 2. 候選功能整理
請使用表格：
| 候選功能 | 對話中如何被討論 | 初步判斷 | 狀態 |
|---|---|---|---|

## 3. AI Persona 批判整理
請只整理實際在對話中被詢問或有提供內容的 persona。

## 4. 功能分類結果
請使用表格：
| 功能 | 分類：必須有 / 可以延後 / 應該刪除 / 尚未決定 | 判斷理由 | 主要風險 | 狀態 |
|---|---|---|---|---|

## 5. 最終 MVP 決策

## 6. 核心問題定義

## 7. 核心價值主張

## 8. 延後發展的功能

## 9. 刪除功能

## 10. 主要使用者假設

## 11. 技術與資料邊界

## 12. 帶往 Develop 階段的問題

## 13. 一句話總結
`.trim(),

  develop: `
你現在要生成一份「Develop 方案報告」。

此階段的任務是將已選定的 MVP 轉化為可以被設計、開發與測試的方案。
請不要重新發想大型新功能，也不要回到 Discover 式的發散。
請將對話中已討論的內容拆成模組、流程、動作、資料與技術邏輯。

請使用繁體中文，語氣結構化、具產品方案與系統規格感。

請依照以下格式輸出：

# Develop 方案報告

## 1. 本階段任務摘要

## 2. AI Persona 方案整理

## 3. P0 / P1 / P2 功能模組
請使用表格：
| 優先級 | 功能模組 | 對應 MVP | 使用者動作 | 系統反應 | 狀態 |
|---|---|---|---|---|---|

## 4. 基礎層 / 互動層 / 內容層架構
請使用表格：
| 層級 | 已討論內容 | 待釐清內容 | 狀態 |
|---|---|---|---|

## 5. 使用者操作腳本

## 6. 硬體與軟體分工
請使用表格：
| 系統部分 | 負責功能 | 輸入資料 | 輸出回饋 | 狀態 |
|---|---|---|---|---|

## 7. 醫院資料串接流程

## 8. 錯誤處理流程
請使用表格：
| 錯誤情境 | 可能原因 | 使用者風險 | 系統處理 | 是否需要人工介入 | 狀態 |
|---|---|---|---|---|---|

## 9. 下一階段 Deliver 要驗收的項目

## 10. 一句話總結
`.trim(),

  deliver: `
你現在要生成一份「Deliver 交付報告」。

此階段的任務是最終刪減、確認交付範圍、整理產品規格與驗收清單。
請不要再發散新功能，也不要讓所有功能都保留。
報告必須清楚呈現哪些功能納入本版、哪些延至下一版本、哪些直接刪除，以及為什麼。

請使用繁體中文，語氣務實、精確，接近產品交付文件。

請特別注意：
- 不可自行編造工時。
- 不可自行編造風險等級。
- 不可自行替受測者決定功能去留。
- 若 Engineer 沒有提供工時，請標示「需補工程估時」。
- 若 PM 沒有明確刪減功能，請標示「交付範圍尚未完成收斂」。

請依照以下格式輸出：

# Deliver 交付報告

## 1. 本階段任務摘要

## 2. 原始功能狀態盤點
請使用表格：
| 功能 | 對話中提到的狀態 | 初步風險 | 狀態 |
|---|---|---|---|

## 3. AI Persona 最終評估整理

## 4. 最終功能決策
請使用表格：
| 功能 | 決策：本版 / 下一版本 / 刪除 / 尚未決定 | 決策理由 | 風險等級 | 狀態 |
|---|---|---|---|---|

## 5. 本版功能清單

## 6. 下一版本功能清單

## 7. 刪除功能清單

## 8. 開發工時估算
請使用表格：
| 功能 / 工作項目 | 預估工時 | 估算依據 | 狀態 |
|---|---|---|---|

## 9. 技術風險等級
請使用表格：
| 風險項目 | 風險等級 | 原因 | 降低風險方式 | 狀態 |
|---|---|---|---|---|

## 10. 高齡友善使用檢查

## 11. 醫療資料與隱私檢查

## 12. 藥品確認測試情境
請使用表格：
| 測試情境 | 預期系統反應 | 未通過風險 | 狀態 |
|---|---|---|---|

## 13. 提醒語與錯誤訊息規範

## 14. 產品責任邊界

## 15. 上線前阻斷條件

## 16. 最終交付結論
`.trim(),
};

class ReportGenerationRouteError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ReportGenerationRouteError";
    this.statusCode = statusCode;
  }
}

function normalizeRoleType(value: string): "PM" | "Researcher" | "UX Designer" | "Engineer" {
  const normalized = value.trim().toLowerCase();

  if (normalized === "pm" || normalized === "product manager") return "PM";
  if (normalized === "researcher" || normalized === "ux strategist") return "Researcher";
  if (normalized === "ux designer" || normalized === "ux" || normalized === "ui" || normalized === "ui designer") return "UX Designer";
  if (normalized === "engineer" || normalized === "prototyper") return "Engineer";

  return "Engineer";
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getReportStageInstruction(stage: string) {
  return REPORT_STAGE_INSTRUCTIONS[stage] ?? REPORT_STAGE_INSTRUCTIONS.define;
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
        role_type_ai: normalizeRoleType(getSelectValue(properties, "role_type_ai")),
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
  const stageInstruction = getReportStageInstruction(input.project_stage);

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
              "Return only valid structured output.",
              "The report must be readable as plain text.",
              "The report content should be structured with clear section headings.",
              "Do not repeat the entire chat transcript verbatim.",
              "All output content must be written in Traditional Chinese used in Taiwan.",
              "Do not reply in English unless the user explicitly asks for English.",
              "report_title and report_content must both be written in Traditional Chinese.",
              "Use a concise Chinese report title suitable for a staged project report.",
              "",
              "以下是報告生成共用規則：",
              REPORT_COMMON_RULES,
              "",
              "以下是本階段報告生成規則：",
              stageInstruction,
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
