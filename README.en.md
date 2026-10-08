# dsh-plugin-search

Adds a **keyword search box** to the DSH Plugins page — when you have many plugins
installed, one query finds the one you mean by name, description, or package name.

[中文](README.md)

![Typing "看板" leaves one matching card in each group; the query and the count sit on the search bar](docs/preview.svg)

## What it does

Injects a search bar under the Plugins page header (sidebar → **Plugins**) and filters
the cards as you type:

- **Match scope**: all visible text on a card (title, description, the "Experimental"
  tag) plus the package name or registration id behind it.
- **Matching**: case-insensitive substring. Space-separated terms are **AND** —
  `task board` requires both.
- **Group hiding**: a group with no hits is hidden together with its heading and count,
  instead of leaving an empty "Official 0" shell behind.
- **Count**: `shown / total` beside the field; "No matching plugins" when nothing hits.
- **Clearing**: the × button or `Esc` (`Esc` is consumed here, so it will not close the
  shell panel behind it).
- **Follows the UI language**: Chinese copy on a Chinese interface, English otherwise.

## Install

```bash
dsh plugin --profile <profile> add github:huangxp12/dsh-plugin-search
```

Or mount it by hand on an existing profile (e.g. `~/.dsh/profiles/desktop`):

1. Put the package inside the profile's `node_modules` (a junction works):

   ```powershell
   New-Item -ItemType Junction `
     -Path "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-plugin-search" `
     -Target "<path to this checkout>"
   ```

2. Append to that profile's `cordis.patch.yml`:

   ```yaml
   - insert:
       - id: plugin-search
         name: 'dsh-plugin-search'
   ```

3. Reload the page (with HMR on, the patch file itself is watched, so a restart is
   usually unnecessary).

Rollback: delete those two lines and the `node_modules\dsh-plugin-search` junction.

## What it does NOT do

It only reads and writes what is displayed; it never touches state:

- no network requests, no reading or writing session logs;
- no changes to plugin enablement — it does not install, uninstall, or toggle anything;
- no changes to plugin configuration;
- with an empty query the page's DOM is exactly what the shell rendered (every hidden
  marker is removed).

The host half (`lib/index.js`) has an empty `apply()`: its only purpose is to make this
package an **enabled Loader entry** — client bundles are served for enabled entries only.

## How it works

### Why DOM injection rather than a slot registration

The Plugins page belongs to `@deepseek-ai/dsh-client-ui-plugin-manager`. It declares only
four extension points:

| Slot | Purpose |
| --- | --- |
| `plugins.item` | **Add** a card for an official plugin |
| `plugins.bundle.config` | One bundle's configuration, rendered on its detail page |
| `plugins.row.config` | One row's configuration |
| `plugins.detail.{actions,badge,section}` | A detail page's header actions, tags, sections |

**There is no slot for a list-level toolbar.** And the page's `main` slot is keyed, with
`"plugins"` already taken by the page itself — taking the slot route would mean replacing
its whole UI, i.e. shadowing shipped UI: it breaks on upgrade and would require
reimplementing the install dialog and every package's configuration page. That is not a
price a search box should pay.

So this plugin uses the same approach as `dshmarket`'s `settings-nav-icon`: it targets the
`data-*` contract the page writes itself, injects the search bar, and toggles card
visibility by keyword.

### The DOM contract it relies on

| Selector | Meaning |
| --- | --- |
| `[data-plugin-panel]` | Page root; only the list view has a direct child `<header>`, so detail pages naturally have no search box |
| `[data-plugin-group="official"\|"bundles"]` | A group; hidden entirely when it has no hits |
| `[data-plugin-package="<name>"]` | An installed/official bundle card |
| `[data-plugin-item="<id>"]` | An official plugin card (one that registered a config page) |

These are attributes the shell writes in its own JSX — its outward DOM contract, stable
against rebuilds, unlike the **hashed CSS-module class names** (`fO69Vq_page` and friends),
none of which this plugin uses. If the shell changes, the worst case is a missing search
box, not a broken page.

### Surviving remounts

The shell's list is React-rendered: first load, switching list/detail, and installing or
uninstalling plugins all remount cards or the whole panel. Therefore:

- a `MutationObserver` (on `document.body`, covering the panel itself being unmounted and
  rebuilt) drives re-synchronisation, with `queueMicrotask` coalescing mutations within a
  frame;
- the query lives inside the `ctx.effect` closure rather than in a DOM node — after React
  replaces the cards the filter recomputes and the typed half is not lost;
- repositioning moves a DOM node (which breaks focus), so focus and caret position are
  saved before the move and restored after;
- the stylesheet is re-asserted on every sync (so it comes back if `<head>` is rebuilt)
  instead of being inserted once in `apply()`.

### Visuals

All colours and radii come from the shell's theme tokens (`--dsw-alias-*`), so light/dark
follows automatically with no hard-coded values.

The bar carries **`data-window-drag-recall`**: the header is a window-drag region on
desktop (the shell marks the `<header>` with `data-window-drag`, making the whole block
draggable on macOS), and the shell provides this inverse marker for interactive content
inside it (`[data-window-drag-recall]{-webkit-app-region:no-drag}`). Using it is more
reliable than restating the rule in our own stylesheet: even before our `<style>` lands,
the shell's rule already applies, so clicking the field can never start a window drag.

## Development

```bash
# Pure logic (query splitting, matching, copy) + loading contract: 41 checks
node test/unit.test.mjs

# DOM behaviour (jsdom; the fixture copies ui-plugin-manager's real structure): 47 checks
node test/dom.test.mjs

# A browser harness you can also just open: test/dom-harness.html (43 checks, run in Chrome)
```

Neither suite starts a GUI: `unit` installs a minimal `__ModuleLoader__` to capture the row
the bundle registers, and `dom` builds a DOM isomorphic to the real page in jsdom and
asserts the filtering behaviour. The fixture's structure and `data-*` attributes are the
contract the code under test navigates by — if the fixture changes and `lib/client.js`
does not follow, the tests are supposed to go red.

A fourth, end-to-end suite (`tools/verify-live.mjs`, 17 checks) confirms against a running
`dsh web` that the host reports this package in its boot graph, serves its bundle
byte-identically, and leaves `/` and `/api` auth unchanged. It is **not shipped in this
repository** on purpose: to reach the local GUI it signs a loopback session cookie with the
`client-connection/browser-session` secret from `~/.dsh/.credentials.yaml`, and a plugin
repository is the wrong place to keep a file that reads credentials — however benign, it is
exactly the shape a reviewer is right to look twice at. Recreate it locally if you want the
check; the three suites above need no credentials and cover the plugin's own behaviour.

### Files

- `lib/client.js` — the browser half, a hand-written bundle
  (`window.__ModuleLoader__.load({id, factory})`) with **no build chain**: `require("react")`
  and friends are served by the shell's module table, and this plugin does not even need
  React.
- `lib/index.js` — the host half; `apply()` is empty.
- `test/` — the two test suites plus `dom-harness.html`, openable in a browser.
- `docs/preview.svg` — the preview, generated by `tools/render-preview.mjs` running the
  real `lib/client.js` (not a hand-drawn mock): after typing "看板", one matching card
  remains in each group and the bar reads `2 / 9`.
- `tools/asar-extract.mjs` — a read-only tool for reading shell sources out of `app.asar`
  (used during development to verify ui-plugin-manager's DOM contract); unrelated to
  running the plugin.
- `tools/render-preview.mjs` — regenerates `docs/preview.svg` and `assets/screenshot-1.png`
  by driving the real bundle in jsdom, so the screenshots cannot drift from the code.
