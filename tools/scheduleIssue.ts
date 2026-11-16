import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import { requireActive, requireContent, requireDeliveryApproval, requireIssue, requireUnchangedSince, resolveAudience } from "./support.ts";

const name = "newsletter_scheduleIssue";
const displayName = "Newsletter/scheduleIssue";

async function execute({ id, sendAt, audience: requestedAudience }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const active = await requireActive(agent);
  const issue = await requireIssue(name, active, id);

  if (!active.provider.supportedStatuses.includes("scheduled")) throw new ToolCallError(name, `${active.providerName} does not support scheduled issues.`);
  if (issue.status === "sent") throw new ToolCallError(name, `"${issue.subject}" has already been sent.`);
  if (issue.status === "scheduled" && issue.scheduledAt !== undefined && issue.scheduledAt <= Date.now()) {
    throw new ToolCallError(name, `"${issue.subject}" is already going out (its scheduled time has passed).`);
  }
  const at = Date.parse(sendAt);
  if (Number.isNaN(at)) throw new ToolCallError(name, `"${sendAt}" is not a date and time. Use ISO 8601, for example 2026-11-20T09:00:00-05:00.`);
  if (at <= Date.now()) throw new ToolCallError(name, "The send time must be in the future.");
  requireContent(name, issue);
  const audience = await resolveAudience(name, active, issue, requestedAudience);

  await requireDeliveryApproval(agent, { toolName: name, active, issue, audience, at });
  await requireUnchangedSince(name, active, issue);

  const scheduled = await active.provider.scheduleIssue(id, at, audience.id);
  return {
    message: `**Newsletter** Scheduled "${scheduled.subject}" for ${new Date(at).toISOString()}`,
    result: `Scheduled "${scheduled.subject}" to go to ${audience.name} at ${new Date(at).toISOString()}.\n${JSON.stringify(scheduled)}`,
  };
}

const description =
  "Schedule a draft issue to be emailed to an audience at a future time. It will reach real people with no one asked again, so it always asks a person first, unless they previously chose Always allow for this newsletter. " +
  "To send right now, use newsletter_sendIssue.";

const inputSchema = z.object({
  id: z.string().describe("ID of the issue"),
  sendAt: z.string().describe("When to send, as an ISO 8601 date and time with a UTC offset, for example 2026-11-20T09:00:00-05:00"),
  audience: z.string().describe("Audience id to email (see newsletter_listAudiences). Defaults to the audience saved with the issue.").exactOptional(),
});

export default { name, displayName, description, inputSchema, execute } satisfies TokenRingToolDefinition<typeof inputSchema>;
