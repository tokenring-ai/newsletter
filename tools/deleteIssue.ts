import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ApprovalLevel } from "@tokenring-ai/chat/schema";
import { requireToolApproval } from "@tokenring-ai/chat/util/requireToolApproval";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import { requireActive, requireIssue } from "./support.ts";

const name = "newsletter_deleteIssue";
const displayName = "Newsletter/deleteIssue";

async function execute({ id }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const active = await requireActive(agent);
  const issue = await requireIssue(name, active, id);
  if (issue.status !== "draft") {
    throw new ToolCallError(name, `"${issue.subject}" is ${issue.status}. Only drafts can be deleted.`);
  }
  await requireToolApproval(agent, {
    toolName: name,
    message: `Delete the draft "${issue.subject}" from ${active.newsletter.name}?`,
    detailedDescription: "The draft and its text are removed from the newsletter service. Nothing has been emailed.",
    // Destroys the person's own writing.
    safetyLevel: ApprovalLevel.OwnDataLoss,
    default: false,
  });
  await active.provider.deleteIssue(id);
  return { message: `**Newsletter** Deleted draft "${issue.subject}"`, result: `Deleted draft "${issue.subject}" (${id}).` };
}

const description = "Delete a draft issue of the selected newsletter (only drafts; asks first).";

const inputSchema = z.object({ id: z.string().describe("ID of the draft") });

export default { name, displayName, description, inputSchema, execute } satisfies TokenRingToolDefinition<typeof inputSchema>;
