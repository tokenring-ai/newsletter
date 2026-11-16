# @tokenring-ai/newsletter

A provider-based newsletter service for Token Ring. Agents and people draft newsletter issues, review them, and
(only with a person's approval) schedule or send them. Ghost is the first provider
(`@tokenring-ai/ghost-io`); Gmail, Mailchimp and others can plug in later through the same interface.

## What it is

- **Newsletter**: a list people subscribe to ("The Weekly").
- **Audience**: who an issue is emailed to, with a head count when the provider can tell (Ghost: everyone subscribed,
  free members, paid members).
- **Issue**: one email: a subject, an optional preview text (preheader), a Markdown body, and a status:
  `draft`, `scheduled` or `sent`.

`NewsletterProvider` (`NewsletterProvider.ts`) is the interface a provider implements: `listNewsletters`,
`listAudiences`, `getAudienceSize`, `createIssue` (always a draft), `getIssue`, `listIssues`, `updateIssue` (never a
sent issue), `deleteIssue` (drafts only), `scheduleIssue`, `sendIssue`, and `supportedStatuses`. Bodies are Markdown in the
interface; each provider converts to what its service accepts.

`NewsletterService` keeps the registered providers and, per agent, the selected newsletter.

## Connecting Ghost

Add `newsletters` to a Ghost account in the Ghost plugin's settings (Configuration, `@tokenring-ai/ghost-io`):

```yaml
ghost:
  accounts:
    my-site:
      url: https://my-site.ghost.io
      apiKey: <Admin API key>
      newsletters: {}            # presence turns it on
      # newsletters:
      #   description: My site's newsletters
      #   include: [weekly]      # only offer these newsletter slugs (default: every active newsletter)
```

Accounts without `newsletters` stay a blog and a CDN only. The newsletter plugin must be installed (it is, in the
standard app). The Admin API key needs permission to read members and newsletters and to edit posts.

How Ghost issues work: an issue is a Ghost post tagged with the internal tags `#newsletter-<slug>` (and
`#audience-all|free|paid` when an audience is chosen); internal tags are hidden from readers. Ghost emails a post only
when it is published or scheduled with a newsletter, which only the send and schedule tools do. The body is stored as
HTML (rendered from your Markdown) and turned back into Markdown when you read it, so a round trip is close, not
byte for byte. Ghost can only record an audience for a draft through the tag, and records the real segment when the
issue is scheduled or sent. Audience labels (for example one label's members) are not offered yet.

## Configuration

```yaml
newsletter:
  agentDefaults:
    provider: my-site      # the Ghost account (or other provider) new agents use
    newsletter: weekly     # one of its newsletters
  agentTypes: [newsletter, writer, contentWriter, content-writer, managingEditor]
```

With one provider and one newsletter nothing needs selecting. Otherwise use `/newsletter select`.

## Chat commands

| Command | Description |
| --- | --- |
| `/newsletter select` | Choose the newsletter this agent works on |
| `/newsletter list` | List connected newsletters |
| `/newsletter issues` | List recent issues of the active newsletter with status |

## Tools

| Tool | Level | What it does |
| --- | --- | --- |
| `newsletter_listIssues`, `newsletter_getIssue`, `newsletter_listAudiences` | 1-2 | Read issues and audiences |
| `newsletter_selectNewsletter` | 3 | Pick the newsletter to work on |
| `newsletter_createIssue` | 4 | Create a **draft**. Nothing is emailed |
| `newsletter_updateIssue` | 4 / 8 | Edit a draft; editing a scheduled issue asks (level 8). A sent issue is refused |
| `newsletter_deleteIssue` | 6 | Delete a draft (asks) |
| `newsletter_scheduleIssue` | 8 | Email an issue at a future time. **Always asks** |
| `newsletter_sendIssue` | 8 | Email an issue now. **Always asks** |

### Approvals and permission ids

Sending and scheduling are level 8 and always ask a person, unless that person chose **Always allow** for this
newsletter. The prompt names the subject, the audience and the head count ("This will email about 1,204 people"),
or says the count could not be found. Scheduling, sending and editing a scheduled issue share one permission id:

```text
newsletter.<provider>.<newsletter>.send        e.g. newsletter.my-site.weekly.send
```

Both parts are slugged. The id names the provider as well as the newsletter, so a grant for one site's
`default-newsletter` never covers another site's. It covers every audience of that newsletter. In unattended jobs
(scheduled, queued, workflow) a send with no grant is refused and recorded on the job with this id, so you can
choose **Always allow** there. Levels 9 and 10 are never grantable; these are level 8.

Safety checks before the prompt: the issue must be a draft (or scheduled for later), have a subject and a body,
belong to the selected newsletter, and have an audience the newsletter offers. After approval the issue is read again;
if it changed while the prompt was open nothing is sent.

## RPC

`/rpc/newsletter` (browser-safe schema in `rpc/schema.ts`): `getNewsletterConfiguration`, `listNewsletters`,
`listAudiences`, `listIssues`, `getIssue`, `createIssue`, `updateIssue` (drafts only), `deleteIssue` (drafts only).
There is deliberately **no** send or schedule over RPC: emailing people goes through the tools, which show the
approval with the recipient count.

## Web app

The Newsletters app (`/newsletter`, group Build) lists the issues of the selected newsletter with status badges and
edits drafts (subject, preview text, Markdown body, audience). Scheduled and sent issues are read-only. Without a
connected newsletter it explains how to connect Ghost. It is not pinned to the rail by default.

## Tests

```bash
cd plugin/newsletter && bun test --isolate
```
