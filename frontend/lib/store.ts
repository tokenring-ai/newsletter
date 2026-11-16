import { useLocalStorageState } from "@tokenring-ai/one-frontend/hooks/useLocalStorageState.ts";
import { useNewsletterOptions } from "@tokenring-ai/one-frontend/rpc.ts";
import { useCallback, useMemo } from "react";

/** The newsletter chosen in the navigator; every panel reads its data from it. */
export const NEWSLETTER_SELECTION_KEY = "newsletter:selection";

export interface NewsletterSelection {
  provider: string;
  newsletter: string;
}

export function useNewsletterSelection() {
  const options = useNewsletterOptions();
  const [stored, setStored] = useLocalStorageState<NewsletterSelection | null>(NEWSLETTER_SELECTION_KEY, null);

  const list = useMemo(() => options.data ?? [], [options.data]);
  const selected = list.find(option => stored !== null && option.provider === stored.provider && option.newsletter.id === stored.newsletter) ?? list[0];
  const select = useCallback((provider: string, newsletter: string) => setStored({ provider, newsletter }), [setStored]);

  return {
    options: list,
    provider: selected?.provider,
    newsletter: selected?.newsletter,
    supportedStatuses: selected?.supportedStatuses,
    select,
    isLoading: options.isLoading && !options.data,
    error: options.error,
    refresh: useCallback(() => void options.mutate(), [options.mutate]),
  };
}

export type IssueStatus = "draft" | "scheduled" | "sent";

export const ISSUE_STATUS_STYLES: Record<IssueStatus, { label: string; dotColor: string; colorClass: string }> = {
  draft: { label: "Draft", dotColor: "bg-amber-400", colorClass: "bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/30" },
  scheduled: { label: "Scheduled", dotColor: "bg-blue-400", colorClass: "bg-blue-400/10 text-blue-600 dark:text-blue-400 border-blue-400/30" },
  sent: { label: "Sent", dotColor: "bg-emerald-500", colorClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
};
