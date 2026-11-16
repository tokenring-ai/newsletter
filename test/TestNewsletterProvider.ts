import type {
  Audience,
  CreateIssueData,
  Issue,
  IssueFilterOptions,
  IssueListItem,
  Newsletter,
  NewsletterProvider,
  UpdateIssueData,
} from "../NewsletterProvider.ts";

/** An in-memory provider with real behaviour (statuses, refusing to edit sent issues), and a log of what it emailed. */
export default class TestNewsletterProvider implements NewsletterProvider {
  description = "Test newsletters";
  supportedStatuses: Issue["status"][] = ["draft", "scheduled", "sent"];
  newsletters: Newsletter[] = [{ id: "weekly", name: "The Weekly" }];
  audiences: Audience[] = [
    { id: "all", name: "Everyone subscribed", memberCount: 1204 },
    { id: "status:free", name: "Free members", memberCount: 1000 },
  ];
  /** When false, the provider cannot count people. */
  canCount = true;
  issues: Issue[] = [];
  /** Every send and schedule that reached the provider. */
  delivered: { kind: "send" | "schedule"; id: string; audience: string; at?: number }[] = [];
  private nextId = 1;

  constructor() {
    this.issues.push(this.make({ id: "draft-1", subject: "Hello subscribers", markdown: "Welcome to the first issue." }));
  }

  private make(partial: Partial<Issue> & Pick<Issue, "id" | "subject" | "markdown">): Issue {
    return { newsletter: "weekly", status: "draft", createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, ...partial };
  }

  async listNewsletters() {
    return this.newsletters;
  }

  async listAudiences(_newsletter: string) {
    return this.audiences.map(audience => (this.canCount ? audience : { id: audience.id, name: audience.name }));
  }

  async getAudienceSize(_newsletter: string, audience: string) {
    return this.canCount ? this.audiences.find(candidate => candidate.id === audience)?.memberCount : undefined;
  }

  async createIssue(data: CreateIssueData): Promise<Issue> {
    const issue = this.make({
      id: `issue-${this.nextId++}`,
      newsletter: data.newsletter,
      subject: data.subject,
      markdown: data.markdown,
      updatedAt: Date.now(),
      ...(data.preheader !== undefined && { preheader: data.preheader }),
      ...(data.audience !== undefined && { audience: data.audience }),
    });
    this.issues.push(issue);
    return issue;
  }

  private find(id: string): Issue {
    const issue = this.issues.find(candidate => candidate.id === id);
    if (!issue) throw new Error(`Issue ${id} not found`);
    return issue;
  }

  async getIssue(id: string) {
    return structuredClone(this.find(id));
  }

  async listIssues(newsletter: string, options: IssueFilterOptions = {}): Promise<IssueListItem[]> {
    return this.issues
      .filter(issue => issue.newsletter === newsletter && (!options.status || issue.status === options.status))
      .slice(0, options.limit ?? 25)
      .map(({ markdown: _markdown, html: _html, ...item }) => item);
  }

  async updateIssue(id: string, data: UpdateIssueData): Promise<Issue> {
    const issue = this.find(id);
    if (issue.status === "sent") throw new Error("sent issues cannot change");
    Object.assign(issue, data, { updatedAt: Math.max(Date.now(), issue.updatedAt + 1) });
    return structuredClone(issue);
  }

  async deleteIssue(id: string) {
    const issue = this.find(id);
    if (issue.status !== "draft") throw new Error("only drafts can be deleted");
    this.issues.splice(this.issues.indexOf(issue), 1);
  }

  async scheduleIssue(id: string, at: number, audience: string) {
    const issue = this.find(id);
    if (issue.status === "sent") throw new Error("already sent");
    this.delivered.push({ kind: "schedule", id, audience, at });
    Object.assign(issue, { status: "scheduled", scheduledAt: at, audience, updatedAt: Date.now() });
    return structuredClone(issue);
  }

  async sendIssue(id: string, audience: string) {
    const issue = this.find(id);
    if (issue.status === "sent") throw new Error("already sent");
    this.delivered.push({ kind: "send", id, audience });
    Object.assign(issue, { status: "sent", sentAt: Date.now(), audience, updatedAt: Date.now() });
    delete issue.scheduledAt;
    return structuredClone(issue);
  }
}
