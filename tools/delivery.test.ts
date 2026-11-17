import { describe, expect, it } from "bun:test";
import { ALWAYS_ALLOW_VALUE } from "@tokenring-ai/agent/question";
import { createHarness, PERMISSION_ID } from "../test/harness.ts";
import scheduleIssue from "./scheduleIssue.ts";
import sendIssue from "./sendIssue.ts";
import { sendPermissionId } from "./support.ts";

const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString();

describe("newsletter_sendIssue", () => {
  it("asks first, naming the subject, the audience and how many people, then sends", async () => {
    const { agent, provider, questions, answerWith } = createHarness();
    answerWith("Approved");

    const result = await sendIssue.execute({ id: "draft-1", audience: "all" }, agent);

    expect(questions).toHaveLength(1);
    const prompt = questions[0]?.message ?? "";
    expect(prompt).toContain("Hello subscribers");
    expect(prompt).toContain("Everyone subscribed");
    expect(prompt).toContain("This will email about 1,204 people");
    expect(prompt).toContain("ALSO be published on the website");
    expect(prompt).toContain("Preheader:");
    expect(prompt).toContain("Body starts: Welcome to the first issue.");
    expect(provider.delivered).toEqual([{ kind: "send", id: "draft-1", audience: "all" }]);
    expect(result.result).toContain("cannot be recalled");
  });

  it("says plainly when it is emailed only, and when the provider cannot say", async () => {
    const { agent, provider, questions, answerWith } = createHarness();
    answerWith("Approved");
    provider.publishesOnWebsite = false;
    await sendIssue.execute({ id: "draft-1", audience: "all" }, agent);
    expect(questions[0]?.message).toContain("emailed only; it will NOT be published on the website");
    const second = await provider.createIssue({ newsletter: "weekly", subject: "Two", markdown: "x" });
    provider.publishesOnWebsite = undefined;
    await sendIssue.execute({ id: second.id, audience: "all" }, agent);
    expect(questions[1]?.message).toContain("not known, so check before approving");
  });

  it("shows the preheader and a plain-text excerpt of the body, cut at about 300 characters with an ellipsis", async () => {
    const { agent, provider, questions, answerWith } = createHarness();
    answerWith("Approved");
    const long = await provider.createIssue({
      newsletter: "weekly",
      subject: "Long one",
      preheader: "A short teaser",
      markdown: `## Heading\n\nSome **bold** text with a [link](https://example.com/secret-path) and more. ${"word ".repeat(100)}`,
    });
    await sendIssue.execute({ id: long.id, audience: "all" }, agent);
    const prompt = questions[0]?.message ?? "";
    expect(prompt).toContain("Preheader: A short teaser");
    expect(prompt).toContain("Body starts: Heading Some bold text with a link and more. word word");
    expect(prompt).not.toContain("secret-path");
    expect(prompt).not.toContain("**bold**");
    const excerpt = prompt.split("Body starts: ")[1]!.split("\n")[0]!;
    expect(excerpt.length).toBeLessThanOrEqual(301);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("offers Always allow for this newsletter, and a recorded grant sends without asking next time", async () => {
    const { agent, provider, questions, answerWith, permissions } = createHarness();
    answerWith(ALWAYS_ALLOW_VALUE);
    await sendIssue.execute({ id: "draft-1", audience: "all" }, agent);
    expect(questions[0]?.options).toContain(ALWAYS_ALLOW_VALUE);
    expect(permissions.list().map(grant => grant.id)).toEqual([PERMISSION_ID]);

    const second = await provider.createIssue({ newsletter: "weekly", subject: "Issue two", markdown: "More news." });
    await sendIssue.execute({ id: second.id, audience: "status:free" }, agent);
    expect(questions).toHaveLength(1); // not asked again
    expect(provider.delivered.map(entry => entry.id)).toEqual(["draft-1", second.id]);
  });

  it("a grant for another newsletter or site does not cover this one", async () => {
    const { agent, provider, permissions, questions, answerWith } = createHarness();
    await permissions.grant({ id: "newsletter.other-site.weekly.send" });
    await permissions.grant({ id: sendPermissionId("My Site.com", "daily") });
    answerWith("Not approved");
    await expect(sendIssue.execute({ id: "draft-1", audience: "all" }, agent)).rejects.toThrow(/did not approve/);
    expect(questions).toHaveLength(1);
    expect(provider.delivered).toHaveLength(0);
  });

  it("sends nothing when declined, and nothing when nobody answers (an unattended run with no grant)", async () => {
    const { agent, provider, answerWith } = createHarness();
    answerWith("Not approved");
    await expect(sendIssue.execute({ id: "draft-1", audience: "all" }, agent)).rejects.toThrow(/did not approve/);
    answerWith(null);
    await expect(sendIssue.execute({ id: "draft-1", audience: "all" }, agent)).rejects.toThrow(/did not approve/);
    expect(provider.delivered).toHaveLength(0);
    expect(provider.issues.find(issue => issue.id === "draft-1")?.status).toBe("draft");
  });

  it("is refused in reject mode without asking anyone, but a grant still sends", async () => {
    const { agent, provider, questions, permissions } = createHarness({ autoToolApprovalLevel: 2, toolApprovalMode: "reject" });
    await expect(sendIssue.execute({ id: "draft-1", audience: "all" }, agent)).rejects.toThrow(/did not approve/);
    expect(questions).toHaveLength(0);
    await permissions.grant({ id: PERMISSION_ID });
    await sendIssue.execute({ id: "draft-1", audience: "all" }, agent);
    expect(provider.delivered).toHaveLength(1);
  });

  it("says so when the recipient count is unavailable", async () => {
    const { agent, provider, questions, answerWith } = createHarness();
    provider.canCount = false;
    answerWith("Approved");
    await sendIssue.execute({ id: "draft-1", audience: "all" }, agent);
    expect(questions[0]?.message).toContain("could not find out how many people");
    expect(questions[0]?.message).not.toContain("about");
  });

  it("refuses an issue that was already sent, before asking", async () => {
    const { agent, provider, questions, answerWith } = createHarness();
    answerWith("Approved");
    await sendIssue.execute({ id: "draft-1", audience: "all" }, agent);
    await expect(sendIssue.execute({ id: "draft-1", audience: "all" }, agent)).rejects.toThrow(/already been sent/);
    expect(questions).toHaveLength(1);
    expect(provider.delivered).toHaveLength(1);
  });

  it("refuses a scheduled issue whose time has passed, and sends one scheduled for later", async () => {
    const { agent, provider, answerWith } = createHarness();
    answerWith("Approved");
    const later = await provider.createIssue({ newsletter: "weekly", subject: "Later", markdown: "Body" });
    await provider.scheduleIssue(later.id, Date.now() + 3_600_000, "all");
    await sendIssue.execute({ id: later.id, audience: "all" }, agent);
    expect(provider.issues.find(issue => issue.id === later.id)?.status).toBe("sent");

    const late = await provider.createIssue({ newsletter: "weekly", subject: "Late", markdown: "Body" });
    await provider.scheduleIssue(late.id, Date.now() - 1000, "all");
    await expect(sendIssue.execute({ id: late.id, audience: "all" }, agent)).rejects.toThrow(/already going out/);
  });

  it("refuses an empty subject or body, before asking", async () => {
    const { agent, provider, questions } = createHarness();
    const noBody = await provider.createIssue({ newsletter: "weekly", subject: "Empty body", markdown: "  \n " });
    const noSubject = await provider.createIssue({ newsletter: "weekly", subject: "   ", markdown: "Has a body" });
    await expect(sendIssue.execute({ id: noBody.id, audience: "all" }, agent)).rejects.toThrow(/no body/);
    await expect(sendIssue.execute({ id: noSubject.id, audience: "all" }, agent)).rejects.toThrow(/no subject/);
    expect(questions).toHaveLength(0);
  });

  it("needs a known audience: an unknown one, or none at all, is refused before asking", async () => {
    const { agent, questions } = createHarness();
    await expect(sendIssue.execute({ id: "draft-1", audience: "everybody" }, agent)).rejects.toThrow(/not an audience/);
    await expect(sendIssue.execute({ id: "draft-1" }, agent)).rejects.toThrow(/Say who should receive it/);
    expect(questions).toHaveLength(0);
  });

  it("uses the audience saved with the issue when none is given", async () => {
    const { agent, provider, answerWith } = createHarness();
    answerWith("Approved");
    await provider.updateIssue("draft-1", { audience: "status:free" });
    await sendIssue.execute({ id: "draft-1" }, agent);
    expect(provider.delivered).toEqual([{ kind: "send", id: "draft-1", audience: "status:free" }]);
  });

  it("refuses an issue of another newsletter", async () => {
    const { agent, provider } = createHarness();
    const other = await provider.createIssue({ newsletter: "daily", subject: "Other", markdown: "Body" });
    await expect(sendIssue.execute({ id: other.id, audience: "all" }, agent)).rejects.toThrow(/belongs to the newsletter "daily"/);
  });

  it("does not send an issue that changed while the prompt was open", async () => {
    const { agent, provider, answerWith } = createHarness();
    const original = agent.askQuestion;
    agent.askQuestion = (async (...args: Parameters<typeof original>) => {
      await provider.updateIssue("draft-1", { markdown: "Someone rewrote this while the prompt was open." });
      return original.apply(agent, args);
    }) as typeof original;
    answerWith("Approved");
    await expect(sendIssue.execute({ id: "draft-1", audience: "all" }, agent)).rejects.toThrow(/changed while waiting/);
    expect(provider.delivered).toHaveLength(0);
  });
});

describe("newsletter_scheduleIssue", () => {
  it("shares the send permission and states the time, audience and count in the prompt", async () => {
    const { agent, provider, questions, answerWith, permissions } = createHarness();
    answerWith(ALWAYS_ALLOW_VALUE);
    const sendAt = inAnHour();

    await scheduleIssue.execute({ id: "draft-1", sendAt, audience: "status:free" }, agent);

    const prompt = questions[0]?.message ?? "";
    expect(prompt).toContain("Hello subscribers");
    expect(prompt).toContain("Free members");
    expect(prompt).toContain("This will email about 1,000 people");
    expect(prompt).toContain(new Date(sendAt).toISOString());
    expect(provider.delivered).toEqual([{ kind: "schedule", id: "draft-1", audience: "status:free", at: Date.parse(sendAt) }]);
    expect(permissions.list().map(grant => grant.id)).toEqual([PERMISSION_ID]);

    // The same grant covers sending.
    const next = await provider.createIssue({ newsletter: "weekly", subject: "Next", markdown: "Body" });
    const { default: send } = await import("./sendIssue.ts");
    await send.execute({ id: next.id, audience: "all" }, agent);
    expect(questions).toHaveLength(1);
  });

  it("schedules nothing when declined", async () => {
    const { agent, provider, answerWith } = createHarness();
    answerWith("Not approved");
    await expect(scheduleIssue.execute({ id: "draft-1", sendAt: inAnHour(), audience: "all" }, agent)).rejects.toThrow(/did not approve/);
    expect(provider.delivered).toHaveLength(0);
  });

  it("rejects bad times, a provider that cannot schedule, and sent issues before asking", async () => {
    const { agent, provider, questions } = createHarness();
    await expect(scheduleIssue.execute({ id: "draft-1", sendAt: "next friday", audience: "all" }, agent)).rejects.toThrow(/not a real date/);
    // No offset: the server's zone would silently decide the moment. Impossible dates are refused too.
    await expect(scheduleIssue.execute({ id: "draft-1", sendAt: "2099-01-01T09:00:00", audience: "all" }, agent)).rejects.toThrow(/not a real date/);
    await expect(scheduleIssue.execute({ id: "draft-1", sendAt: "2099-02-31T09:00:00Z", audience: "all" }, agent)).rejects.toThrow(/not a real date/);
    expect(questions).toHaveLength(0);
    await expect(scheduleIssue.execute({ id: "draft-1", sendAt: new Date(Date.now() - 60_000).toISOString(), audience: "all" }, agent)).rejects.toThrow(
      /future/,
    );
    provider.supportedStatuses = ["draft", "sent"];
    await expect(scheduleIssue.execute({ id: "draft-1", sendAt: inAnHour(), audience: "all" }, agent)).rejects.toThrow(/does not support scheduled/);
    provider.supportedStatuses = ["draft", "scheduled", "sent"];
    await provider.sendIssue("draft-1", "all");
    await expect(scheduleIssue.execute({ id: "draft-1", sendAt: inAnHour(), audience: "all" }, agent)).rejects.toThrow(/already been sent/);
    expect(questions).toHaveLength(0);
  });

  it("refuses an empty body", async () => {
    const { agent, provider, questions } = createHarness();
    const empty = await provider.createIssue({ newsletter: "weekly", subject: "Hi", markdown: "" });
    await expect(scheduleIssue.execute({ id: empty.id, sendAt: inAnHour(), audience: "all" }, agent)).rejects.toThrow(/no body/);
    expect(questions).toHaveLength(0);
  });
});
