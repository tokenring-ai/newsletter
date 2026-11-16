import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { z } from "zod";

export const NewsletterAgentConfigSchema = z
  .object({
    provider: z.string().exactOptional(),
    newsletter: z.string().exactOptional(),
  })
  .default({});

export const NewsletterConfigSchema = z
  .object({
    agentDefaults: z
      .object({
        provider: z
          .string()
          .exactOptional()
          .meta({ description: "Newsletter provider (for example a Ghost account name) new agents work with by default" } satisfies ConfigFieldMeta),
        newsletter: z
          .string()
          .exactOptional()
          .meta({ description: "Newsletter within that provider new agents work with by default" } satisfies ConfigFieldMeta),
      })
      .prefault({})
      .meta({ label: "Agent Defaults" } satisfies ConfigFieldMeta),
    agentTypes: z
      .array(z.string())
      .default(["newsletter", "writer", "contentWriter", "content-writer", "managingEditor"])
      .meta({ description: "The available agent types that can be used to draft newsletter issues" } satisfies ConfigFieldMeta),
  })
  .meta({ label: "Newsletter", description: "Newsletter drafting and sending settings" } satisfies ConfigFieldMeta);

export type ParsedNewsletterConfig = z.output<typeof NewsletterConfigSchema>;
