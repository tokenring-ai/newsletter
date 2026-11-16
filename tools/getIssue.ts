import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import { requireActive, requireIssue } from "./support.ts";

const name = "newsletter_getIssue";
const displayName = "Newsletter/getIssue";

async function execute({ id }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const active = await requireActive(agent);
  const issue = await requireIssue(name, active, id);
  return { message: `**Newsletter** Read issue "${issue.subject}"`, result: JSON.stringify(issue) };
}

const description = "Read one issue of the selected newsletter, including its Markdown body, status and audience.";

const inputSchema = z.object({ id: z.string().describe("ID of the issue") });

export default { name, displayName, description, inputSchema, execute } satisfies TokenRingToolDefinition<typeof inputSchema>;
