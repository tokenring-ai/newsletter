import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import NewsletterService from "../../NewsletterService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({ agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const active = await agent.requireService(NewsletterService).requireActiveNewsletter(agent);
  const issues = await active.provider.listIssues(active.newsletter.id, { limit: 25 });
  if (issues.length === 0) return `${active.newsletter.name} has no issues yet.`;
  return issues
    .map(issue => {
      const when = issue.scheduledAt
        ? ` for ${new Date(issue.scheduledAt).toLocaleString()}`
        : issue.sentAt
          ? ` on ${new Date(issue.sentAt).toLocaleString()}`
          : "";
      return `${issue.id}  [${issue.status}${when}]  ${issue.subject}`;
    })
    .join("\n");
}

export default {
  name: "newsletter issues",
  description: "List recent issues of the active newsletter",
  inputSchema,
  execute,
  help: `List the 25 most recently updated issues of the active newsletter with their status.\n\n## Example\n\n/newsletter issues`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
