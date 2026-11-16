import type { Issue } from "@tokenring-ai/newsletter/NewsletterProvider";
import { usePanelBadge, usePanelTitle } from "@tokenring-ai/one-frontend/apps/panelHooks.ts";
import StatusBadge from "@tokenring-ai/one-frontend/components/ui/StatusBadge.tsx";
import { toastManager } from "@tokenring-ai/one-frontend/components/ui/toast.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import { useBusyAction } from "@tokenring-ai/one-frontend/hooks/useBusyAction.ts";
import { newsletterRPCClient, useNewsletterAudiences } from "@tokenring-ai/one-frontend/rpc.ts";
import { Button, Select, TextArea, TextField } from "@tokenring-ai/one-frontend/ui";
import formatError from "@tokenring-ai/utility/error/formatError";
import { ExternalLink, Save } from "lucide-react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { ISSUE_STATUS_STYLES } from "./store.ts";

interface Fields {
  subject: string;
  preheader: string;
  markdown: string;
  audience: string;
}

const fieldsOf = (issue: Issue | undefined): Fields => ({
  subject: issue?.subject ?? "",
  preheader: issue?.preheader ?? "",
  markdown: issue?.markdown ?? "",
  audience: issue?.audience ?? "",
});

/** What the person is told about an issue they cannot edit here. */
function readOnlyReason(issue: Issue): string {
  if (issue.status === "sent") {
    return `Sent${issue.sentAt ? ` on ${new Date(issue.sentAt).toLocaleString()}` : ""}. A sent issue never changes.`;
  }
  return `Scheduled${issue.scheduledAt ? ` for ${new Date(issue.scheduledAt).toLocaleString()}` : ""}. Changing it goes through an agent, which asks you first, because the change would be emailed.`;
}

/**
 * One issue. A draft is editable and saved with Save; a scheduled or sent issue is shown read-only. Sending and
 * scheduling are never done from here: they go through the agent tools, which show the approval with the number of
 * people who will be emailed.
 */
export default function IssueEditor({
  provider,
  newsletter,
  issue,
  onSaved,
  onCancel,
}: {
  provider: string;
  newsletter: string;
  /** Absent when writing a new draft. */
  issue?: Issue | undefined;
  onSaved: (issue: Issue) => void;
  onCancel?: (() => void) | undefined;
}) {
  const saved = fieldsOf(issue);
  const [fields, setFields] = useState<Fields>(saved);
  const { busy: saving, execute } = useBusyAction();
  const { mutate } = useSWRConfig();
  const audiences = useNewsletterAudiences(provider, newsletter);

  const readOnly = issue !== undefined && issue.status !== "draft";
  const dirty =
    !readOnly &&
    (fields.subject !== saved.subject || fields.preheader !== saved.preheader || fields.markdown !== saved.markdown || fields.audience !== saved.audience);

  usePanelTitle(issue ? issue.subject || "(no subject)" : "New issue");
  usePanelBadge(dirty && issue ? { tone: "warning", label: "Unsaved changes" } : null);

  const audience = audiences.data?.audiences.find(candidate => candidate.id === (readOnly ? issue.audience : fields.audience));

  const save = () =>
    execute(async () => {
      try {
        const data = {
          subject: fields.subject.trim(),
          markdown: fields.markdown,
          ...(fields.preheader.trim() ? { preheader: fields.preheader.trim() } : {}),
          ...(fields.audience ? { audience: fields.audience } : {}),
        };
        const result = issue
          ? await newsletterRPCClient.updateIssue({ provider, id: issue.id, updatedData: data })
          : await newsletterRPCClient.createIssue({ provider, newsletter, ...data });
        toastManager.success(result.message, { duration: 3000 });
        await mutate(key => typeof key === "string" && key.startsWith("/newsletter/"), undefined, { revalidate: true });
        onSaved(result.issue);
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      }
    });

  const style = ISSUE_STATUS_STYLES[issue?.status ?? "draft"];

  return (
    <ViewShell pad="page" width="prose">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-primary">{issue ? "Issue" : "New issue"}</h2>
          <StatusBadge label={style.label} dotColor={style.dotColor} colorClass={style.colorClass} />
          {issue?.url && (
            <a href={issue.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline focus-ring">
              <ExternalLink className="w-3 h-3" /> Read online
            </a>
          )}
        </div>
        {readOnly && (
          <p role="note" className="text-xs text-muted">
            {readOnlyReason(issue)}
          </p>
        )}

        <TextField
          id="issue-subject"
          label="Subject"
          size="md"
          value={fields.subject}
          onChange={subject => setFields(previous => ({ ...previous, subject }))}
          readOnly={readOnly}
          disabled={saving}
        />
        <TextField
          id="issue-preheader"
          label="Preview text"
          hint="Shown after the subject in most inboxes"
          size="md"
          value={fields.preheader}
          onChange={preheader => setFields(previous => ({ ...previous, preheader }))}
          readOnly={readOnly}
          disabled={saving}
        />
        <TextArea
          id="issue-body"
          label={
            <>
              Body <span className="font-normal normal-case tracking-normal">(Markdown)</span>
            </>
          }
          size="md"
          mono
          rows={14}
          value={fields.markdown}
          onChange={markdown => setFields(previous => ({ ...previous, markdown }))}
          readOnly={readOnly}
          disabled={saving}
          className="[&>textarea]:min-h-64"
        />

        {readOnly ? (
          <p className="text-sm text-primary">
            <span className="text-xs font-bold text-muted uppercase tracking-widest">Audience </span>
            {audience
              ? `${audience.name}${audience.memberCount === undefined ? "" : ` (${audience.memberCount.toLocaleString()} people)`}`
              : (issue.audience ?? "Not recorded")}
          </p>
        ) : (
          <Select
            id="issue-audience"
            label="Audience"
            hint="Who the issue goes to when it is sent. Sending is done by an agent, which asks you first."
            size="md"
            value={fields.audience}
            onChange={value => setFields(previous => ({ ...previous, audience: value }))}
            disabled={saving}
          >
            <option value="">Choose when sending</option>
            {audiences.data?.audiences.map(option => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.memberCount === undefined ? "" : ` (${option.memberCount.toLocaleString()} people)`}
              </option>
            ))}
          </Select>
        )}

        {issue?.stats && readOnly && (
          <p className="text-xs text-muted">
            {[
              issue.stats.recipients !== undefined && `${issue.stats.recipients.toLocaleString()} recipients`,
              issue.stats.opened !== undefined && `${issue.stats.opened.toLocaleString()} opened`,
              issue.stats.failed ? `${issue.stats.failed.toLocaleString()} failed` : false,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {!readOnly && (
          <div className="flex gap-2 pt-1">
            <Button
              size="md"
              icon={Save}
              busy={saving}
              busyLabel="Saving…"
              disabled={!fields.subject.trim() || (Boolean(issue) && !dirty)}
              onClick={() => void save()}
            >
              {issue ? "Save" : "Create draft"}
            </Button>
            {onCancel && (
              <Button variant="secondary" size="md" disabled={saving} onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>
    </ViewShell>
  );
}
