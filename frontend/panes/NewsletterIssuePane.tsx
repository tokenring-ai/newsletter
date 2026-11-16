import ErrorState from "@tokenring-ai/one-frontend/components/ui/ErrorState.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import type { ViewProps } from "@tokenring-ai/one-frontend/layout/define.ts";
import { useNewsletterIssue } from "@tokenring-ai/one-frontend/rpc.ts";
import IssueEditor from "../lib/IssueEditor.tsx";
import { useNewsletterSelection } from "../lib/store.ts";

/** One issue (`/newsletter/<issueId>`): a draft editor, or a read-only view of a scheduled or sent issue. */
export default function NewsletterIssuePane({ params }: ViewProps) {
  const { provider, newsletter } = useNewsletterSelection();
  const issueId = params.issueId;
  const result = useNewsletterIssue(provider, issueId);

  if (!provider || !newsletter || !issueId) return <LoadingState message="Loading…" />;
  if (result.error) return <ErrorState variant="page" title="This issue could not be loaded" error={result.error} onRetry={() => void result.mutate()} />;
  if (!result.data) return <LoadingState message="Loading issue…" />;

  const { issue } = result.data;
  return (
    // Remounted when the saved issue changes, so the form starts from what is on the server.
    <IssueEditor key={`${issue.id}:${issue.updatedAt}`} provider={provider} newsletter={issue.newsletter} issue={issue} onSaved={() => void result.mutate()} />
  );
}
