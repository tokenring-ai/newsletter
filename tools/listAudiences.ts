import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import { z } from "zod";
import { requireActive } from "./support.ts";

const name = "newsletter_listAudiences";
const displayName = "Newsletter/listAudiences";

async function execute(_input: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const active = await requireActive(agent);
  const audiences = await active.provider.listAudiences(active.newsletter.id);
  return {
    message: `**Newsletter** Listed ${audiences.length} audiences of ${active.newsletter.name}`,
    result: `Audiences of ${active.newsletter.name} (${active.providerName}). Use the ID when scheduling or sending.\n\n${markdownTable(
      ["ID", "Name", "People"],
      audiences.map(audience => [audience.id, audience.name, audience.memberCount === undefined ? "unknown" : String(audience.memberCount)]),
    )}`,
  };
}

const description = "List who an issue of the selected newsletter can be sent to (everyone, free members, ...) with how many people each reaches.";

const inputSchema = z.object({});

export default { name, displayName, description, inputSchema, execute } satisfies TokenRingToolDefinition<typeof inputSchema>;
