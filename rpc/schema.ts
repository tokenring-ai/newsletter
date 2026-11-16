import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";
import {
  AudienceSchema,
  CreateIssueDataSchema,
  IssueFilterOptionsSchema,
  IssueListItemSchema,
  IssueSchema,
  IssueStatusSchema,
  NewsletterSchema,
  UpdateIssueDataSchema,
} from "../NewsletterProvider.ts";

/**
 * Reading and editing drafts. Scheduling and sending are deliberately not here: emailing people goes through the
 * newsletter_scheduleIssue and newsletter_sendIssue tools, which show the approval with the recipient count.
 */
export default {
  name: "Newsletter RPC",
  path: "/rpc/newsletter",
  methods: {
    getNewsletterConfiguration: {
      type: "query",
      input: z.object({}),
      result: z.object({
        providers: z.array(z.object({ name: z.string(), description: z.string(), supportedStatuses: z.array(IssueStatusSchema) })),
        agentTypes: z.array(z.string()),
      }),
    },
    listNewsletters: {
      type: "query",
      input: z.object({ provider: z.string() }),
      result: z.object({ newsletters: z.array(NewsletterSchema) }),
    },
    listAudiences: {
      type: "query",
      input: z.object({ provider: z.string(), newsletter: z.string() }),
      result: z.object({ audiences: z.array(AudienceSchema) }),
    },
    listIssues: {
      type: "query",
      input: IssueFilterOptionsSchema.extend({ provider: z.string(), newsletter: z.string() }),
      result: z.object({ issues: z.array(IssueListItemSchema) }),
    },
    getIssue: {
      type: "query",
      input: z.object({ provider: z.string(), id: z.string() }),
      result: z.object({ issue: IssueSchema }),
    },
    /** Always a draft. */
    createIssue: {
      type: "mutation",
      input: CreateIssueDataSchema.extend({ provider: z.string() }),
      result: z.object({ issue: IssueSchema, message: z.string() }),
    },
    /** Drafts only: a scheduled or sent issue is refused. */
    updateIssue: {
      type: "mutation",
      input: z.object({ provider: z.string(), id: z.string(), updatedData: UpdateIssueDataSchema }),
      result: z.object({ issue: IssueSchema, message: z.string() }),
    },
    /** Drafts only. */
    deleteIssue: {
      type: "mutation",
      input: z.object({ provider: z.string(), id: z.string() }),
      result: z.object({ message: z.string() }),
    },
  },
} satisfies RPCSchema;
