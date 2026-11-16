import { z } from "zod";

/**
 * What a newsletter provider (Ghost today; Gmail, Mailchimp and others later) must offer.
 *
 * Vocabulary:
 * - a provider exposes one or more **newsletters** (a list people subscribe to);
 * - each newsletter has **audiences** (who an issue is emailed to: everyone, free members, ...);
 * - an **issue** is one email: a subject, a Markdown body, and a status.
 *
 * Nothing here is Ghost-shaped: ids are opaque strings the provider chooses, and bodies are Markdown
 * (each provider converts to whatever its service accepts).
 */

export const IssueStatusSchema = z.enum(["draft", "scheduled", "sent"]);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;
export const ALL_ISSUE_STATUSES: readonly IssueStatus[] = IssueStatusSchema.options;

export const NewsletterSchema = z.object({
  /** Provider-chosen id, unique within the provider (Ghost: the newsletter slug). */
  id: z.string(),
  name: z.string(),
  description: z.string().exactOptional(),
});
export type Newsletter = z.infer<typeof NewsletterSchema>;

export const AudienceSchema = z.object({
  /** Provider-chosen id, unique within the newsletter. Opaque to callers. */
  id: z.string(),
  name: z.string(),
  /** How many people receive an issue sent to this audience, when the provider can tell cheaply. */
  memberCount: z.number().int().min(0).exactOptional(),
});
export type Audience = z.infer<typeof AudienceSchema>;

export const IssueStatsSchema = z.object({
  recipients: z.number().int().min(0).exactOptional(),
  delivered: z.number().int().min(0).exactOptional(),
  opened: z.number().int().min(0).exactOptional(),
  failed: z.number().int().min(0).exactOptional(),
});
export type IssueStats = z.infer<typeof IssueStatsSchema>;

export const IssueListItemSchema = z.object({
  id: z.string(),
  /** The newsletter this issue belongs to ({@link Newsletter.id}). */
  newsletter: z.string(),
  subject: z.string(),
  preheader: z.string().exactOptional(),
  status: IssueStatusSchema,
  /** The audience chosen for the issue ({@link Audience.id}), when one is saved with it. */
  audience: z.string().exactOptional(),
  /** Unix ms. */
  createdAt: z.number(),
  updatedAt: z.number(),
  /** Unix ms; set while the issue is `scheduled`. */
  scheduledAt: z.number().exactOptional(),
  /** Unix ms; set once the issue is `sent`. */
  sentAt: z.number().exactOptional(),
  /** Where the issue can be read on the web, when the provider publishes it there. */
  url: z.string().exactOptional(),
  stats: IssueStatsSchema.exactOptional(),
});
export type IssueListItem = z.infer<typeof IssueListItemSchema>;

export const IssueSchema = IssueListItemSchema.extend({
  /** The body, as Markdown. Providers that store something else convert, and may not round-trip exactly. */
  markdown: z.string(),
  /** The body as the provider renders it, when it has HTML. */
  html: z.string().exactOptional(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const CreateIssueDataSchema = z.object({
  newsletter: z.string(),
  subject: z.string(),
  preheader: z.string().exactOptional(),
  markdown: z.string(),
  audience: z.string().exactOptional(),
});
export type CreateIssueData = z.infer<typeof CreateIssueDataSchema>;

/** The editable fields of an issue that is not sent yet. */
export const UpdateIssueDataSchema = z.object({
  subject: z.string().exactOptional(),
  preheader: z.string().exactOptional(),
  markdown: z.string().exactOptional(),
  audience: z.string().exactOptional(),
});
export type UpdateIssueData = z.infer<typeof UpdateIssueDataSchema>;

export const IssueFilterOptionsSchema = z.object({
  status: IssueStatusSchema.exactOptional(),
  limit: z.number().int().min(1).max(100).exactOptional(),
});
export type IssueFilterOptions = z.infer<typeof IssueFilterOptionsSchema>;

export interface NewsletterProvider {
  description: string;

  /** Statuses the provider can hold. A provider that cannot schedule leaves `scheduled` out. */
  supportedStatuses: readonly IssueStatus[];

  listNewsletters(): Promise<Newsletter[]>;

  listAudiences(newsletter: string): Promise<Audience[]>;

  /**
   * How many people an issue sent to this audience would reach, or undefined when the provider cannot tell.
   * Used in approval prompts, so it must be as fresh as the provider can make it.
   */
  getAudienceSize(newsletter: string, audience: string): Promise<number | undefined>;

  /** Always creates a draft. Nothing is sent. */
  createIssue(data: CreateIssueData): Promise<Issue>;

  getIssue(id: string): Promise<Issue>;

  /** Most recently updated first. Without a body. */
  listIssues(newsletter: string, options?: IssueFilterOptions): Promise<IssueListItem[]>;

  /** Changes a draft or scheduled issue. Must throw for a sent issue: a sent issue never changes. */
  updateIssue(id: string, data: UpdateIssueData): Promise<Issue>;

  /** Deletes a draft. Must throw for any other status. */
  deleteIssue(id: string): Promise<void>;

  /** Emails the issue at `at` (unix ms, in the future) to the audience. */
  scheduleIssue(id: string, at: number, audience: string): Promise<Issue>;

  /** Emails the issue now, to the audience. Irreversible. */
  sendIssue(id: string, audience: string): Promise<Issue>;
}
