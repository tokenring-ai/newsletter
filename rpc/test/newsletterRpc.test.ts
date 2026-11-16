import { describe, expect, it } from "bun:test";
import { createHarness } from "../../test/harness.ts";
import newsletterRPC from "../newsletter.ts";

const methods = newsletterRPC.methods;

describe("Newsletter RPC", () => {
  it("reports providers, newsletters, audiences and issues", async () => {
    const { app } = createHarness();
    const configuration = await methods.getNewsletterConfiguration.execute({}, app);
    expect(configuration.providers).toEqual([{ name: "My Site.com", description: "Test newsletters", supportedStatuses: ["draft", "scheduled", "sent"] }]);
    expect(configuration.agentTypes).toContain("newsletter");

    expect((await methods.listNewsletters.execute({ provider: "My Site.com" }, app)).newsletters).toEqual([{ id: "weekly", name: "The Weekly" }]);
    expect((await methods.listAudiences.execute({ provider: "My Site.com", newsletter: "weekly" }, app)).audiences.map(a => a.id)).toEqual([
      "all",
      "status:free",
    ]);
    const { issues } = await methods.listIssues.execute({ provider: "My Site.com", newsletter: "weekly" }, app);
    expect(issues.map(issue => issue.subject)).toEqual(["Hello subscribers"]);
    expect(issues[0]).not.toHaveProperty("markdown");
    expect((await methods.getIssue.execute({ provider: "My Site.com", id: "draft-1" }, app)).issue.markdown).toBe("Welcome to the first issue.");
  });

  it("creates, edits and deletes drafts", async () => {
    const { app, provider } = createHarness();
    const { issue } = await methods.createIssue.execute({ provider: "My Site.com", newsletter: "weekly", subject: "New", markdown: "Body" }, app);
    expect(issue.status).toBe("draft");
    const updated = await methods.updateIssue.execute({ provider: "My Site.com", id: issue.id, updatedData: { subject: "Renamed" } }, app);
    expect(updated.issue.subject).toBe("Renamed");
    await methods.deleteIssue.execute({ provider: "My Site.com", id: issue.id }, app);
    expect(provider.issues.some(candidate => candidate.id === issue.id)).toBe(false);
  });

  it("will not edit or delete a scheduled or sent issue, and has no way to send", async () => {
    const { app, provider } = createHarness();
    await provider.scheduleIssue("draft-1", Date.now() + 3_600_000, "all");
    await expect(methods.updateIssue.execute({ provider: "My Site.com", id: "draft-1", updatedData: { subject: "x" } }, app)).rejects.toThrow(/scheduled/);
    await expect(methods.deleteIssue.execute({ provider: "My Site.com", id: "draft-1" }, app)).rejects.toThrow(/only drafts/);
    await provider.sendIssue("draft-1", "all");
    await expect(methods.updateIssue.execute({ provider: "My Site.com", id: "draft-1", updatedData: { subject: "x" } }, app)).rejects.toThrow(/sent/);

    expect(Object.keys(methods).filter(name => /send|schedule/i.test(name))).toEqual([]);
  });
});
