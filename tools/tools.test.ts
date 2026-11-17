import { describe, expect, it } from "bun:test";
import { createHarness, PERMISSION_ID } from "../test/harness.ts";
import createIssue from "./createIssue.ts";
import deleteIssue from "./deleteIssue.ts";
import getIssue from "./getIssue.ts";
import listAudiences from "./listAudiences.ts";
import listIssues from "./listIssues.ts";
import selectNewsletter from "./selectNewsletter.ts";
import updateIssue from "./updateIssue.ts";

describe("newsletter drafting tools", () => {
  it("createIssue makes a draft without asking, dropping a leading heading from the body", async () => {
    const { agent, provider, questions } = createHarness();
    const result = await createIssue.execute({ subject: "Fresh", contentInMarkdown: "# Fresh\n\nBody text", preheader: "Preview" }, agent);
    expect(questions).toHaveLength(0);
    expect(result.result).toContain("Nothing has been emailed");
    const created = provider.issues.at(-1);
    expect(created).toMatchObject({ subject: "Fresh", preheader: "Preview", markdown: "Body text", status: "draft", newsletter: "weekly" });
    expect(provider.delivered).toHaveLength(0);
  });

  it("lists, reads and shows audiences", async () => {
    const { agent } = createHarness();
    expect((await listIssues.execute({ limit: 25 }, agent)).result).toContain("Hello subscribers");
    expect((await listIssues.execute({ status: "sent", limit: 25 }, agent)).result).toContain("no issues");
    expect((await getIssue.execute({ id: "draft-1" }, agent)).result).toContain("Welcome to the first issue.");
    const audiences = (await listAudiences.execute({}, agent)).result;
    expect(audiences).toContain("1204");
    expect(audiences).toContain("status:free");
  });

  it("updateIssue edits a draft without asking", async () => {
    const { agent, provider, questions } = createHarness();
    await updateIssue.execute({ id: "draft-1", subject: "Better subject" }, agent);
    expect(provider.issues[0]?.subject).toBe("Better subject");
    expect(questions).toHaveLength(0);
    await expect(updateIssue.execute({ id: "draft-1" }, agent)).rejects.toThrow(/Nothing to change/);
  });

  it("updateIssue refuses a sent issue", async () => {
    const { agent, provider } = createHarness();
    await provider.sendIssue("draft-1", "all");
    await expect(updateIssue.execute({ id: "draft-1", subject: "Nope" }, agent)).rejects.toThrow(/already been sent/);
    expect(provider.issues[0]?.subject).toBe("Hello subscribers");
  });

  it("updateIssue asks at level 8 with the send permission before changing a scheduled issue", async () => {
    const { agent, provider, questions, answerWith, permissions } = createHarness();
    await provider.scheduleIssue("draft-1", Date.now() + 3_600_000, "all");

    answerWith("Not approved");
    await expect(updateIssue.execute({ id: "draft-1", subject: "Changed" }, agent)).rejects.toThrow(/did not approve/);
    expect(provider.issues[0]?.subject).toBe("Hello subscribers");
    expect(questions[0]?.message).toContain("Hello subscribers");
    // It says what changes, who gets it, how many, and when.
    expect(questions[0]?.message).toContain("subject");
    expect(questions[0]?.message).toContain("Everyone subscribed");
    expect(questions[0]?.message).toContain("This will email about 1,204 people");
    expect(questions[0]?.message).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    expect(questions[0]?.message).toContain("New subject: Changed");
    expect(questions[0]?.message).toContain("ALSO be published on the website");

    await permissions.grant({ id: PERMISSION_ID });
    await updateIssue.execute({ id: "draft-1", subject: "Changed" }, agent);
    expect(provider.issues[0]?.subject).toBe("Changed");
  });

  it("the scheduled-edit prompt names the new audience and its count when the audience changes", async () => {
    const { agent, provider, questions, answerWith } = createHarness();
    await provider.scheduleIssue("draft-1", Date.now() + 3_600_000, "all");
    answerWith("Approved");
    await updateIssue.execute({ id: "draft-1", audience: "status:free", contentInMarkdown: "Brand new body text." }, agent);
    const prompt = questions[0]?.message ?? "";
    expect(prompt).toContain("body, audience");
    expect(prompt).toContain("Free members");
    expect(prompt).toContain("This will email about 1,000 people");
    expect(prompt).toContain("Body starts: Brand new body text.");
  });

  it("deleteIssue only deletes drafts, after asking", async () => {
    const { agent, provider, answerWith, questions } = createHarness();
    answerWith("Not approved");
    await expect(deleteIssue.execute({ id: "draft-1" }, agent)).rejects.toThrow(/did not approve/);
    expect(provider.issues).toHaveLength(1);
    answerWith("Approved");
    await deleteIssue.execute({ id: "draft-1" }, agent);
    expect(provider.issues).toHaveLength(0);
    expect(questions).toHaveLength(2);

    const sent = await provider.createIssue({ newsletter: "weekly", subject: "Gone out", markdown: "x" });
    await provider.sendIssue(sent.id, "all");
    await expect(deleteIssue.execute({ id: sent.id }, agent)).rejects.toThrow(/Only drafts/);
  });

  it("selectNewsletter picks by id or name and refuses unknown ones", async () => {
    const { agent, service, provider } = createHarness();
    provider.newsletters.push({ id: "daily", name: "The Daily" });
    await selectNewsletter.execute({ newsletter: "The Daily" }, agent);
    expect((await service.requireActiveNewsletter(agent)).newsletter.id).toBe("daily");
    await expect(selectNewsletter.execute({ newsletter: "nope" }, agent)).rejects.toThrow(/no newsletter/);
  });
});
