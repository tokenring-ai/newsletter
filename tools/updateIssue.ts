import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import { z } from "zod";
import type { UpdateIssueData } from "../NewsletterProvider.ts";
import { requireActive, requireIssue, requireScheduledEditApproval, stripLeadingHeading } from "./support.ts";

const name = "newsletter_updateIssue";
const displayName = "Newsletter/updateIssue";

async function execute({ id, subject, preheader, contentInMarkdown, audience }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const active = await requireActive(agent);
  const issue = await requireIssue(name, active, id);
  if (issue.status === "sent") throw new ToolCallError(name, `"${issue.subject}" has already been sent and cannot be changed.`);

  const update: UpdateIssueData = stripUndefinedKeys({
    subject,
    preheader,
    markdown: contentInMarkdown === undefined ? undefined : stripLeadingHeading(contentInMarkdown),
    audience,
  });
  if (Object.keys(update).length === 0) throw new ToolCallError(name, "Nothing to change: pass a subject, preheader, content or audience.");

  // Changing a scheduled issue changes what people will be emailed later, with no one looking again.
  if (issue.status === "scheduled") await requireScheduledEditApproval(agent, { toolName: name, active, issue });

  const updated = await active.provider.updateIssue(id, update);
  return { message: `**Newsletter** Updated "${updated.subject}"`, result: JSON.stringify(updated) };
}

const description = "Edit a draft or scheduled issue (not a sent one). Editing a scheduled issue changes what will be emailed, so it asks a person first.";

const inputSchema = z.object({
  id: z.string().describe("ID of the issue"),
  subject: z.string().describe("New subject line").exactOptional(),
  preheader: z.string().describe("New preview text").exactOptional(),
  contentInMarkdown: z.string().describe("New body in Markdown (the subject goes in the subject field)").exactOptional(),
  audience: z.string().describe("Audience id to save with the issue").exactOptional(),
});

export default { name, displayName, description, inputSchema, execute } satisfies TokenRingToolDefinition<typeof inputSchema>;
