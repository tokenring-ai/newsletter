import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import NewsletterService from "../../NewsletterService.ts";
import { NewsletterState } from "../../state/NewsletterState.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({ agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const service = agent.requireService(NewsletterService);
  const providers = service.getAvailableNewsletters();
  if (providers.length === 0) return "No newsletter providers are registered.";
  const state = agent.getState(NewsletterState);
  const lines: string[] = [];
  for (const provider of providers) {
    lines.push(`${provider}:`);
    for (const newsletter of await service.listNewsletters(provider)) {
      const active = provider === state.activeProvider && newsletter.id === state.activeNewsletter;
      lines.push(`  ${newsletter.name} (${newsletter.id})${active ? " (active)" : ""}`);
    }
  }
  return lines.join("\n");
}

export default {
  name: "newsletter list",
  description: "List the newsletters of every connected provider",
  inputSchema,
  execute,
  help: `List the newsletters of every connected provider, marking the active one.\n\n## Example\n\n/newsletter list`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
