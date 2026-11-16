import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import { z } from "zod";
import { IssueStatusSchema } from "../NewsletterProvider.ts";
import { requireActive } from "./support.ts";

const name = "newsletter_listIssues";
const displayName = "Newsletter/listIssues";

async function execute({ status, limit }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const active = await requireActive(agent);
  const issues = await active.provider.listIssues(active.newsletter.id, stripUndefinedKeys({ status, limit }));
  return {
    message: `**Newsletter** Listed ${issues.length} issues of ${active.newsletter.name}`,
    result:
      issues.length === 0
        ? `${active.newsletter.name} has no issues${status ? ` with status ${status}` : ""}.`
        : `Issues of ${active.newsletter.name} (${active.providerName}), most recently updated first\n\n${markdownTable(
            ["ID", "Subject", "Status", "Updated", "Scheduled for", "Sent"],
            issues.map(issue => [
              issue.id,
              issue.subject,
              issue.status,
              new Date(issue.updatedAt).toISOString(),
              issue.scheduledAt ? new Date(issue.scheduledAt).toISOString() : "",
              issue.sentAt ? new Date(issue.sentAt).toISOString() : "",
            ]),
          )}`,
  };
}

const description = "List issues of the selected newsletter (drafts, scheduled and sent), newest first, optionally by status.";

const inputSchema = z.object({
  status: IssueStatusSchema.describe("Only issues with this status").exactOptional(),
  limit: z.number().int().min(1).max(100).default(25),
});

export default { name, displayName, description, inputSchema, execute } satisfies TokenRingToolDefinition<typeof inputSchema>;
