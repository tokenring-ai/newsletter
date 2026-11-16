import { useRouteParamsFor } from "@tokenring-ai/one-frontend/apps/panelHooks.ts";
import ContentListItem from "@tokenring-ai/one-frontend/components/ui/ContentListItem.tsx";
import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import ErrorState from "@tokenring-ai/one-frontend/components/ui/ErrorState.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import StatusBadge from "@tokenring-ai/one-frontend/components/ui/StatusBadge.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import { useNewsletterIssues } from "@tokenring-ai/one-frontend/rpc.ts";
import { Button, Select } from "@tokenring-ai/one-frontend/ui";
import { FilePlus, Mail } from "lucide-react";
import { NEWSLETTER_ISSUE_VIEW_ID } from "../ids.ts";
import { NewsletterSetupHint } from "../lib/setup.tsx";
import { ISSUE_STATUS_STYLES, useNewsletterSelection } from "../lib/store.ts";
import { useNewsletterNavigation } from "../lib/useNewsletterNavigation.ts";

const optionValue = (provider: string, newsletter: string) => JSON.stringify([provider, newsletter]);

function IssueDate({
  item,
}: {
  item: { status: "draft" | "scheduled" | "sent"; updatedAt: number; scheduledAt?: number | undefined; sentAt?: number | undefined };
}) {
  const when = item.status === "scheduled" ? item.scheduledAt : item.status === "sent" ? item.sentAt : item.updatedAt;
  const verb = item.status === "scheduled" ? "For" : item.status === "sent" ? "Sent" : "Edited";
  return (
    <span>
      {verb} {new Date(when ?? item.updatedAt).toLocaleString()}
    </span>
  );
}

/** Navigator: pick a newsletter, see its issues with their status. */
export default function NewsletterIssuesPane() {
  const { options, provider, newsletter, select, isLoading, error, refresh } = useNewsletterSelection();
  const issues = useNewsletterIssues(provider, newsletter?.id);
  const { openIssue, openCreate } = useNewsletterNavigation();
  const openIssueId = useRouteParamsFor(NEWSLETTER_ISSUE_VIEW_ID)?.issueId;

  if (isLoading) return <LoadingState message="Loading newsletters…" />;
  if (error) return <ErrorState title="Newsletters could not be loaded" error={error} onRetry={refresh} />;
  if (options.length === 0 || !provider || !newsletter) {
    return <EmptyState variant="compact" icon={Mail} title="No newsletter connected" hint={<NewsletterSetupHint />} />;
  }

  return (
    <ViewShell
      tone="sidebar"
      pad="compact"
      header={
        <div className="p-2 space-y-2">
          <Select
            label="Newsletter"
            size="sm"
            value={optionValue(provider, newsletter.id)}
            onChange={value => {
              const [nextProvider, nextNewsletter] = JSON.parse(value) as [string, string];
              select(nextProvider, nextNewsletter);
            }}
          >
            {options.map(option => (
              <option key={optionValue(option.provider, option.newsletter.id)} value={optionValue(option.provider, option.newsletter.id)}>
                {option.newsletter.name} ({option.provider})
              </option>
            ))}
          </Select>
          <Button size="sm" icon={FilePlus} onClick={openCreate}>
            New issue
          </Button>
        </div>
      }
    >
      {issues.isLoading && !issues.data ? (
        <LoadingState message="Loading issues…" />
      ) : issues.error ? (
        <ErrorState title="Issues could not be loaded" error={issues.error} onRetry={() => void issues.mutate()} />
      ) : issues.data && issues.data.issues.length === 0 ? (
        <EmptyState variant="inline" title="No issues yet" hint="Start a new draft, or ask the newsletter agent to write one." />
      ) : (
        <ul className="space-y-0.5">
          {issues.data?.issues.map(item => {
            const style = ISSUE_STATUS_STYLES[item.status];
            return (
              <li key={item.id}>
                <ContentListItem
                  selected={openIssueId === item.id}
                  onClick={() => openIssue(item.id)}
                  title={item.subject || "(no subject)"}
                  status={<StatusBadge label={style.label} dotColor={style.dotColor} colorClass={style.colorClass} />}
                  metadata={<IssueDate item={item} />}
                />
              </li>
            );
          })}
        </ul>
      )}
    </ViewShell>
  );
}
