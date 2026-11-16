import type Agent from "@tokenring-ai/agent/Agent";
import { permissionSlug } from "@tokenring-ai/chat";
import { ApprovalLevel } from "@tokenring-ai/chat/schema";
import { requireToolApproval } from "@tokenring-ai/chat/util/requireToolApproval";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import type { Audience, Issue } from "../NewsletterProvider.ts";
import NewsletterService, { type ActiveNewsletter } from "../NewsletterService.ts";

/** Strips the leading heading from a Markdown body: the subject is its own field. */
export function stripLeadingHeading(markdown: string): string {
  return markdown.replace(/^\s*#[^\n]*/, "").trim();
}

/**
 * The permission id for sending and scheduling issues of one newsletter. It names the provider as well as the
 * newsletter, because two sites can both have a newsletter called "default-newsletter" and a standing "yes" for one
 * must not cover the other. Scheduling, sending and editing a scheduled issue share it: all of them email people.
 */
export function sendPermissionId(providerName: string, newsletterId: string): string {
  return `newsletter.${permissionSlug(providerName)}.${permissionSlug(newsletterId)}.send`;
}

export async function requireActive(agent: Agent): Promise<ActiveNewsletter> {
  return agent.requireService(NewsletterService).requireActiveNewsletter(agent);
}

/** Reads an issue of the active newsletter. An id from another newsletter is refused. */
export async function requireIssue(toolName: string, active: ActiveNewsletter, id: string): Promise<Issue> {
  const issue = await active.provider.getIssue(id).catch((error: unknown) => {
    throw new ToolCallError(toolName, `Could not read issue ${id}: ${Error.isError(error) ? error.message : String(error)}`);
  });
  if (issue.newsletter !== active.newsletter.id) {
    throw new ToolCallError(toolName, `Issue ${id} belongs to the newsletter "${issue.newsletter}", not the selected "${active.newsletter.id}".`);
  }
  return issue;
}

export function requireContent(toolName: string, issue: Pick<Issue, "subject" | "markdown">): void {
  if (issue.subject.trim() === "") throw new ToolCallError(toolName, "The issue has no subject, so it cannot be sent. Add a subject first.");
  if (issue.markdown.trim() === "") throw new ToolCallError(toolName, "The issue has no body, so it cannot be sent. Write the content first.");
}

/** The audience to email: the one asked for, else the one saved with the issue. It must be one the newsletter offers. */
export async function resolveAudience(toolName: string, active: ActiveNewsletter, issue: Issue, requested: string | undefined): Promise<Audience> {
  const wanted = requested ?? issue.audience;
  const audiences = await active.provider.listAudiences(active.newsletter.id);
  const list = audiences.map(audience => `${audience.id} (${audience.name})`).join(", ");
  if (!wanted) throw new ToolCallError(toolName, `Say who should receive it: pass an audience. Available: ${list}`);
  const audience = audiences.find(candidate => candidate.id === wanted);
  if (!audience) throw new ToolCallError(toolName, `"${wanted}" is not an audience of ${active.newsletter.name}. Available: ${list}`);
  return audience;
}

/** "about 1,204 people", or an honest "unknown" when the provider cannot count. */
export function describeRecipients(count: number | undefined): string {
  return count === undefined
    ? "I could not find out how many people this will email, so check the audience before approving"
    : `This will email about ${count.toLocaleString("en-US")} ${count === 1 ? "person" : "people"}`;
}

/**
 * Asks for approval to email an issue. Level 8, so it always asks unless a standing permission matches.
 * The prompt names the subject, the audience and how many people will get it.
 */
export async function requireDeliveryApproval(
  agent: Agent,
  options: { toolName: string; active: ActiveNewsletter; issue: Issue; audience: Audience; at?: number },
): Promise<void> {
  const { toolName, active, issue, audience, at } = options;
  let count: number | undefined;
  try {
    count = (await active.provider.getAudienceSize(active.newsletter.id, audience.id)) ?? audience.memberCount;
  } catch {
    count = audience.memberCount;
  }
  const where = `${active.newsletter.name}, to ${audience.name}`;
  const when = at === undefined ? "now" : `at ${new Date(at).toISOString()}`;
  await requireToolApproval(agent, {
    toolName,
    message: `${at === undefined ? "Send" : "Schedule"} "${issue.subject}" from ${where}${at === undefined ? "" : ` for ${when}`}? ${describeRecipients(count)}.`,
    detailedDescription:
      `Emails the issue "${issue.subject}" of ${active.newsletter.name} (${active.providerName}) to ${audience.name} ${when}. ${describeRecipients(count)}. ` +
      "A sent email cannot be recalled or edited.",
    // Email reaches people and cannot be taken back.
    safetyLevel: ApprovalLevel.ReachesPeople,
    default: false,
    permission: {
      id: sendPermissionId(active.providerName, active.newsletter.id),
      summary: `Send or schedule issues of ${active.newsletter.name} (${active.providerName}) to any audience`,
    },
  });
}

/** The person approved the issue as it was; refuse if it changed while the prompt was open. */
export async function requireUnchangedSince(toolName: string, active: ActiveNewsletter, issue: Issue): Promise<void> {
  const fresh = await active.provider.getIssue(issue.id);
  if (fresh.updatedAt !== issue.updatedAt || fresh.subject !== issue.subject || fresh.markdown !== issue.markdown || fresh.status !== issue.status) {
    throw new ToolCallError(toolName, `"${issue.subject}" changed while waiting for approval, so nothing was sent. Review it and ask again.`);
  }
}

/** Editing a scheduled issue changes what will be emailed later. Same level and permission as scheduling it. */
export async function requireScheduledEditApproval(agent: Agent, options: { toolName: string; active: ActiveNewsletter; issue: Issue }): Promise<void> {
  const { toolName, active, issue } = options;
  await requireToolApproval(agent, {
    toolName,
    message: `Change the scheduled issue "${issue.subject}" of ${active.newsletter.name}? It is due to be emailed ${issue.scheduledAt ? `at ${new Date(issue.scheduledAt).toISOString()}` : "later"}.`,
    detailedDescription: "The change goes out in the email at the scheduled time, to whoever the issue is scheduled for, without anyone being asked again.",
    safetyLevel: ApprovalLevel.ReachesPeople,
    default: false,
    permission: {
      id: sendPermissionId(active.providerName, active.newsletter.id),
      summary: `Send or schedule issues of ${active.newsletter.name} (${active.providerName}) to any audience`,
    },
  });
}
