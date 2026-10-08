# Market submission

These files are the record of this plugin's submission to the DSH plugin catalog,
[`awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin), and of the
feature request that asks the maintainers to build the search natively. They are **not**
part of the plugin, and nothing at runtime reads them.

## Feature request to DeepSeek Harness

**Discussion:** https://github.com/deepseek-ai/deepseek-harness/discussions/9187
(`Ideas`, posted 2026-10-08)

The right home for this feature is `ui-plugin-manager` itself, not a third-party DOM
injection. The route there turned out **not** to be an issue or a pull request:

| Route | Status | Evidence |
| --- | --- | --- |
| Pull request | ❌ not accepted | `CONTRIBUTING.md`: *"we cannot accept external pull requests at the moment"* |
| Issue | ❌ disabled | `hasIssuesEnabled: false` — there is no New issue button |
| Discussion | ✅ the documented route | `CONTRIBUTING.md`: *"Identify and report issues or bugs in GitHub Discussions"* |

Sent to the `Ideas` category, which is what that category is for.

Two findings shaped the post, both verified against the shipped artifacts by
[`../tools/verify-discussion-claims.mjs`](../tools/verify-discussion-claims.mjs)
(34/34 assertions):

1. **The maintainers already ship a search implementation** — in Settings → Plugins →
   Plugin list (`ui-settings-plugin-inventory`). Its `matches()` covers `moduleName`,
   `entryId`, `title` and `description`, and it has an `emptySearch` state with localized
   copy. So the ask is not "add search" but *"apply that pattern at the Plugins page's
   list level"* — a much smaller change against an existing precedent.
2. **This page is not entirely without search**, and the post says so rather than
   overstating. `ui-plugin-manager` does have a `type: "search"` input — but it lives
   inside a **bundle's detail page**, filters **that bundle's own rows**, only renders past
   `ROW_FILTER_THRESHOLD = 10`, and its copy is 组件 (component), not plugin. The gap is
   specifically the **list level**; claiming "no search at all" would have been false and
   would have cost the request its credibility.

Checked for duplicates before posting: #1017 and #4810 both concern the **settings** list
(hence "composes with search" — that page already has one), and #1857 is about
descriptions in that same list. No existing discussion asks for this page's list search.

`discussion-plugin-list-search.md` is the posted body, kept here so the claims stay
diffable against the code they describe.

---

## Catalog submission

**Pull request:** https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6882


Status as opened:

- `check` — **passed** (8m04s). That job builds the whole catalog, so it is the one that
  proves the entry parses and the generated READMEs stay consistent.
- `Submission gate` — **failed on one line**: `repository is 0.0 days old (needs 1)`. The
  gate's own summary says the rest is fine and that this clears by itself — *"nothing to
  do: this check re-runs by itself and should clear in about 24h. No need to resubmit,
  push, or close and reopen; the age bar is the only thing failing here."* A periodic
  sweep (`.github/workflows/regate.yml`, every 6 hours) re-runs it, so the verdict flips
  without any action here.

  The clock, concretely: the repository was created 2026-10-08 21:28 Beijing, so the bar is
  met at **2026-10-09 21:28 Beijing**. `regate.yml` runs on the cron `19 */6 * * *` (08:19 /
  14:19 / 20:19 / 02:19 Beijing), so the first pass *after* the bar is the one at
  **2026-10-10 02:19**; the 20:19 pass on 10-09 lands eight minutes before the bar and will
  still read 0.9 days. Expect the gate green in the early hours of 2026-10-10, i.e. by that
  morning.

- `huangxp12__dsh-plugin-search.yml` — the entry file, added to that repository at
  `data/plugins/huangxp12__dsh-plugin-search.yml`. One file is the whole submission: the
  list's READMEs are generated from `data/plugins/*.yml` and regenerated on `main` after
  merge, so they must not be edited by hand.
- `pr-body.md` — the pull request body.

`tools/open-submission-pr.mjs` opens the PR through the GitHub git-data API (blob → tree
with `base_tree` → commit → ref → PR). That route is used instead of a clone because the
catalog repository is ~145 MB, and because a `base_tree` commit provably touches exactly
one path — the review process explicitly checks that a submission does not rewrite other
people's entries.

Why keep a copy here: the entry is a claim about this repository, and keeping it beside the
code means the two can be diffed when either changes.
