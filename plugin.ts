import { AgentCommandService } from "@tokenring-ai/agent";
import type { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { RpcService } from "@tokenring-ai/rpc";
import { z } from "zod";
import agentCommands from "./commands.ts";
import config from "./config/index.ts";
import { NewsletterConfigSchema } from "./index.ts";
import NewsletterService from "./NewsletterService.ts";
import packageJSON from "./package.json" with { type: "json" };
import newsletterRPC from "./rpc/newsletter.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  newsletter: NewsletterConfigSchema.prefault({}),
});

export default {
  name: packageJSON.name,
  displayName: "Newsletter Service",
  version: packageJSON.version,
  description: packageJSON.description,
  config,
  install(app) {
    app.addService(NewsletterService, new NewsletterService());
    app.waitForService(ChatService, chatService => chatService.addTools(tools));
    app.waitForService(AgentCommandService, agentCommandService => agentCommandService.addAgentCommands(agentCommands));
    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(newsletterRPC);
    });
  },
  reconfigure(app, config) {
    app.requireService(NewsletterService).reconfigure(config.newsletter);
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
