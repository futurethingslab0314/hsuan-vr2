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

const conversationResponseSchema = z.object({
  member_id: z.string(),
  member_name: z.string(),
  role_type_ai: z.string(),
  content: z.string(),
});

const conversationOrchestratorSchema = z.object({
  message_type: z.enum([
    "clarification",
    "product_direction",
    "feature_scope",
    "user_flow",
    "interface_design",
    "technical_feasibility",
    "validation",
    "wrap_up",
  ]),
  selected_speakers: z.array(z.string()).max(2),
  responses: z.array(conversationResponseSchema).max(2),
  system_summary: z.string(),
  discussion_state_update: z.object({
    confirmed_points: z.array(z.string()),
    assumptions: z.array(z.string()),
    next_focus: z.string(),
  }),
  ready_for_report: z.boolean(),
});

type DiscussionStage = "clarifying" | "exploring" | "framing" | "wrapping";
const ALLOWED_ROLE_TYPES = ["PM", "Researcher", "UX Designer", "Engineer"] as const;

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

function normalizeRoleType(value: string): (typeof ALLOWED_ROLE_TYPES)[number] {
  const normalized = value.trim().toLowerCase();

  if (normalized === "pm" || normalized === "product manager") return "PM";
  if (normalized === "researcher" || normalized === "ux strategist") return "Researcher";
  if (normalized === "ux designer" || normalized === "ux" || normalized === "ui" || normalized === "ui designer") return "UX Designer";
  if (normalized === "engineer" || normalized === "prototyper") return "Engineer";

  return "Engineer";
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function joinLines(values: string[]): string {
  return values.join("\n");
}

function normalizeDiscussionStage(value: string | undefined): DiscussionStage {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "clarifying" ||
    normalized === "exploring" ||
    normalized === "framing" ||
    normalized === "wrapping"
  ) {
    return normalized;
  }

  return "clarifying";
}

function hasAnyKeyword(value: string, keywords: string[]) {
  const text = value.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
}

function shouldAdvanceToExploring(userMessage: string, systemSummary: string, nextFocus: string) {
  const combined = `${userMessage}\n${systemSummary}\n${nextFocus}`.toLowerCase();

  return hasAnyKeyword(combined, [
    "方向",
    "方案",
    "可能性",
    "做法",
    "選項",
    "探索",
    "比較不同",
    "有哪些",
    "可以怎麼做",
    "opportunity",
    "options",
    "approach",
    "explore",
  ]);
}

function shouldAdvanceToFraming(systemSummary: string, confirmedPoints: string, nextFocus: string) {
  const combined = `${systemSummary}\n${confirmedPoints}\n${nextFocus}`.toLowerCase();

  return hasAnyKeyword(combined, [
    "收斂",
    "方向",
    "核心",
    "優先",
    "取捨",
    "共識",
    "定義",
    "範圍",
    "mvp",
    "priority",
    "tradeoff",
    "direction",
    "focus",
  ]);
}

function shouldAdvanceToWrapping(userMessage: string, systemSummary: string, confirmedPoints: string, nextFocus: string) {
  const combined = `${userMessage}\n${systemSummary}\n${confirmedPoints}\n${nextFocus}`.toLowerCase();

  return hasAnyKeyword(combined, [
    "結論",
    "總結",
    "下一步",
    "行動",
    "報告",
    "整理",
    "定案",
    "共識",
    "執行",
    "summary",
    "next step",
    "action",
    "report",
    "wrap",
  ]);
}

function determineDiscussionStage({
  currentStage,
  userMessage,
  systemSummary,
  confirmedPoints,
  nextFocus,
}: {
  currentStage: string;
  userMessage: string;
  systemSummary: string;
  confirmedPoints: string[];
  nextFocus: string;
}): DiscussionStage {
  const stage = normalizeDiscussionStage(currentStage);
  const confirmedPointsText = joinLines(confirmedPoints);

  if (stage === "clarifying") {
    if (shouldAdvanceToExploring(userMessage, systemSummary, nextFocus)) {
      return "exploring";
    }
    return "clarifying";
  }

  if (stage === "exploring") {
    if (shouldAdvanceToFraming(systemSummary, confirmedPointsText, nextFocus)) {
      return "framing";
    }
    return "exploring";
  }

  if (stage === "framing") {
    if (shouldAdvanceToWrapping(userMessage, systemSummary, confirmedPointsText, nextFocus)) {
      return "wrapping";
    }
    return "framing";
  }

  return "wrapping";
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

  return {
    properties,
    project: getTitleValue(properties, "project"),
    currentstage_user: getSelectValue(properties, "currentstage_user"),
    project_summary_ai: getRichTextValue(properties, "project_summary_ai"),
    problem_statement_ai: getRichTextValue(properties, "problem_statement_ai"),
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
    throw new ChatRouteError("TEAM_MEMBER database metadata is incomplete", 500);
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

function extractTeamMembersForChat(teamMemberPages: Array<Awaited<ReturnType<typeof notion.dataSources.query>>["results"][number]>): TeamMemberForChat[] {
  return teamMemberPages
    .filter((page): page is Extract<typeof page, { properties: Record<string, DbProperty>; id: string }> => "properties" in page)
    .map((page) => {
      const properties = page.properties as Record<string, DbProperty>;
      return {
        member_id: page.id,
        member_name: getTitleValue(properties, "member_name"),
        role_type_ai: normalizeRoleType(getSelectValue(properties, "role_type_ai")),
        custom_role_label_ai: getRichTextValue(properties, "custom_role_label_ai"),
        is_custom_role: getCheckboxValue(properties, "is_custom_role"),
        role_background_identity: getRichTextValue(properties, "role_background_identity"),
        role_target: getRichTextValue(properties, "role_target"),
        role_knowledge_reference: getRichTextValue(properties, "role_knowledge_reference"),
        role_rules: getRichTextValue(properties, "role_rules"),
        role_workflow: getRichTextValue(properties, "role_workflow"),
        role_response_format: getRichTextValue(properties, "role_response_format"),
        role_tone: getRichTextValue(properties, "role_tone"),
        why_this_role: getRichTextValue(properties, "why_this_role"),
        routing_good_for: getRichTextValue(properties, "routing_good_for"),
        routing_avoid_for: getRichTextValue(properties, "routing_avoid_for"),
        routing_pairs_well_with: getRichTextValue(properties, "routing_pairs_well_with"),
        display_order: getNumberValue(properties, "display_order"),
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
  const response = await openai.responses.parse({
    model: "gpt-4o-2024-08-06",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are Conversation Orchestrator for AI Team Builder.",
              "Your job is to coordinate a small AI team discussion.",
              "Return only valid structured output.",
              "Select at most 2 speakers.",
              "If tagged_members is not empty, prioritize them.",
              "Responses must reflect each member's role, expertise, workflow, tone, and constraints.",
              "The second speaker should add support, challenge, tradeoff, implementation, or validation perspective instead of repeating the first.",
              "system_summary should summarize the current discussion state clearly.",
              "ready_for_report should be true only when the discussion has enough clarity, confirmed points, and next steps.",
              "Project stages are: discover, define, develop, deliver.",
              "All response content must be written in Traditional Chinese used in Taiwan.",
              "Do not reply in English unless the user explicitly asks for English.",
              "member_name and role_type_ai may remain as provided, but content, system_summary, confirmed_points, assumptions, and next_focus must be in Traditional Chinese.",
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
      format: zodTextFormat(conversationOrchestratorSchema, "conversation_orchestrator_result"),
    },
  });

  const parsed = response.output_parsed;

  if (!parsed) {
    throw new ChatRouteError("Conversation Orchestrator returned no structured output", 500);
  }

  const selectedMembers =
    parsed.selected_speakers.length > 0
      ? input.members.filter((member) => parsed.selected_speakers.includes(member.member_id))
      : [];

  const fallbackResponses =
    parsed.responses.length > 0
      ? parsed.responses
      : selectedMembers.slice(0, 2).map((member) => ({
          member_id: member.member_id,
          member_name: member.member_name,
          role_type_ai: member.role_type_ai,
          content: `${member.member_name} 正在從 ${member.role_type_ai} 的角度回應「${input.user_message}」。`,
        }));

  const nextDiscussionStage = determineDiscussionStage({
    currentStage: input.decision_state.discussion_stage_ai,
    userMessage: input.user_message,
    systemSummary: parsed.system_summary,
    confirmedPoints: parsed.discussion_state_update.confirmed_points,
    nextFocus: parsed.discussion_state_update.next_focus,
  });

  const readyForReport =
    nextDiscussionStage === "wrapping" &&
    parsed.discussion_state_update.confirmed_points.length > 0 &&
    parsed.discussion_state_update.next_focus.trim().length > 0;

  return {
    message_type: parsed.message_type,
    discussion_stage: nextDiscussionStage,
    selected_speakers: parsed.selected_speakers,
    responses: fallbackResponses,
    system_summary: parsed.system_summary,
    discussion_state_update: parsed.discussion_state_update,
    ready_for_report: readyForReport || parsed.ready_for_report,
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
  if (projectProperties.chat_content?.type === "rich_text") {
    payload.chat_content = buildRichTextProperty(nextChatContent);
  }
  if (projectProperties.discussion_stage_ai?.type === "select" || projectProperties.discussion_stage_ai?.type === "status") {
    payload.discussion_stage_ai = buildSelectProperty(projectProperties, "discussion_stage_ai", chatResult.discussion_stage);
  }
  if (projectProperties.confirmed_points_ai?.type === "rich_text") {
    payload.confirmed_points_ai = buildRichTextProperty(joinLines(chatResult.discussion_state_update.confirmed_points));
  }
  if (projectProperties.assumptions_ai?.type === "rich_text") {
    payload.assumptions_ai = buildRichTextProperty(joinLines(chatResult.discussion_state_update.assumptions));
  }
  if (projectProperties.next_focus_ai?.type === "rich_text") {
    payload.next_focus_ai = buildRichTextProperty(chatResult.discussion_state_update.next_focus);
  }
  if (projectProperties.ready_for_report_ai?.type === "checkbox") {
    payload.ready_for_report_ai = buildCheckboxProperty(chatResult.ready_for_report);
  }

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
