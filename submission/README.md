# Market submission

These two files are the record of this plugin's submission to the DSH plugin catalog,
[`awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin). They are
**not** part of the plugin, and nothing at runtime reads them.

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
