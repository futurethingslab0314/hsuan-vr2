import { NextResponse } from "next/server";
import { z } from "zod";
import { notion, getNotionDatabaseId } from "@/src/lib/notion";

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

type NotionUpdatePageProperties = NonNullable<Parameters<typeof notion.pages.update>[0]["properties"]>;

type ProjectForChat = {
  properties: Record<string, DbProperty>;
  project: string;
  currentstage_user: string;
  project_summary_ai: string;
  problem_statement_ai: string;
  chat_content: string;
  discussion_stage_ai: string;
  confirmed_points_ai: string;
  assumptions_ai: string;
  next_focus_ai: string;
  ready_for_report_ai: boolean;
};

type TeamMemberForChat = {
  member_id: string;
  member_name: string;
  role_type_ai: string;
  custom_role_label_ai: string;
  is_custom_role: boolean;
  role_background_identity: string;
  role_target: string;
  role_knowledge_reference: string;
  role_rules: string;
  role_workflow: string;
  role_response_format: string;
  role_tone: string;
  why_this_role: string;
  routing_good_for: string;
  routing_avoid_for: string;
  routing_pairs_well_with: string;
  display_order: number;
};

type ConversationOrchestratorInput = {
  project_brief: string;
  project_stage: string;
  members: TeamMemberForChat[];
  chat_history: string;
  conversation_summary: string;
  user_message: string;
  tagged_members: string[];
  decision_state: {
    discussion_stage_ai: string;
    confirmed_points_ai: string;
    assumptions_ai: string;
    next_focus_ai: string;
  };
  report_readiness: boolean;
};

type ConversationResponse = {
  member_id: string;
  member_name: string;
  role_type_ai: string;
  content: string;
};

type ConversationOrchestratorResult = {
  message_type: string;
  discussion_stage: string;
  selected_speakers: string[];
  responses: ConversationResponse[];
  system_summary: string;
  discussion_state_update: {
    confirmed_points: string[];
    assumptions: string[];
    next_focus: string;
  };
  ready_for_report: boolean;
};

const chatRequestSchema = z.object({
  user_message: z.string().trim().min(1, "user_message is required").max(4000),
  tagged_members: z.array(z.string().trim().min(1)).optional().default([]),
});

class ChatRouteError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ChatRouteError";
    this.statusCode = statusCode;
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
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

function getCheckboxValue(properties: Record<string, DbProperty>, propertyName: string | undefined): boolean {
  if (!propertyName) return false;
  return Boolean(properties[propertyName]?.checkbox);
}

function getNumberValue(properties: Record<string, DbProperty>, propertyName: string | undefined): number {
  if (!propertyName) return 0;
  return properties[propertyName]?.number ?? 0;
}

function buildRichTextProperty(value: string) {
  return { rich_text: [{ type: "text" as const, text: { content: value } }] };
}

function buildCheckboxProperty(value: boolean) {
  return { checkbox: value };
}

function buildSelectProperty(properties: Record<string, DbProperty>, propertyName: string, value: string) {
  const property = properties[propertyName];
  const options = property.select?.options ?? property.status?.options ?? [];
  const matchedOption = options.find((option) => normalize(option.name) === normalize(value));
  if (property.type === "status") return { status: { name: matchedOption?.name ?? value } };
  return { select: { name: matchedOption?.name ?? value } };
}

async function getProjectPage(projectId: string) {
  try {
    return await notion.pages.retrieve({ page_id: projectId });
  } catch (error) {
    console.error("[getProjectPage chat]", error);
    throw new ChatRouteError("Project not found", 404);
  }
}

function extractProjectForChat(projectPage: Awaited<ReturnType<typeof notion.pages.retrieve>>): ProjectForChat {
  if (!("properties" in projectPage)) {
    throw new ChatRouteError("Project page response is missing properties", 500);
  }

  const properties = projectPage.properties as Record<string, DbProperty>;
  const projectPropertyName = findPropertyName(properties, ["project"], "title") ?? findPropertyName(properties, ["project"], "rich_text");

  return {
    properties,
    project: getTitleValue(properties, projectPropertyName) || getRichTextValue(properties, projectPropertyName),
    currentstage_user: getSelectValue(properties, findPropertyName(properties, ["currentstage_user"], "select")),
    project_summary_ai: getRichTextValue(properties, findPropertyName(properties, ["project_summary_ai"], "rich_text")),
    problem_statement_ai: getRichTextValue(properties, findPropertyName(properties, ["problem_statement_ai"], "rich_text")),
    chat_content: getRichTextValue(properties, findPropertyName(properties, ["chat_content"], "rich_text")),
    discussion_stage_ai: getSelectValue(properties, findPropertyName(properties, ["discussion_stage_ai"], "select")),
    confirmed_points_ai: getRichTextValue(properties, findPropertyName(properties, ["confirmed_points_ai"], "rich_text")),
    assumptions_ai: getRichTextValue(properties, findPropertyName(properties, ["assumptions_ai"], "rich_text")),
    next_focus_ai: getRichTextValue(properties, findPropertyName(properties, ["next_focus_ai"], "rich_text")),
    ready_for_report_ai: getCheckboxValue(properties, findPropertyName(properties, ["ready_for_report_ai"], "checkbox")),
  };
}

async function listTeamMembersByProject(projectId: string) {
  const databaseId = getNotionDatabaseId("teamMembers");
  const db = await notion.databases.retrieve({ database_id: databaseId });
  if (!("properties" in db) || !("data_sources" in db) || !db.data_sources?.length) {
    throw new ChatRouteError("TEAM_MEMBER database metadata is incomplete", 500);
  }

  const properties = db.properties as Record<string, DbProperty>;
  const relationPropertyName = findPropertyName(properties, ["project"], "relation");
  if (!relationPropertyName) {
    throw new ChatRouteError("TEAM_MEMBER database is missing project relation", 500);
  }

  const queryArgs: Parameters<typeof notion.dataSources.query>[0] = {
    data_source_id: db.data_sources[0].id,
    filter: {
      property: relationPropertyName,
      relation: { contains: projectId },
    },
    page_size: 20,
  };

  const displayOrderPropertyName = findPropertyName(properties, ["display_order"], "number");
  if (displayOrderPropertyName) {
    queryArgs.sorts = [{ property: displayOrderPropertyName, direction: "ascending" }];
  }

  const result = await notion.dataSources.query(queryArgs);
  return result.results;
}

function extractTeamMembersForChat(teamMemberPages: Array<Awaited<ReturnType<typeof notion.dataSources.query>>["results"][number]>): TeamMemberForChat[] {
  return teamMemberPages
    .filter((page): page is Extract<typeof page, { properties: Record<string, DbProperty>; id: string }> => "properties" in page)
    .map((page) => {
      const properties = page.properties as Record<string, DbProperty>;
      const memberNamePropertyName = findPropertyName(properties, ["member_name"], "title") ?? findPropertyName(properties, ["member_name"], "rich_text");
      return {
        member_id: page.id,
        member_name: getTitleValue(properties, memberNamePropertyName) || getRichTextValue(properties, memberNamePropertyName),
        role_type_ai: getSelectValue(properties, findPropertyName(properties, ["role_type_ai"], "select")),
        custom_role_label_ai: getRichTextValue(properties, findPropertyName(properties, ["custom_role_label_ai"], "rich_text")),
        is_custom_role: getCheckboxValue(properties, findPropertyName(properties, ["is_custom_role"], "checkbox")),
        role_background_identity: getRichTextValue(properties, findPropertyName(properties, ["role_background_identity"], "rich_text")),
        role_target: getRichTextValue(properties, findPropertyName(properties, ["role_target"], "rich_text")),
        role_knowledge_reference: getRichTextValue(properties, findPropertyName(properties, ["role_knowledge_reference"], "rich_text")),
        role_rules: getRichTextValue(properties, findPropertyName(properties, ["role_rules"], "rich_text")),
        role_workflow: getRichTextValue(properties, findPropertyName(properties, ["role_workflow"], "rich_text")),
        role_response_format: getRichTextValue(properties, findPropertyName(properties, ["role_response_format"], "rich_text")),
        role_tone: getRichTextValue(properties, findPropertyName(properties, ["role_tone"], "rich_text")),
        why_this_role: getRichTextValue(properties, findPropertyName(properties, ["why_this_role"], "rich_text")),
        routing_good_for: getRichTextValue(properties, findPropertyName(properties, ["routing_good_for"], "rich_text")),
        routing_avoid_for: getRichTextValue(properties, findPropertyName(properties, ["routing_avoid_for"], "rich_text")),
        routing_pairs_well_with: getRichTextValue(properties, findPropertyName(properties, ["routing_pairs_well_with"], "rich_text")),
        display_order: getNumberValue(properties, findPropertyName(properties, ["display_order"], "number")),
      };
    });
}

function validateChatRequest(projectData: ProjectForChat, members: TeamMemberForChat[], userMessage: string, taggedMembers: string[]) {
  if (!userMessage.trim()) throw new ChatRouteError("user_message is required", 400);
  if (!projectData.project_summary_ai || !projectData.problem_statement_ai || !projectData.currentstage_user) {
    throw new ChatRouteError("Project is missing required analysis fields for chat", 400);
  }
  if (members.length === 0) throw new ChatRouteError("Team members are required before starting chat", 400);
  for (const taggedMember of taggedMembers) {
    if (!members.some((member) => member.member_id === taggedMember)) {
      throw new ChatRouteError("Tagged member not found", 400);
    }
  }
}

function buildConversationOrchestratorInput(projectData: ProjectForChat, members: TeamMemberForChat[], userMessage: string, taggedMembers: string[]): ConversationOrchestratorInput {
  return {
    project_brief: `${projectData.project_summary_ai}\n\n${projectData.problem_statement_ai}`,
    project_stage: projectData.currentstage_user,
    members,
    chat_history: projectData.chat_content,
    conversation_summary: projectData.confirmed_points_ai,
    user_message: userMessage,
    tagged_members: taggedMembers,
    decision_state: {
      discussion_stage_ai: projectData.discussion_stage_ai,
      confirmed_points_ai: projectData.confirmed_points_ai,
      assumptions_ai: projectData.assumptions_ai,
      next_focus_ai: projectData.next_focus_ai,
    },
    report_readiness: projectData.ready_for_report_ai,
  };
}

async function runConversationOrchestrator(input: ConversationOrchestratorInput): Promise<ConversationOrchestratorResult> {
  const selectedMembers = input.tagged_members.length > 0
    ? input.members.filter((member) => input.tagged_members.includes(member.member_id))
    : input.members.slice(0, Math.min(2, input.members.length));

  const stageFraming: Record<string, string> = {
    discover: "a discovery discussion",
    define: "a definition and synthesis discussion",
    develop: "an ideation and concept development discussion",
    deliver: "an implementation and delivery discussion",
  };

  const stageSummary: Record<string, { systemSummary: string; confirmedPoints: string[]; assumptions: string[]; nextFocus: string }> = {
    discover: {
      systemSummary: "目前共識偏向：先釐清使用者情境、核心問題與研究方向，再決定後續方案。",
      confirmedPoints: ["目前優先理解問題與情境", "應避免過早跳入具體解法"],
      assumptions: ["更清楚的研究與問題定義會提升後續決策品質"],
      nextFocus: "確認主要使用者、情境與核心痛點",
    },
    define: {
      systemSummary: "目前共識偏向：先整合已知資訊並收斂成明確的問題定義與方向框架。",
      confirmedPoints: ["需要先完成重點整理與方向收斂", "團隊應聚焦於定義核心需求"],
      assumptions: ["較清楚的定義能降低後續設計與開發偏差"],
      nextFocus: "整理洞察並明確定義核心需求與優先順序",
    },
    develop: {
      systemSummary: "目前共識偏向：先探索可行概念與關鍵取捨，再收斂成較具體的產品方向。",
      confirmedPoints: ["需要比較不同概念與方案", "應評估功能取捨與體驗方向"],
      assumptions: ["適度發散後再收斂有助於找到更好的方向"],
      nextFocus: "比較候選方案並收斂主要概念方向",
    },
    deliver: {
      systemSummary: "目前共識偏向：先把方向轉成可執行的交付範圍、優先順序與風險控制。",
      confirmedPoints: ["應聚焦在可交付範圍與執行順序", "需降低實作與交付風險"],
      assumptions: ["明確的交付計畫能提升落地效率與品質"],
      nextFocus: "確認實作範圍、依賴關係與近期交付節奏",
    },
  };

  const currentStageSummary = stageSummary[input.project_stage] ?? stageSummary.discover;

  const responses = selectedMembers.map((member) => ({
    member_id: member.member_id,
    member_name: member.member_name,
    role_type_ai: member.role_type_ai,
    content: `${member.member_name} recommends treating "${input.user_message}" as ${stageFraming[input.project_stage] ?? "a product discussion"} from the ${member.role_type_ai} perspective.`,
  }));

  return {
    message_type: "feature_scope",
    discussion_stage: "aligning",
    selected_speakers: selectedMembers.map((member) => member.member_id),
    responses,
    system_summary: currentStageSummary.systemSummary,
    discussion_state_update: {
      confirmed_points: currentStageSummary.confirmedPoints,
      assumptions: currentStageSummary.assumptions,
      next_focus: currentStageSummary.nextFocus,
    },
    ready_for_report: false,
  };
}

function appendChatContent(existingChatContent: string, userMessage: string, responses: ConversationResponse[], systemSummary: string) {
  const segments: string[] = [];
  if (existingChatContent.trim()) segments.push(existingChatContent.trim());
  segments.push(`[User]\n${userMessage}`);
  for (const response of responses) {
    segments.push(`[${response.role_type_ai} - ${response.member_name}]\n${response.content}`);
  }
  segments.push(`[System Summary]\n${systemSummary}`);
  return segments.join("\n\n");
}

function buildProjectChatUpdatePayload(projectProperties: Record<string, DbProperty>, chatResult: ConversationOrchestratorResult, nextChatContent: string): NotionUpdatePageProperties {
  const payload: NotionUpdatePageProperties = {};
  const chatContentPropertyName = findPropertyName(projectProperties, ["chat_content"], "rich_text");
  const discussionStagePropertyName = findPropertyName(projectProperties, ["discussion_stage_ai"], "select");
  const confirmedPointsPropertyName = findPropertyName(projectProperties, ["confirmed_points_ai"], "rich_text");
  const assumptionsPropertyName = findPropertyName(projectProperties, ["assumptions_ai"], "rich_text");
  const nextFocusPropertyName = findPropertyName(projectProperties, ["next_focus_ai"], "rich_text");
  const readyForReportPropertyName = findPropertyName(projectProperties, ["ready_for_report_ai"], "checkbox");

  if (chatContentPropertyName) payload[chatContentPropertyName] = buildRichTextProperty(nextChatContent);
  if (discussionStagePropertyName) payload[discussionStagePropertyName] = buildSelectProperty(projectProperties, discussionStagePropertyName, chatResult.discussion_stage);
  if (confirmedPointsPropertyName) payload[confirmedPointsPropertyName] = buildRichTextProperty(joinLines(chatResult.discussion_state_update.confirmed_points));
  if (assumptionsPropertyName) payload[assumptionsPropertyName] = buildRichTextProperty(joinLines(chatResult.discussion_state_update.assumptions));
  if (nextFocusPropertyName) payload[nextFocusPropertyName] = buildRichTextProperty(chatResult.discussion_state_update.next_focus);
  if (readyForReportPropertyName) payload[readyForReportPropertyName] = buildCheckboxProperty(chatResult.ready_for_report);

  return payload;
}

async function updateProjectChatState(projectId: string, payload: NotionUpdatePageProperties) {
  await notion.pages.update({ page_id: projectId, properties: payload });
}

function handleChatRouteError(error: unknown) {
  if (error instanceof ChatRouteError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
  }
  const detail = error instanceof Error ? error.message : String(error);
  console.error("[POST /api/projects/[projectId]/chat]", error);
  return NextResponse.json({ ok: false, error: "Failed to process chat round", detail }, { status: 500 });
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const payload = chatRequestSchema.parse(body);

    const projectPage = await getProjectPage(projectId);
    const projectData = extractProjectForChat(projectPage);
    const teamMemberPages = await listTeamMembersByProject(projectId);
    const members = extractTeamMembersForChat(teamMemberPages);

    validateChatRequest(projectData, members, payload.user_message, payload.tagged_members);

    const orchestratorInput = buildConversationOrchestratorInput(projectData, members, payload.user_message, payload.tagged_members);
    const chatResult = await runConversationOrchestrator(orchestratorInput);
    const nextChatContent = appendChatContent(projectData.chat_content, payload.user_message, chatResult.responses, chatResult.system_summary);
    const updatePayload = buildProjectChatUpdatePayload(projectData.properties, chatResult, nextChatContent);
    await updateProjectChatState(projectId, updatePayload);

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      responses: chatResult.responses,
      system_summary: chatResult.system_summary,
      discussion_state: {
        discussion_stage_ai: chatResult.discussion_stage,
        confirmed_points_ai: joinLines(chatResult.discussion_state_update.confirmed_points),
        assumptions_ai: joinLines(chatResult.discussion_state_update.assumptions),
        next_focus_ai: chatResult.discussion_state_update.next_focus,
        ready_for_report_ai: chatResult.ready_for_report,
      },
    });
  } catch (error) {
    return handleChatRouteError(error);
  }
}


