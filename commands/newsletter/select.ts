import type { TreeLeaf } from "@tokenring-ai/agent/question";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import NewsletterService from "../../NewsletterService.ts";
import { NewsletterState } from "../../state/NewsletterState.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({ agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const service = agent.requireService(NewsletterService);
  const providers = service.getAvailableNewsletters();
  if (providers.length === 0) return "No newsletter providers are registered. Connect one in Configuration (see the Ghost newsletters setup).";

  const state = agent.getState(NewsletterState);
  const options: { provider: string; id: string; name: string }[] = [];
  for (const provider of providers) {
    for (const newsletter of await service.listNewsletters(provider)) options.push({ provider, id: newsletter.id, name: newsletter.name });
  }
  if (options.length === 0) return "The connected providers have no newsletters.";
  if (options.length === 1 && options[0]) {
    service.setActiveNewsletter(options[0].provider, options[0].id, agent);
    return `Only one newsletter, auto-selecting: ${options[0].name} (${options[0].provider})`;
  }

  const keyOf = (option: { provider: string; id: string }) => JSON.stringify([option.provider, option.id]);
  const tree: TreeLeaf[] = options.map(option => ({
    name: `${option.name} (${option.provider})${option.provider === state.activeProvider && option.id === state.activeNewsletter ? " (current)" : ""}`,
    value: keyOf(option),
  }));
  const selection = await agent.askQuestion({
    message: "Select a newsletter",
    question: { type: "treeSelect", label: "Newsletter Selection", key: "result", minimumSelections: 1, maximumSelections: 1, tree },
  });
  const chosen = options.find(option => keyOf(option) === selection?.[0]);
  if (!chosen) return "Newsletter selection cancelled.";
  service.setActiveNewsletter(chosen.provider, chosen.id, agent);
  return `Active newsletter set to: ${chosen.name} (${chosen.provider})`;
}

export default {
  name: "newsletter select",
  description: "Interactively select the newsletter to work on",
  inputSchema,
  help: `Choose which newsletter this agent drafts and sends issues for. Auto-selects when there is only one.\n\n## Example\n\n/newsletter select`,
  execute,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
