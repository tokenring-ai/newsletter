import { usePaneLink } from "@tokenring-ai/one-frontend/layout/hooks.ts";
import { useCallback } from "react";
import { NEWSLETTER_ISSUE_CREATE_VIEW_ID, NEWSLETTER_ISSUE_VIEW_ID } from "../ids.ts";

/** Opening an issue navigates to its URL; the engine opens its tab. */
export function useNewsletterNavigation() {
  const open = usePaneLink();
  const openIssue = useCallback((issueId: string) => open(NEWSLETTER_ISSUE_VIEW_ID, { issueId }), [open]);
  const openCreate = useCallback(() => open(NEWSLETTER_ISSUE_CREATE_VIEW_ID), [open]);
  return { openIssue, openCreate };
}
