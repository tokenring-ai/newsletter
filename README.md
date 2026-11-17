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

### Verified against Ghost docs on 2026-11-16

Checked against the official Admin API docs (https://docs.ghost.org/admin-api, posts, newsletters, members pages, plus the
Content API filtering page https://docs.ghost.org/content-api/filtering) and, where the docs are silent, the Ghost source
at tag v5.100.0 (`ghost/core/core/server/{api/endpoints/posts.js,models/post.js,models/member.js,models/tag.js}`).

- Confirmed by the docs: `newsletters` browse and its `slug`/`status` (`active`|`archived`) fields (/admin-api/newsletters);
  `limit=all`; `meta.pagination.total` exists in responses; the `newsletter` slug query parameter on publish or schedule,
  `email_segment` as an NQL member filter with `all` (default), `status:free`, `status:-free`, and "sent if and only if an
  active newsletter is provided" (/admin-api/posts/sending-a-post); scheduling as `status: scheduled` + future
  `published_at` (/admin-api/posts/scheduling-a-post); `updated_at` required on every edit for collision detection
  (/admin-api/posts/updating-a-post); `source=html` on create and edit (/admin-api/posts/creating-a-post); tags created by
  name when unmatched, and `#name` as an internal tag; NQL `[a,b]` groups, `+` and, `:~`, quoting and `-` negation
  (/content-api/filtering); `tag:<slug>` post filter (/content-api/filtering); member `status` values are
  `free|paid|comped|gift` (so `status:-free` also covers comped and gift members).
- Confirmed only in the Ghost source (docs silent): the internal tag slug is `hash-<name>` (`models/tag.js`); `tag:` expands
  to `tags.slug` and `newsletters:` on members expands to `newsletters.slug` (`filterExpansions`); `newsletter` and
  `email_segment` are read only when a post's status changes to published/scheduled/sent and the post has no newsletter
  yet (`models/post.js`). Consequence, fixed in this plugin: a scheduled issue edited without a status change keeps the
  newsletter and segment Ghost stored, so they are no longer re-sent; and the audience of a scheduled issue cannot be
  changed by an edit, so the provider now refuses that.
- Could not confirm (docs and the source files read are silent): that a member count filter `email_disabled:0` is accepted
  by NQL (a rejected filter only makes the count "unknown"); that `meta.pagination.total` with `limit=1` counts the whole
  filtered set (the docs show the field, not this use); that `status:[published,sent]` is accepted for posts (the `[ ]`
  group is documented, `sent` as a post status is documented only for email-only posts); the exact set of members counted
  for `status:-free`; that reverting a scheduled post to draft clears its newsletter (source says it does when no email
  exists; not in the docs, and not used here); negating a tag-slug prefix in NQL (not documented, so the blog provider
  filters newsletter posts after the request instead).

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
