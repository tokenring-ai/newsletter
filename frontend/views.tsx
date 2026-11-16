import { defineView } from "@tokenring-ai/one-frontend/layout/define.ts";
import type { PluginLayoutViews } from "@tokenring-ai/one-frontend/plugins/layoutTypes.ts";
import { FilePlus, List, Mail, Newspaper } from "lucide-react";
import { lazy } from "react";
import { NEWSLETTER_ISSUE_CREATE_VIEW_ID, NEWSLETTER_ISSUE_VIEW_ID, NEWSLETTER_ISSUES_VIEW_ID, NEWSLETTER_START_VIEW_ID, NEWSLETTER_VIEW_KIND } from "./ids.ts";

const NewsletterIssuesPane = lazy(() => import("./panes/NewsletterIssuesPane.tsx"));
const NewsletterStartPane = lazy(() => import("./panes/NewsletterStartPane.tsx"));
const NewsletterIssuePane = lazy(() => import("./panes/NewsletterIssuePane.tsx"));
const NewsletterIssueCreatePane = lazy(() => import("./panes/NewsletterIssueCreatePane.tsx"));

export default {
  views: [
    // Navigator: newsletter selector and the issue list.
    defineView({
      id: NEWSLETTER_ISSUES_VIEW_ID,
      kind: "navigator",
      title: "Issues",
      description: "Issues of the selected newsletter, with their status",
      icon: List,
      closable: false,
      component: NewsletterIssuesPane,
    }),
    // `/newsletter`: the "Select an issue" placeholder; closes once an issue is opened.
    defineView({
      id: NEWSLETTER_START_VIEW_ID,
      landing: true,
      kind: NEWSLETTER_VIEW_KIND,
      title: "Select an issue",
      description: "Pick an issue to read or edit it, or start a new draft",
      icon: Mail,
      route: "",
      component: NewsletterStartPane,
    }),
    // New draft form (`/newsletter/new`). The static route wins over `:issueId`.
    defineView({
      id: NEWSLETTER_ISSUE_CREATE_VIEW_ID,
      kind: NEWSLETTER_VIEW_KIND,
      title: "New issue",
      description: "Write a new draft",
      icon: FilePlus,
      route: "new",
      component: NewsletterIssueCreatePane,
    }),
    // One issue per tab: an editor for drafts, read-only for scheduled and sent issues.
    defineView({
      id: NEWSLETTER_ISSUE_VIEW_ID,
      kind: NEWSLETTER_VIEW_KIND,
      title: "Issue",
      description: "Read or edit one newsletter issue",
      icon: Newspaper,
      route: ":issueId",
      instanceKey: params => params.issueId ?? "",
      component: NewsletterIssuePane,
    }),
  ],
} satisfies PluginLayoutViews;
