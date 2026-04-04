import { NextResponse } from "next/server";
import { z } from "zod";
import { notion } from "@/src/lib/notion";

type DbProperty = {
  type: string;
  relation?: Array<{ id: string }>;
};

const updateTeamMemberSchema = z.object({
  roleBackgroundIdentity: z.string().trim().min(1).max(4000),
  roleTarget: z.string().trim().min(1).max(4000),
  roleKnowledgeReference: z.string().trim().min(1).max(4000),
  roleRules: z.string().trim().min(1).max(4000),
  roleWorkflow: z.string().trim().min(1).max(4000),
  roleResponseFormat: z.string().trim().min(1).max(4000),
  roleTone: z.string().trim().min(1).max(1000),
});

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

async function assertMemberBelongsToProject(memberId: string, projectId: string) {
  const page = await notion.pages.retrieve({ page_id: memberId });

  if (!("properties" in page)) {
    throw new Error("Team member page response is missing properties");
  }

  const properties = page.properties as Record<string, DbProperty>;
  const relatedProjects = properties.project?.relation ?? [];
  const belongsToProject = relatedProjects.some((relation) => relation.id === projectId);

  if (!belongsToProject) {
    return false;
  }

  return true;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; memberId: string }> }
) {
  try {
    const body = await request.json();
    const payload = updateTeamMemberSchema.parse(body);
    const { projectId, memberId } = await context.params;

    const belongsToProject = await assertMemberBelongsToProject(memberId, projectId);
    if (!belongsToProject) {
      return NextResponse.json(
        { ok: false, error: "Team member does not belong to this project" },
        { status: 404 }
      );
    }

    await notion.pages.update({
      page_id: memberId,
      properties: {
        role_background_identity: buildRichTextProperty(payload.roleBackgroundIdentity),
        role_target: buildRichTextProperty(payload.roleTarget),
        role_knowledge_reference: buildRichTextProperty(payload.roleKnowledgeReference),
        role_rules: buildRichTextProperty(payload.roleRules),
        role_workflow: buildRichTextProperty(payload.roleWorkflow),
        role_response_format: buildRichTextProperty(payload.roleResponseFormat),
        role_tone: buildRichTextProperty(payload.roleTone),
      },
    });

    return NextResponse.json({
      ok: true,
      member_id: memberId,
      member: {
        member_id: memberId,
        role_background_identity: payload.roleBackgroundIdentity,
        role_target: payload.roleTarget,
        role_knowledge_reference: payload.roleKnowledgeReference,
        role_rules: payload.roleRules,
        role_workflow: payload.roleWorkflow,
        role_response_format: payload.roleResponseFormat,
        role_tone: payload.roleTone,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request payload", details: error.flatten() },
        { status: 400 }
      );
    }

    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: "Failed to update team member", detail },
      { status: 500 }
    );
  }
}
