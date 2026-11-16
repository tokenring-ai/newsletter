import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import { z } from "zod";
import { requireActive, stripLeadingHeading } from "./support.ts";

const name = "newsletter_createIssue";
const displayName = "Newsletter/createIssue";

async function execute({ subject, preheader, contentInMarkdown, audience }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const active = await requireActive(agent);
  // A draft is only visible to the people who run the newsletter, so creating one does not ask.
  const issue = await active.provider.createIssue(
    stripUndefinedKeys({ newsletter: active.newsletter.id, subject, preheader, markdown: stripLeadingHeading(contentInMarkdown), audience }),
  );
  agent.infoMessage(`[${name}] Draft created with ID: ${issue.id}`);
  return {
    message: `**Newsletter** Created draft "${subject}" in ${active.newsletter.name}`,
    result: `Created a DRAFT. Nothing has been emailed.\n${JSON.stringify(issue)}`,
  };
}

const description =
  "Create a new newsletter issue as a draft in the selected newsletter. Nothing is emailed: use newsletter_scheduleIssue or newsletter_sendIssue (which always ask a person first) to deliver it.";

const inputSchema = z.object({
  subject: z.string().describe("The email subject line"),
  preheader: z.string().describe("The short preview text shown after the subject in inboxes").exactOptional(),
  contentInMarkdown: z.string().describe("The body in Markdown. The subject goes in the subject field, NOT inside the content"),
  audience: z.string().describe("Audience id to save with the draft (see newsletter_listAudiences). It can be chosen later.").exactOptional(),
});

export default { name, displayName, description, inputSchema, execute } satisfies TokenRingToolDefinition<typeof inputSchema>;
