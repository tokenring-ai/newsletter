import type Agent from "@tokenring-ai/agent/Agent";
import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent.test";
import type TokenRingApp from "@tokenring-ai/app";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import ChatService from "@tokenring-ai/chat/ChatService";
import PermissionService, { MemoryPermissionStore } from "@tokenring-ai/chat/PermissionService";
import type { ParsedChatConfig } from "@tokenring-ai/chat/schema";
import NewsletterService from "../NewsletterService.ts";
import { NewsletterConfigSchema } from "../schema.ts";
import TestNewsletterProvider from "./TestNewsletterProvider.ts";

type Tree = { name: string; value: string }[];

/**
 * A real ChatService and PermissionService (the approval and grant code the app runs), a newsletter service with an
 * in-memory provider, and an agent whose approval questions are answered by `answerWith`.
 */
export function createHarness(chatConfig: Partial<ParsedChatConfig> = { autoToolApprovalLevel: 2, toolApprovalMode: "ask" }) {
  const app = createTestingApp() as TokenRingApp;
  const chat = new ChatService(app);
  chat.getChatConfig = () => chatConfig as ParsedChatConfig;
  // Attaching would need the agent's chat config; approvals only need getChatConfig.
  chat.attach = () => {};
  app.addService(ChatService, chat);
  const permissions = app.addService(PermissionService, new PermissionService(app, new MemoryPermissionStore()));

  const service = new NewsletterService(NewsletterConfigSchema.parse({}));
  app.addService(NewsletterService, service);
  const provider = new TestNewsletterProvider();
  service.registerNewsletter("My Site.com", provider);

  const agent: Agent = createTestingAgent(app);
  service.attach(agent, { items: [] as string[] });
  service.setActiveNewsletter("My Site.com", "weekly", agent);

  // What a person is shown, and how they answer.
  const questions: { message: string; options: string[] }[] = [];
  let answer: string | null = "Not approved";
  agent.askQuestion = (async (input: { message: string; question: { tree: Tree } }) => {
    questions.push({ message: input.message, options: input.question.tree.map(option => option.value) });
    return answer === null ? null : [answer];
  }) as unknown as Agent["askQuestion"];
  agent.infoMessage = (() => {}) as Agent["infoMessage"];

  return {
    app,
    agent,
    service,
    provider,
    permissions,
    questions,
    /** "Approved", "Not approved", or null (nobody answers). */
    answerWith: (value: string | null) => {
      answer = value;
    },
  };
}

export const PERMISSION_ID = "newsletter.my-site-com.weekly.send";
