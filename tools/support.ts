import type Agent from "@tokenring-ai/agent/Agent";
import { permissionSlug } from "@tokenring-ai/chat";
import { ApprovalLevel } from "@tokenring-ai/chat/schema";
import { requireToolApproval } from "@tokenring-ai/chat/util/requireToolApproval";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import type { Audience, Issue, UpdateIssueData } from "../NewsletterProvider.ts";
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

const EXCERPT_LENGTH = 300;

/** The body as plain text for an approval prompt: Markdown and HTML marks removed, whitespace collapsed, cut with "…". */
export function plainExcerpt(markdown: string, max = EXCERPT_LENGTH): string {
  const text = markdown
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/(\*\*|__|\*|_|`+|~~)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max).join("").trimEnd()}…` : text;
}

/** What the person is approving to be emailed: the preheader and the start of the body. */
function describeContent(issue: { preheader?: string | undefined; markdown: string }): string {
  const body = plainExcerpt(issue.markdown);
  return `Preheader: ${issue.preheader?.trim() || "(none)"}\nBody starts: ${body || "(empty)"}`;
}

/** Whether delivering also puts the issue on a public website, in words. */
export function describeWebsite(active: ActiveNewsletter): string {
  const publishes = active.provider.publishesOnWebsite;
  if (publishes === true) return "It will ALSO be published on the website, where anyone can read it (not only emailed)";
  if (publishes === false) return "It will be emailed only; it will NOT be published on the website";
  return `Whether ${active.providerName} also publishes it on a website is not known, so check before approving`;
}

async function audienceCount(active: ActiveNewsletter, audience: Audience): Promise<number | undefined> {
  try {
    return (await active.provider.getAudienceSize(active.newsletter.id, audience.id)) ?? audience.memberCount;
  } catch {
    return audience.memberCount;
  }
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
  const count = await audienceCount(active, audience);
  const where = `${active.newsletter.name}, to ${audience.name}`;
  const when = at === undefined ? "now" : `at ${new Date(at).toISOString()}`;
  await requireToolApproval(agent, {
    toolName,
    message: `${at === undefined ? "Send" : "Schedule"} "${issue.subject}" from ${where}${at === undefined ? "" : ` for ${when}`}? ${describeRecipients(count)}. ${describeWebsite(active)}.`,
    detailedDescription:
      `Emails the issue "${issue.subject}" of ${active.newsletter.name} (${active.providerName}) to ${audience.name} ${when}. ${describeRecipients(count)}. ` +
      `${describeWebsite(active)}. A sent email cannot be recalled or edited.\n${describeContent(issue)}`,
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

/** The names of the fields an update changes, as people read them. */
function changedFields(update: UpdateIssueData): string[] {
  const names: [keyof UpdateIssueData, string][] = [
    ["subject", "subject"],
    ["preheader", "preheader"],
    ["markdown", "body"],
    ["audience", "audience"],
  ];
  return names.filter(([key]) => update[key] !== undefined).map(([, label]) => label);
}

/**
 * Editing a scheduled issue changes what will be emailed later. Same level and permission as scheduling it. The prompt
 * names what changes, who will get it (the audience it is scheduled for, or the new one) and when it goes out.
 */
export async function requireScheduledEditApproval(
  agent: Agent,
  options: { toolName: string; active: ActiveNewsletter; issue: Issue; update: UpdateIssueData },
): Promise<void> {
  const { toolName, active, issue, update } = options;
  const audienceId = update.audience ?? issue.audience;
  const audiences = audienceId ? await active.provider.listAudiences(active.newsletter.id).catch(() => []) : [];
  const audience = audienceId ? (audiences.find(candidate => candidate.id === audienceId) ?? { id: audienceId, name: audienceId }) : undefined;
  const count = audience ? await audienceCount(active, audience) : undefined;
  const when = issue.scheduledAt ? `at ${new Date(issue.scheduledAt).toISOString()}` : "later";
  const changes = changedFields(update).join(", ");
  const whoLine = audience ? `Audience: ${audience.name}. ${describeRecipients(count)}.` : "The audience is not recorded, so I cannot say who will receive it.";
  const after = { preheader: update.preheader ?? issue.preheader, markdown: update.markdown ?? issue.markdown };
  await requireToolApproval(agent, {
    toolName,
    message: `Change the ${changes} of the scheduled issue "${issue.subject}" of ${active.newsletter.name}? It is due to be emailed ${when}. ${whoLine} ${describeWebsite(active)}.`,
    detailedDescription:
      `The change (${changes}) goes out in the email at the scheduled time (${when}), without anyone being asked again. ${whoLine}\n` +
      `${update.subject !== undefined ? `New subject: ${update.subject}\n` : ""}${describeContent(after)}`,
    safetyLevel: ApprovalLevel.ReachesPeople,
    default: false,
    permission: {
      id: sendPermissionId(active.providerName, active.newsletter.id),
      summary: `Send or schedule issues of ${active.newsletter.name} (${active.providerName}) to any audience`,
    },
  });
}
