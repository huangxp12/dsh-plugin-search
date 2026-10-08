# Market submission

These two files are the record of this plugin's submission to the DSH plugin catalog,
[`awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin). They are
**not** part of the plugin, and nothing at runtime reads them.

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
