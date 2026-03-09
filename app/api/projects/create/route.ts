import { NextResponse } from "next/server";
import { z } from "zod";
import { notion, getNotionDatabaseId } from "@/src/lib/notion";

const createProjectSchema = z.object({
  user_name: z.string().trim().min(1).max(100),
  input_prompt: z.string().trim().min(1).max(4000),
  is_public: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createProjectSchema.parse(body);

    const page = await notion.pages.create({
      parent: { database_id: getNotionDatabaseId("project") },
      properties: {
        user_name: {
          rich_text: [{ type: "text", text: { content: payload.user_name } }],
        },
        input_prompt: {
          rich_text: [{ type: "text", text: { content: payload.input_prompt } }],
        },
        status: {
          select: { name: "draft" },
        },
        is_public: {
          checkbox: payload.is_public,
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        project_id: page.id,
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

    console.error("[POST /api/projects/create]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create project in Notion" },
      { status: 500 }
    );
  }
}
