import { beforeEach, describe, expect, it, mock } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defineView } from "@tokenring-ai/one-frontend/layout/define.ts";
import { MessageSquare } from "lucide-react";
import { SWRConfig, mutate as swrMutate } from "swr";

type TestIssue = {
  id: string;
  newsletter: string;
  subject: string;
  preheader?: string;
  markdown: string;
  status: "draft" | "scheduled" | "sent";
  audience?: string;
  createdAt: number;
  updatedAt: number;
  scheduledAt?: number;
  sentAt?: number;
  url?: string;
  stats?: { recipients?: number; opened?: number };
};

const draft: TestIssue = {
  id: "issue-1",
  newsletter: "weekly",
  subject: "Hello subscribers",
  preheader: "A preview",
  markdown: "Welcome to the **first** issue.",
  status: "draft",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_100_000,
};
const sent: TestIssue = {
  id: "issue-2",
  newsletter: "weekly",
  subject: "Last week",
  markdown: "Old news.",
  status: "sent",
  audience: "all",
  createdAt: 1_690_000_000_000,
  updatedAt: 1_690_000_100_000,
  sentAt: 1_690_000_200_000,
  url: "https://site.example/last-week/",
  stats: { recipients: 1204, opened: 600 },
};
const scheduled: TestIssue = {
  id: "issue-3",
  newsletter: "weekly",
  subject: "Coming soon",
  markdown: "Soon.",
  status: "scheduled",
  audience: "status:free",
  createdAt: 1_695_000_000_000,
  updatedAt: 1_695_000_100_000,
  scheduledAt: 4_000_000_000_000,
};

const state = {
  options: [{ provider: "my-site", newsletter: { id: "weekly", name: "The Weekly" }, supportedStatuses: ["draft", "scheduled", "sent"] }] as {
    provider: string;
    newsletter: { id: string; name: string };
    supportedStatuses: string[];
  }[],
  issues: [draft, sent, scheduled] as TestIssue[],
};

const audiences = [
  { id: "all", name: "Everyone subscribed", memberCount: 1204 },
  { id: "status:free", name: "Free members", memberCount: 1000 },
];

const withoutBody = ({ markdown: _markdown, ...item }: TestIssue) => item;

const createIssue = mock(async (args: { provider: string; newsletter: string; subject: string; markdown: string; preheader?: string; audience?: string }) => ({
  issue: { ...draft, id: "issue-new", subject: args.subject, markdown: args.markdown },
  message: "Draft created: issue-new",
}));
const updateIssue = mock(async (args: { provider: string; id: string; updatedData: Record<string, unknown> }) => ({
  issue: { ...(state.issues.find(issue => issue.id === args.id) ?? draft), ...args.updatedData },
  message: `Draft saved: ${args.id}`,
}));
const mutateOptions = mock(async () => undefined);

void mock.module("@tokenring-ai/one-frontend/rpc.ts", () => ({
  useNewsletterOptions: () => ({ data: state.options, isLoading: false, error: undefined, mutate: mutateOptions }),
  useNewsletterIssues: (provider: string | undefined) => ({
    data: provider ? { issues: state.issues.map(withoutBody) } : undefined,
    isLoading: false,
    error: undefined,
    mutate: mock(async () => undefined),
  }),
  useNewsletterIssue: (provider: string | undefined, id: string | undefined) => {
    const issue = provider && id ? state.issues.find(candidate => candidate.id === id) : undefined;
    return {
      data: issue ? { issue } : undefined,
      isLoading: false,
      error: provider && id && !issue ? new Error("Issue not found") : undefined,
      mutate: mock(async () => undefined),
    };
  },
  useNewsletterAudiences: () => ({ data: { audiences }, isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  newsletterRPCClient: { createIssue, updateIssue },
}));

const { default: layout } = await import("../layout.ts");
const { default: viewsModule } = await import("../views.tsx");
const { CORE_KINDS } = await import("@tokenring-ai/one-frontend/apps/kinds.ts");
const { createLayoutRegistry } = await import("@tokenring-ai/one-frontend/layout/registry.ts");
const { renderLayoutApp } = await import("@tokenring-ai/one-frontend/test/layout.tsx");

const chatView = defineView({
  id: "chat",
  kind: "agent",
  title: params => params.agentId ?? "Chat",
  icon: MessageSquare,
  route: "agent/:agentId",
  instanceKey: params => params.agentId ?? "",
  component: () => <p>chat stub</p>,
});

const registry = createLayoutRegistry({ apps: layout.apps, views: [...viewsModule.views, chatView], kinds: [...CORE_KINDS, ...layout.kinds] });

SWRConfig.defaultValue.dedupingInterval = 0;

let current: ReturnType<typeof renderLayoutApp> | null = null;
const renderApp = (url = "/newsletter") => {
  current = renderLayoutApp({ registry, url });
  return current;
};
const pathname = () => current?.location().pathname;

describe("Newsletters app", () => {
  beforeEach(async () => {
    localStorage.clear();
    await swrMutate(() => true, undefined, { revalidate: false });
    for (const fn of [createIssue, updateIssue, mutateOptions]) fn.mockClear();
    state.options = [{ provider: "my-site", newsletter: { id: "weekly", name: "The Weekly" }, supportedStatuses: ["draft", "scheduled", "sent"] }];
    state.issues = [draft, sent, scheduled];
  });

  it("lists issues with a status badge each, and opens one as a tab", async () => {
    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByText("Hello subscribers")).toBeInTheDocument();
    expect(screen.getByText("Last week")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);

    await user.click(screen.getByText("Hello subscribers"));
    await waitFor(() => expect(pathname()).toBe("/newsletter/issue-1"));
  });

  it("edits a draft and saves its subject, preview, body and audience", async () => {
    const user = userEvent.setup();
    renderApp("/newsletter/issue-1");

    const subject = await screen.findByLabelText("Subject");
    expect(subject).toHaveValue("Hello subscribers");
    expect(screen.getByLabelText("Preview text")).toHaveValue("A preview");
    expect(screen.getByLabelText(/Body/)).toHaveValue("Welcome to the **first** issue.");
    const save = screen.getByRole("button", { name: /Save/ });
    expect(save).toBeDisabled(); // nothing changed yet

    await user.clear(subject);
    await user.type(subject, "A better subject");
    await user.selectOptions(screen.getByLabelText("Audience"), "status:free");
    await user.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() => expect(updateIssue).toHaveBeenCalledTimes(1));
    expect(updateIssue).toHaveBeenCalledWith({
      provider: "my-site",
      id: "issue-1",
      updatedData: { subject: "A better subject", preheader: "A preview", markdown: "Welcome to the **first** issue.", audience: "status:free" },
    });
    // The editor never offers a way to email people.
    expect(screen.queryByRole("button", { name: /^(send|schedule)/i })).not.toBeInTheDocument();
  });

  it("creates a new draft and opens it", async () => {
    const user = userEvent.setup();
    renderApp("/newsletter/new");

    await user.type(await screen.findByLabelText("Subject"), "Fresh issue");
    await user.type(screen.getByLabelText(/Body/), "Some words");
    await user.click(screen.getByRole("button", { name: /Create draft/ }));

    await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1));
    expect(createIssue).toHaveBeenCalledWith({ provider: "my-site", newsletter: "weekly", subject: "Fresh issue", markdown: "Some words" });
    await waitFor(() => expect(pathname()).toBe("/newsletter/issue-new"));
  });

  it("shows a sent issue read-only, with its audience and results", async () => {
    renderApp("/newsletter/issue-2");

    const subject = await screen.findByLabelText("Subject");
    expect(subject).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/Body/)).toHaveAttribute("readonly");
    expect(screen.getByText(/A sent issue never changes/)).toBeInTheDocument();
    expect(screen.getByText(/Everyone subscribed/)).toBeInTheDocument();
    expect(screen.getByText(/1,204 recipients/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read online/ })).toHaveAttribute("href", "https://site.example/last-week/");
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Audience")).not.toBeInTheDocument();
  });

  it("shows a scheduled issue read-only and says changes go through an agent", async () => {
    renderApp("/newsletter/issue-3");

    expect(await screen.findByLabelText("Subject")).toHaveAttribute("readonly");
    expect(screen.getByText(/Changing it goes through an agent/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
  });

  it("explains how to connect Ghost when no newsletter is available", async () => {
    state.options = [];
    renderApp();

    expect(await screen.findByText("No newsletter connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ghost settings" })).toHaveAttribute("href", `/configuration/${encodeURIComponent("@tokenring-ai/ghost-io")}`);
    expect(screen.getAllByText(/Admin API key/).length).toBeGreaterThan(0);
  });
});
