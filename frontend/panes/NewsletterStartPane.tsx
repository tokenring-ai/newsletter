import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import ErrorState from "@tokenring-ai/one-frontend/components/ui/ErrorState.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import { FilePlus, Mail } from "lucide-react";
import { NewsletterSetupHint } from "../lib/setup.tsx";
import { useNewsletterSelection } from "../lib/store.ts";
import { useNewsletterNavigation } from "../lib/useNewsletterNavigation.ts";

/** `/newsletter`: the placeholder shown until an issue is opened. */
export default function NewsletterStartPane() {
  const { openCreate } = useNewsletterNavigation();
  const { provider, newsletter, isLoading, error, refresh } = useNewsletterSelection();

  if (isLoading) return <LoadingState message="Loading newsletters…" />;
  if (error) return <ErrorState variant="page" title="Newsletters could not be loaded" error={error} onRetry={refresh} />;
  if (!provider || !newsletter) {
    return <EmptyState variant="page" className="h-full bg-primary" icon={Mail} title="No newsletter connected" hint={<NewsletterSetupHint />} />;
  }
  return (
    <EmptyState
      variant="page"
      className="h-full bg-primary"
      icon={Mail}
      iconBadgeClassName="bg-linear-to-br from-sky-500 to-indigo-600"
      title="Select an issue"
      hint="Pick an issue from the list to read or edit it, or start a new draft. Sending always goes through an agent, which asks you first."
      ctaLabel="New issue"
      ctaIcon={FilePlus}
      onCta={openCreate}
    />
  );
}
