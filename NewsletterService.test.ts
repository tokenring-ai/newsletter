import { describe, expect, it } from "bun:test";
import { NewsletterState } from "./state/NewsletterState.ts";
import { createHarness } from "./test/harness.ts";

describe("NewsletterService", () => {
  it("registers and unregisters providers", () => {
    const { service, provider } = createHarness();
    expect(service.getAvailableNewsletters()).toEqual(["My Site.com"]);
    expect(service.requireNewsletterProvider("My Site.com")).toBe(provider);
    service.unregisterNewsletter("My Site.com");
    expect(service.getAvailableNewsletters()).toEqual([]);
    expect(() => service.requireNewsletterProvider("My Site.com")).toThrow();
  });

  it("describes providers with their supported statuses", () => {
    const { service, provider } = createHarness();
    provider.supportedStatuses = ["draft", "sent"];
    expect(service.describeProviders()).toEqual([{ name: "My Site.com", description: "Test newsletters", supportedStatuses: ["draft", "sent"] }]);
  });

  it("starts from the configured agent defaults and records the selection per agent", () => {
    const { service, agent } = createHarness();
    service.reconfigure({ agentDefaults: { provider: "My Site.com", newsletter: "weekly" }, agentTypes: ["newsletter"] });
    expect(service.getAgentTypes()).toEqual(["newsletter"]);
    expect(agent.getState(NewsletterState).activeNewsletter).toBe("weekly");
    service.setActiveNewsletter("My Site.com", undefined, agent);
    expect(agent.getState(NewsletterState).activeNewsletter).toBeUndefined();
  });

  it("uses the only provider and the only newsletter without a selection, and asks for one when it is ambiguous", async () => {
    const { service, agent, provider } = createHarness();
    service.setActiveNewsletter("My Site.com", undefined, agent);
    expect((await service.requireActiveNewsletter(agent)).newsletter.id).toBe("weekly");

    provider.newsletters.push({ id: "daily", name: "The Daily" });
    await expect(service.requireActiveNewsletter(agent)).rejects.toThrow(/several newsletters/);

    service.setActiveNewsletter("My Site.com", "nope", agent);
    await expect(service.requireActiveNewsletter(agent)).rejects.toThrow(/no newsletter "nope"/);
  });

  it("only edits and deletes drafts", async () => {
    const { service, provider } = createHarness();
    const updated = await service.updateDraft("My Site.com", "draft-1", { subject: "New subject" });
    expect(updated.subject).toBe("New subject");

    await provider.sendIssue("draft-1", "all");
    await expect(service.updateDraft("My Site.com", "draft-1", { subject: "Too late" })).rejects.toThrow(/sent/);
    await expect(service.deleteDraft("My Site.com", "draft-1")).rejects.toThrow(/only drafts/);

    const draft = await service.createDraft("My Site.com", { newsletter: "weekly", subject: "Temp", markdown: "x" });
    expect(draft.status).toBe("draft");
    await service.deleteDraft("My Site.com", draft.id);
    expect(provider.issues.some(issue => issue.id === draft.id)).toBe(false);
  });
});
