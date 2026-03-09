import { NextResponse } from "next/server";
import { z } from "zod";
import { notion, getNotionDatabaseId } from "@/src/lib/notion";

type DbProperty = {
  type: string;
  select?: {
    options?: Array<{ name: string }>;
  };
};

const createProjectSchema = z.object({
  user_name: z.string().trim().min(1).max(100),
  input_prompt: z.string().trim().min(1).max(4000),
  is_public: z.boolean().optional().default(false),
});

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
    return typeMatches && Array.from(normalizedCandidates).some((c) => normalizedName.includes(c));
  });

  return partialMatch?.[0];
}

function setTextProperty(
  target: Record<string, unknown>,
  properties: Record<string, DbProperty>,
  propertyName: string | undefined,
  value: string
) {
  if (!propertyName) return;

  const property = properties[propertyName];
  if (!property) return;

  if (property.type === "title") {
    target[propertyName] = {
      title: [{ type: "text", text: { content: value } }],
    };
  }

  if (property.type === "rich_text") {
    target[propertyName] = {
      rich_text: [{ type: "text", text: { content: value } }],
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createProjectSchema.parse(body);

    const databaseId = getNotionDatabaseId("project");
    const db = await notion.databases.retrieve({ database_id: databaseId });
    const properties = db.properties as Record<string, DbProperty>;

    const pageProperties: Record<string, unknown> = {};

    const titlePropertyName = Object.entries(properties).find(([, prop]) => prop.type === "title")?.[0];
    const fallbackTitle = `${payload.user_name} - ${payload.input_prompt}`.slice(0, 120);
    setTextProperty(pageProperties, properties, titlePropertyName, fallbackTitle);

    const userNamePropertyName =
      findPropertyName(properties, ["user_name", "username", "user"], "rich_text") ??
      findPropertyName(properties, ["user_name", "username", "user"], "title");

    const inputPromptPropertyName =
      findPropertyName(properties, ["input_prompt", "prompt", "project_prompt"], "rich_text") ??
      findPropertyName(properties, ["input_prompt", "prompt", "project_prompt"], "title");

    setTextProperty(pageProperties, properties, userNamePropertyName, payload.user_name);
    setTextProperty(pageProperties, properties, inputPromptPropertyName, payload.input_prompt);

    const statusPropertyName = findPropertyName(properties, ["status"], "select");
    if (statusPropertyName) {
      const options = properties[statusPropertyName]?.select?.options ?? [];
      const statusName = options.find((o) => normalize(o.name) === "draft")?.name ?? options[0]?.name;
      if (statusName) {
        pageProperties[statusPropertyName] = {
          select: { name: statusName },
        };
      }
    }

    const isPublicPropertyName = findPropertyName(properties, ["is_public", "public"], "checkbox");
    if (isPublicPropertyName) {
      pageProperties[isPublicPropertyName] = {
        checkbox: payload.is_public,
      };
    }

    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: pageProperties,
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

    const detail = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/projects/create]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create project in Notion", detail },
      { status: 500 }
    );
  }
}
