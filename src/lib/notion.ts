import "server-only";
import { Client } from "@notionhq/client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const notion = new Client({
  auth: requireEnv("NOTION_API_KEY"),
});

export const notionDatabaseEnvKeys = {
  project: "NOTION_PROJECT_DB_ID",
  teamMembers: "NOTION_TEAMMEMBERS_DB_ID",
  chats: "NOTION_CHATS_DB_ID",
  reportSections: "NOTION_REPORTSECTIONS_DB_ID",
} as const;

export function getNotionDatabaseId(key: keyof typeof notionDatabaseEnvKeys): string {
  return requireEnv(notionDatabaseEnvKeys[key]);
}
