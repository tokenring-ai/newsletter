import type { PluginLayoutManifest } from "@tokenring-ai/one-frontend/plugins/layoutTypes.ts";
import { Mail } from "lucide-react";
import {
  NEWSLETTER_APP_ID,
  NEWSLETTER_APP_PATH,
  NEWSLETTER_ISSUE_CREATE_VIEW_ID,
  NEWSLETTER_ISSUE_VIEW_ID,
  NEWSLETTER_ISSUES_VIEW_ID,
  NEWSLETTER_START_VIEW_ID,
  NEWSLETTER_VIEW_KIND,
} from "./ids.ts";

/**
 * Newsletters: the issue list on the left, one tab per open issue on the right, and the agent's chat beside them.
 * Routes: `/newsletter`, `/newsletter/new`, `/newsletter/<issueId>`. Drafts are edited here; sending goes through
 * an agent, which asks first.
 */
export const NEWSLETTER_APP = {
  id: NEWSLETTER_APP_ID,
  path: NEWSLETTER_APP_PATH,
  label: "Newsletters",
  shortLabel: "NL",
  description: "Draft and review newsletter issues on Ghost and more",
  group: "Build",
  icon: Mail,
  iconClass: "text-sky-500",
  gradient: "from-sky-500 to-indigo-600",
  views: [NEWSLETTER_ISSUES_VIEW_ID, NEWSLETTER_START_VIEW_ID, NEWSLETTER_ISSUE_VIEW_ID, NEWSLETTER_ISSUE_CREATE_VIEW_ID, "chat"],
  primaryKind: NEWSLETTER_VIEW_KIND,
  placement: { agent: "right" },
  layout: {
    split: "row",
    sizes: [1, 3],
    children: [
      { presenter: "single", accepts: ["navigator"], items: [NEWSLETTER_ISSUES_VIEW_ID] },
      { presenter: "tabs", accepts: [NEWSLETTER_VIEW_KIND], items: [NEWSLETTER_START_VIEW_ID], primary: true },
    ],
  },
} satisfies PluginLayoutManifest["apps"][number];

export default {
  apps: [NEWSLETTER_APP],
  kinds: [{ id: NEWSLETTER_VIEW_KIND, label: "Issues", plural: "issue tabs" }],
} satisfies PluginLayoutManifest;
