import { NextResponse } from "next/server";
import { z } from "zod";
import { notion, getNotionDatabaseId } from "@/src/lib/notion";
import { PROJECT_STAGE_VALUES } from "@/src/constants/projectStages";

type NotionCreatePageProperties = NonNullable<Parameters<typeof notion.pages.create>[0]["properties"]>;

const createProjectSchema = z.object({
  project: z.string().trim().min(1).max(120),
  input_prompt_user: z.string().trim().min(1).max(4000),
  input_prompt_goal_user: z.string().trim().min(1).max(4000),
  currentstage_user: z.enum(PROJECT_STAGE_VALUES),
  status: z.string().trim().min(1).max(100).optional().default("draft"),
});

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createProjectSchema.parse(body);

    const databaseId = getNotionDatabaseId("project");
    const normalizedStatus = normalize(payload.status);
    const statusValue = normalizedStatus === "draft" ? "draft" : payload.status;

    const pageProperties: NotionCreatePageProperties = {
      project: {
        title: [{ type: "text", text: { content: payload.project.slice(0, 120) } }],
      },
      input_prompt_user: {
        rich_text: [{ type: "text", text: { content: payload.input_prompt_user } }],
      },
      input_prompt_goal_user: {
        rich_text: [{ type: "text", text: { content: payload.input_prompt_goal_user } }],
      },
      currentstage_user: {
        select: { name: payload.currentstage_user },
      },
      status: {
        status: { name: statusValue },
      },
    };

    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: pageProperties,
    });

    return NextResponse.json(
      {
        ok: true,
        project_id: page.id,
        project: payload.project,
        currentstage_user: payload.currentstage_user,
        status: statusValue,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request payload", details: error.flatten() },
        { status: 400 }
      );
    }

    const detail = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/projects/create]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create project in Notion", detail },
      { status: 500 }
    );
  }
}
