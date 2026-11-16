import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import NewsletterService from "../NewsletterService.ts";
import { NewsletterState } from "../state/NewsletterState.ts";

const name = "newsletter_selectNewsletter";
const displayName = "Newsletter/selectNewsletter";

async function execute({ provider, newsletter }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const service = agent.requireService(NewsletterService);
  const providerName = provider ?? agent.getState(NewsletterState).activeProvider ?? service.getAvailableNewsletters()[0];
  if (!providerName || !service.getNewsletterProvider(providerName)) {
    throw new ToolCallError(name, `Unknown newsletter provider. Available: ${service.getAvailableNewsletters().join(", ") || "none"}`);
  }
  const newsletters = await service.listNewsletters(providerName);
  const chosen = newsletters.find(candidate => candidate.id === newsletter || candidate.name === newsletter);
  if (!chosen) throw new ToolCallError(name, `${providerName} has no newsletter "${newsletter}". Available: ${newsletters.map(n => n.id).join(", ")}`);
  service.setActiveNewsletter(providerName, chosen.id, agent);
  return { message: `**Newsletter** Selected ${chosen.name}`, result: `Selected newsletter ${chosen.name} (${chosen.id}) on ${providerName}.` };
}

const description = "Choose which newsletter the other newsletter tools work on. Only needed when there is more than one.";

const inputSchema = z.object({
  newsletter: z.string().describe("The newsletter id or name"),
  provider: z.string().describe("The newsletter provider (for example the Ghost account name); defaults to the current one").exactOptional(),
});

export default { name, displayName, description, inputSchema, execute } satisfies TokenRingToolDefinition<typeof inputSchema>;
