import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import { usePanel } from "@tokenring-ai/one-frontend/layout/hooks.ts";
import { Mail } from "lucide-react";
import IssueEditor from "../lib/IssueEditor.tsx";
import { NewsletterSetupHint } from "../lib/setup.tsx";
import { useNewsletterSelection } from "../lib/store.ts";
import { useNewsletterNavigation } from "../lib/useNewsletterNavigation.ts";

/** New draft (`/newsletter/new`). Saving closes this tab and opens the issue it created. */
export default function NewsletterIssueCreatePane() {
  const panel = usePanel();
  const { provider, newsletter, isLoading } = useNewsletterSelection();
  const { openIssue } = useNewsletterNavigation();

  if (isLoading) return <LoadingState message="Loading…" />;
  if (!provider || !newsletter) {
    return <EmptyState variant="page" className="h-full bg-primary" icon={Mail} title="No newsletter connected" hint={<NewsletterSetupHint />} />;
  }
  return (
    <IssueEditor
      provider={provider}
      newsletter={newsletter.id}
      onSaved={issue => {
        openIssue(issue.id);
        panel.close();
      }}
      onCancel={() => panel.close()}
    />
  );
}
