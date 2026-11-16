import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import { requireActive, requireContent, requireDeliveryApproval, requireIssue, requireUnchangedSince, resolveAudience } from "./support.ts";

const name = "newsletter_sendIssue";
const displayName = "Newsletter/sendIssue";

async function execute({ id, audience: requestedAudience }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const active = await requireActive(agent);
  const issue = await requireIssue(name, active, id);

  if (issue.status === "sent") throw new ToolCallError(name, `"${issue.subject}" has already been sent.`);
  if (issue.status === "scheduled" && issue.scheduledAt !== undefined && issue.scheduledAt <= Date.now()) {
    throw new ToolCallError(name, `"${issue.subject}" is already going out (its scheduled time has passed).`);
  }
  requireContent(name, issue);
  const audience = await resolveAudience(name, active, issue, requestedAudience);

  await requireDeliveryApproval(agent, { toolName: name, active, issue, audience });
  await requireUnchangedSince(name, active, issue);

  const sent = await active.provider.sendIssue(id, audience.id);
  return {
    message: `**Newsletter** Sent "${sent.subject}" to ${audience.name}`,
    result: `Sent "${sent.subject}" to ${audience.name} (${active.newsletter.name}). It cannot be recalled.\n${JSON.stringify(sent)}`,
  };
}

const description =
  "Email a draft (or scheduled) issue to an audience NOW. This reaches real people and cannot be undone, so it always asks a person first, unless they previously chose Always allow for this newsletter. " +
  "Refuses issues that were already sent or that have no subject or body. To send later, use newsletter_scheduleIssue.";

const inputSchema = z.object({
  id: z.string().describe("ID of the issue"),
  audience: z.string().describe("Audience id to email (see newsletter_listAudiences). Defaults to the audience saved with the issue.").exactOptional(),
});

export default { name, displayName, description, inputSchema, execute } satisfies TokenRingToolDefinition<typeof inputSchema>;
