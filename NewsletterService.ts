import type Agent from "@tokenring-ai/agent/Agent";
import type { AgentCreationContext } from "@tokenring-ai/agent/types";
import type { TokenRingService } from "@tokenring-ai/app/types";
import { ConfigurationError } from "@tokenring-ai/app/types";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import type {
  Audience,
  CreateIssueData,
  Issue,
  IssueFilterOptions,
  IssueListItem,
  IssueStatus,
  Newsletter,
  NewsletterProvider,
  UpdateIssueData,
} from "./NewsletterProvider.ts";
import { NewsletterAgentConfigSchema, NewsletterConfigSchema, type ParsedNewsletterConfig } from "./schema.ts";
import { NewsletterState } from "./state/NewsletterState.ts";

/** The newsletter an agent is working with: which provider, and which of its newsletters. */
export type ActiveNewsletter = {
  providerName: string;
  provider: NewsletterProvider;
  newsletter: Newsletter;
};

export default class NewsletterService implements TokenRingService {
  readonly name = "NewsletterService";
  description = "Abstract interface for newsletters: drafting, scheduling and sending issues";

  private providers = new KeyedRegistry<NewsletterProvider>();

  registerNewsletter = this.providers.set;
  unregisterNewsletter = this.providers.unregister;
  getAvailableNewsletters = this.providers.keysArray;
  getNewsletterProvider = this.providers.get;
  requireNewsletterProvider = this.providers.require;

  private options: ParsedNewsletterConfig = NewsletterConfigSchema.parse({});

  constructor(options?: ParsedNewsletterConfig) {
    if (options) this.options = options;
  }

  reconfigure(options: ParsedNewsletterConfig): void {
    this.options = options;
  }

  /** Agent types configured for drafting newsletter issues. */
  getAgentTypes(): string[] {
    return [...this.options.agentTypes];
  }

  /** What each registered provider can hold and says about itself. */
  describeProviders(): { name: string; description: string; supportedStatuses: IssueStatus[] }[] {
    return this.providers.entriesArray().map(([name, provider]) => ({
      name,
      description: provider.description,
      supportedStatuses: [...provider.supportedStatuses],
    }));
  }

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    const agentConfig = deepClone(this.options.agentDefaults, agent.getAgentConfigSlice("newsletter", NewsletterAgentConfigSchema));
    const state = agent.initializeState(NewsletterState, agentConfig);
    creationContext.items.push(`Selected newsletter: ${state.activeProvider ?? "(none)"}${state.activeNewsletter ? ` / ${state.activeNewsletter}` : ""}`);
  }

  setActiveNewsletter(providerName: string, newsletterId: string | undefined, agent: Agent): void {
    this.providers.require(providerName);
    agent.mutateState(NewsletterState, state => {
      state.activeProvider = providerName;
      state.activeNewsletter = newsletterId;
    });
  }

  /**
   * The newsletter the agent works with. An unambiguous setup needs no selection: the only registered provider,
   * and the only newsletter it has, are used. Anything else must have been selected.
   */
  async requireActiveNewsletter(agent: Agent): Promise<ActiveNewsletter> {
    const state = agent.getState(NewsletterState);
    let providerName = state.activeProvider;
    if (!providerName) {
      const available = this.providers.keysArray();
      if (available.length === 1) providerName = available[0];
    }
    if (!providerName) throw new ConfigurationError(this.name, "No newsletter provider is selected. Use /newsletter select.");
    const provider = this.providers.require(providerName);

    const newsletters = await provider.listNewsletters();
    if (newsletters.length === 0) throw new ConfigurationError(this.name, `${providerName} has no newsletters.`);
    const wanted = state.activeNewsletter;
    const newsletter = wanted ? newsletters.find(candidate => candidate.id === wanted) : newsletters.length === 1 ? newsletters[0] : undefined;
    if (!newsletter) {
      const names = newsletters.map(candidate => `${candidate.name} (${candidate.id})`).join(", ");
      throw new ConfigurationError(
        this.name,
        wanted
          ? `${providerName} has no newsletter "${wanted}". Available: ${names}`
          : `${providerName} has several newsletters; select one with /newsletter select. Available: ${names}`,
      );
    }
    return { providerName, provider, newsletter };
  }

  listNewsletters(providerName: string): Promise<Newsletter[]> {
    return this.providers.require(providerName).listNewsletters();
  }

  listAudiences(providerName: string, newsletter: string): Promise<Audience[]> {
    return this.providers.require(providerName).listAudiences(newsletter);
  }

  listIssues(providerName: string, newsletter: string, options?: IssueFilterOptions): Promise<IssueListItem[]> {
    return this.providers.require(providerName).listIssues(newsletter, options);
  }

  getIssue(providerName: string, id: string): Promise<Issue> {
    return this.providers.require(providerName).getIssue(id);
  }

  /** Always a draft: nothing is emailed. */
  createDraft(providerName: string, data: CreateIssueData): Promise<Issue> {
    return this.providers.require(providerName).createIssue(data);
  }

  /** Edits a draft. A scheduled or sent issue is refused: only the approved send path may touch those. */
  async updateDraft(providerName: string, id: string, data: UpdateIssueData): Promise<Issue> {
    const provider = this.providers.require(providerName);
    const current = await provider.getIssue(id);
    if (current.status !== "draft") throw new Error(`"${current.subject}" is ${current.status}, so it can no longer be edited here. Only drafts can be.`);
    return provider.updateIssue(id, data);
  }

  async deleteDraft(providerName: string, id: string): Promise<Issue> {
    const provider = this.providers.require(providerName);
    const current = await provider.getIssue(id);
    if (current.status !== "draft") throw new Error(`"${current.subject}" is ${current.status}; only drafts can be deleted.`);
    await provider.deleteIssue(id);
    return current;
  }
}
