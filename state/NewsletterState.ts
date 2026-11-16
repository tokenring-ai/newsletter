import type { Agent } from "@tokenring-ai/agent";
import { AgentStateSlice } from "@tokenring-ai/agent/types";
import { z } from "zod";
import type { ParsedNewsletterConfig } from "../schema.ts";

const serializationSchema = z
  .object({
    activeProvider: z.string().optional(),
    activeNewsletter: z.string().optional(),
  })
  .prefault({});

export class NewsletterState extends AgentStateSlice<typeof serializationSchema> {
  activeProvider: string | undefined;
  activeNewsletter: string | undefined;

  constructor(readonly initialConfig: ParsedNewsletterConfig["agentDefaults"]) {
    super("NewsletterState", serializationSchema);
    this.activeProvider = initialConfig.provider;
    this.activeNewsletter = initialConfig.newsletter;
  }

  transferStateFromParent(parent: Agent): void {
    const parentState = parent.getState(NewsletterState);
    this.activeProvider ??= parentState.activeProvider;
    this.activeNewsletter ??= parentState.activeNewsletter;
  }

  serialize(): z.output<typeof serializationSchema> {
    return { activeProvider: this.activeProvider, activeNewsletter: this.activeNewsletter };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.activeProvider = data.activeProvider;
    this.activeNewsletter = data.activeNewsletter;
  }

  show(): string {
    return `Active Newsletter: ${this.activeProvider ?? "(none)"}${this.activeNewsletter ? ` / ${this.activeNewsletter}` : ""}`;
  }
}
