import type TokenRingApp from "@tokenring-ai/app";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import NewsletterService from "../NewsletterService.ts";
import NewsletterRpcSchema from "./schema.ts";

export default createRPCEndpoint(NewsletterRpcSchema, {
  getNewsletterConfiguration(_args, app: TokenRingApp) {
    const service = app.requireService(NewsletterService);
    return { providers: service.describeProviders(), agentTypes: service.getAgentTypes() };
  },

  async listNewsletters({ provider }, app: TokenRingApp) {
    return { newsletters: await app.requireService(NewsletterService).listNewsletters(provider) };
  },

  async listAudiences({ provider, newsletter }, app: TokenRingApp) {
    return { audiences: await app.requireService(NewsletterService).listAudiences(provider, newsletter) };
  },

  async listIssues({ provider, newsletter, ...options }, app: TokenRingApp) {
    return { issues: await app.requireService(NewsletterService).listIssues(provider, newsletter, options) };
  },

  async getIssue({ provider, id }, app: TokenRingApp) {
    return { issue: await app.requireService(NewsletterService).getIssue(provider, id) };
  },

  async createIssue({ provider, ...data }, app: TokenRingApp) {
    const issue = await app.requireService(NewsletterService).createDraft(provider, data);
    return { issue, message: `Draft created: ${issue.id}` };
  },

  async updateIssue({ provider, id, updatedData }, app: TokenRingApp) {
    const issue = await app.requireService(NewsletterService).updateDraft(provider, id, updatedData);
    return { issue, message: `Draft saved: ${issue.id}` };
  },

  async deleteIssue({ provider, id }, app: TokenRingApp) {
    const issue = await app.requireService(NewsletterService).deleteDraft(provider, id);
    return { message: `Draft "${issue.subject}" deleted` };
  },
});
