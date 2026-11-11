# React files

React file card and related list for Salesforce, with a shared custom Tailwind
and shadcn theme. All five feature milestones are approved: card, drag-and-drop
uploads, record-page embedding, related list, and opening that list in a new tab.

## Local development

This repository uses npm. From the repository root:

```sh
npm ci --prefix react
npm run dev:react
```

- http://localhost:5173 shows the record card in wide and narrow regions.
- http://localhost:5173/?view=related shows an in-memory related list with search,
  sorting, pagination, selection, uploads, and deletion. These actions affect
  local sample data only; navigation and downloads display callback details.

The card harness defaults to **Live record**, connected to the `1Sync` account
(`001fL000009dbKKQAY`) in `better-files` using the existing Salesforce CLI login.
File previews, downloads, and uploads in this mode use the real development
record. Choose a fixture from **State** to check empty, loading, error, long-name,
and broken-thumbnail states without changing Salesforce files.

`dev/salesforce.ts` provides localhost-only reads and uploads. The adapter is
pinned to the approved org and account in `src/demo/live-record.ts`, verifies the
org ID, checks loopback/same-origin requests, and serves only file versions linked
to that record or its emails. Credentials stay on the server. Temporary downloads
are removed after the response. This adapter is absent from deployed builds.

## Component boundary

- `src/model.ts` and `src/related-list.ts`: typed data, settings, and host adapters.
- `src/components/file-card.tsx`: compact card; below 600px it stacks files and
  exposes upload through a menu.
- `src/components/related-list.tsx`: server-backed query, selection, paging, file
  actions, and delete confirmation.
- `src/components/upload-file-card.tsx`: shared React Dropzone target and picker,
  upload-status modal, and success/error toasts. Batch validation stays in the
  upload pipeline so rejected files retain their order and per-file messages.
- `src/mount.tsx`: `mountFiles` and `mountRelatedList`, each returning `update`
  and `unmount`. One React root per host; unmount before removing that host.
- `src/embedding/`: UI Bundle entry point, typed host channel, and SDK binary upload transport.
- `src/index.ts`: reusable component library exports.
- `src/salesforce.ts`: maps Apex rows to typed React file records.
- `src/demo/`: localhost harness and fixtures, excluded from the Salesforce bundle.

The shadcn primitives use Base UI. Portals and focus guards stay inside each
`[data-files-surface]` host for Lightning Web Security. Dialogs use local keyboard-focus
wrapping and backdrop dismissal rules; cancelling deletion restores focus to its
trigger, while deleting that trigger returns focus to Search Files.

## Theme

The `better-files` theme is the approved [option A styling](https://hmsar0grfxmy.postplan.dev/v/1) with
[typography B](https://hmsar0grfxmy.postplan.dev/v/3): system fonts, 16px body,
14px labels/metadata, 20px card headings, and 24px page/dialog headings. Panels
use 12px corners, inputs/menus 8px corners, and buttons rounded ends with 36px height.

Toasts use [option A](https://legectt22zbr.postplan.dev/v/1): solid green/red,
white 16px text, status icons, and 8px corners. They stay centered near the top of
the viewport with the upload modal open or closed; dismiss controls remain within
the modal's keyboard-focus boundary while it is open.

All React styling uses `bf:`-prefixed Tailwind utilities, including container queries,
media queries, dialogs, progress bars, toasts, and the local demo. `src/theme.css`
defines the shared Tailwind theme tokens. Use utilities and these tokens when
changing styles; do not add component CSS selectors or parallel stylesheets.

`settings.theme` selects the look: [Wisty UI](https://ui.wisty.ai)'s Salesforce
themes `cosmos` (the default, SLDS 2) and `lightning-blue` (SLDS 1's look), or
`better-files` (the approved values above). `FileSurface` writes it to `data-theme`, and
the mapping at the end of `src/theme.css` points the same tokens at that theme's
variables, so components need no theme-specific classes. Dialogs, menus, and
toasts portal inside the surface and follow it. The demo has a Theme control and
accepts `?theme=better-files`. In Salesforce, admins choose it with **Theme** on
**Setup → Custom Metadata Types → File Related List Config → Default**; a blank
value uses Cosmos.

`src/styles/wisty/` holds Wisty UI's theme files, copied unmodified from
`registry/themes/` at wisty-labs/wisty-ui@f9388e2; update them by copying newer
files, not by editing. Wisty UI's code is MIT (`LICENSE.md`), but the theme values
are Salesforce's, under the Terms of Use in `THIRD_PARTY_NOTICES.md`.
`components.json` registers the `@wisty` shadcn registry. Its components use
shadcn's token meanings, which differ here for `muted`, `primary`, and `heading`,
so adapt them rather than adding them unchanged.

The file card uses a CSS container query below 600px; responsive layout does not
measure widths in JavaScript. The demo slider supplies a runtime CSS variable to
a Tailwind max-width utility for testing different container sizes.

No SLDS stylesheet or `design-system-react` dependency is bundled; the Wisty
themes contribute CSS variables only. White surfaces
and light native controls are intentional. Global Preflight is omitted; `FileSurface`
provides scoped reset utilities. Tailwind utilities are important to withstand
Salesforce’s unlayered global rules, and `cn` merges classes using the `bf` prefix.
Each entry point lists its Tailwind sources so demo utilities stay out of the
Salesforce bundle.

## Salesforce components

The main Salesforce project in `../force-app/main/default/` contains the integration:

- `betterFilesReactCard`: record-page LWC, labelled **Better Files React** in App Builder.
- `betterFilesReactRelatedList`: URL-addressable related list opened by View All.
- `betterFilesEmbedding`: shared `lightning-ui-embedding` host and command bridge.
- `uiBundles/betterFiles`: hosted React build; generated `dist` is ignored by Git.
- `BetterFilesReact`: the Salesforce application granting access to the UI Bundle.
- `BetterFilesReactUpload` and its Apex tests: user-mode file upload service.
- `Better_Files_React`: permission set granting app and upload-service access.
- `FileListController.getReactAppUrl`: discovers the installed app URL from `AppMenuItem` in user mode, scoped to the `file1sync` namespace and requiring app access. Both React views share this lookup.
- `FileListController.getTheme`: reads the Theme picklist on `File_Related_List_Config__mdt` in user mode. `betterFilesEmbedding` fetches it with the app URL and adds it to both views' settings; if the lookup fails, the app uses its default.
- The legacy `BetterFilesReact` Trusted URL was removed from the package in 1.21 and remains absent in 2.0. The unused `React_App_URL__c` field (removed from the settings layout) and `BetterFilesReactAppUrl` label remain solely for managed-package upgrade compatibility.

The existing `FileListController` handles reads, server-side search/sorting,
25-row pages, metadata-driven columns/filters, and user-mode deletion. The wrappers
use Salesforce’s native file preview and download navigation. They preserve the
record, email inclusion, and minimum-size configuration when opening View All.

The related list labels its enclosing console tab `<record name> · Files` with a
Files icon. Standard navigation uses `<record name> · Files | Salesforce` as the
browser title. Late responses from another record cannot overwrite the current
label. Navigation away preserves the next page’s title.

After installation in each org:

1. Assign the **Better Files** and **Better Files React** permission sets to the intended users.
2. Follow the [installation and upgrade verification steps](../README.md#react-installation-and-upgrades), including activation when the installed bundle is inactive.
3. Refresh the record page. The card and View All discover this org's installed app URL automatically, including related-list tabs opened directly. No React URL configuration is required.

No iframe is created until discovery returns an HTTPS Salesforce app URL for Better Files. Missing app access or an invalid URL displays an error. The package does not enable a Trusted URL. In the tested `1sync` org, Lightning's existing `frame-src https:` policy permits the embed with the legacy entry inactive. If another org's CSP blocks the frame, its admin must allow the discovered app origin for `frame-src` in Trusted URLs. This does not grant app, API, record, or field access.

The unused URL field and label are retained for managed-package upgrade compatibility and are ignored regardless of their values. The Trusted URL removal was accepted in the fully validated 1.21.0.1 package build; subscriber upgrade behavior still needs verification.

To place the card on a record page, choose **Setup → Edit Page**,
add **Better Files React**, configure it, then save/activate for the intended app.
Salesforce supplies `recordId` and `objectApiName`. The wrapper supports thumbnails,
file count, columns, accepted formats, multiple uploads, email attachments, and
minimum file size. It refreshes through RefreshView and remounts on record changes.

In `better-files`, the existing `Account_Record_Page3` already hosts the working
card. The embedding experiment’s spike LWC, review app, and duplicate review page
have been removed; the active record page and its assignments are preserved.
The original and React components are packaged together from the root `force-app/`.

The wrappers register RefreshView handlers with `this.template.host`, which works
with both Lightning Locker and LWS. Locker does not expose
`LightningElement.isConnected`; the embedding host checks the HTML element instead.
The related list tracks connection through lifecycle callbacks because its wires
can fire before connection, when accessing the Locker host can cause a
“Re-setting of key is prohibited” error.

When upgrading an existing checkout, remove the old generated
`react/salesforce/force-app/main/default/staticresources/betterFilesReact/`
folder before deployment. It is no longer a build output. The obsolete
`betterFilesReact` static resource has already been removed from `better-files`.

Build before deploying from the repository root:

```sh
npm run build:salesforce
sf project deploy start --target-org better-files --source-dir force-app/main/default \
  --test-level RunSpecifiedTests --tests BetterFilesReactUploadTest --tests FileListControllerTest
sf org assign permset --target-org better-files --name Better_Files_React
```

Also grant the existing Better Files permission set and appropriate record/file
access. The React permission set grants app visibility and Apex access without
granting **API Enabled**. Reads and file actions use the LWC's Apex bridge;
binary uploads use the Data SDK for the Connect upload-configuration endpoint
and file-body transport. Salesforce's general Multi-Framework access guidance
requires API Enabled, but enforcement for this embedded upload path has not been
verified with a user lacking that permission. Test that user scenario before
adding a broader permission grant.
The CLI assignment above applies only to the authenticated development user.

[Open the account](https://1sync-file-dev-ed.develop.lightning.force.com/lightning/r/Account/001fL000009dbKKQAY/view)
· [Open its React related list](https://1sync-file-dev-ed.develop.lightning.force.com/lightning/cmp/file1sync__betterFilesReactRelatedList?file1sync__recordId=001fL000009dbKKQAY&file1sync__objectName=Account)

## Uploads and file actions

The embedded Salesforce card and related list accept **100 MB per file**. React
gets a fresh upload configuration through `@salesforce/platform-sdk/data`, sends
the binary file to Salesforce as multipart data, then passes the returned body ID
to Apex. Apex creates the ContentVersion and record link in user mode without
reading the bytes. Both layers enforce the 100 MB product limit; the transport
also respects the org's reported maximum. Tokens stay inside the authenticated
UI Bundle and never cross the LWC channel. Host props and replies are serialized
to avoid sending LWC proxy objects across the iframe boundary.

The localhost demo retains its separate **2 MB** development transport. The old
Apex/base64 method remains for compatibility, but the embedded components no
longer call it. Validation rejects empty files, invalid names, disallowed types,
oversized files, and multiple files when disabled.

The modal reports Waiting, Uploading, Uploaded, or Failed per file. Progress counts
processed files, not bytes. Success toasts disappear after eight seconds; error
toasts stay until dismissed. Closing the modal keeps the queue running; reopening
shows its status. Changing records aborts the embedded binary request and stops queued files. An
already submitted publish request may finish against its original record. Failed refreshes do not mark successful uploads as failed.

Related-list select-all applies to loaded rows. Search, sorting, and filter changes
clear selection. Failed pagination preserves the current rows and retries the same
page. Both single and bulk deletion require confirmation and explain that deletion
affects every record sharing that Salesforce file.

## Verification and remaining limits

```sh
npm run test:react
npm run test:react:lwc -- --runInBand
npm run build:react
npm run build:salesforce
npm run scan
```

Focused React, LWC, and Apex tests cover the retained functionality, including
host lifecycle, portal focus, query races, pagination retry, selection/deletion,
upload validation/outcomes, record scoping, and navigation. Fixtures remain local
so these checks and the localhost preview can keep exercising the real components.

The UI Bundle transport was verified in `better-files` with a generated 100 MiB
file using the production upload helper and Apex finalizer through an embedded
verification host. Salesforce confirmed 104,857,600 bytes, the expected MD5
checksum, and the Account link. The record card and related-list embedding were
also checked live. The automated browser cannot operate the closed embedding
iframe's file chooser, so a manual drag/drop and modal/toast review is still needed
for this migration. Temporary verification metadata and files were removed.

Before this migration, live development-org checks covered record reads, uploads, native preview,
View All, sorting/filtering, console naming, dialog focus, and a disposable-file
deletion. Typography B was verified in the LWC and on wide/narrow local cards.
Download navigation is tested, but browser download completion was not independently
verified. Source-deployed card and related-list loading were verified in a temporary
scratch org under both Lightning Locker and LWS, including automatic URL
discovery and tab naming.
Salesforce mobile and restricted-user access remain unverified. Resumable uploads
and user-controlled cancellation are not implemented.

Combined package builds have succeeded, including released versions 1.17.0.2 and 1.18.0.1.
The project owner has confirmed that packaged embedding works. The app URL is
discovered automatically through `AppMenuItem`; no development-org endpoint is shipped.
The main package now includes all integration metadata under `force-app/`, with API
version 68.0. `npm run version-create` rebuilds the bundle before creating a version.

`npm run scan` and CI check both authored source and the compiled bundle. The
UIBundle scan uses a temporary copy with repository-relative source paths beside
`dist`, so all integrity checks run without putting source links into the package.
The embedding build emits sourcemaps for every JavaScript chunk. Reports are in
`analyzer/`; high/critical findings, engine errors, and skipped integrity checks
fail the scan.

Follow the [installation and upgrade runbook](../README.md#react-installation-and-upgrades)
for each subscriber release, including checking the namespace, installed state,
activation, and rendering. Verify restricted-user access separately.
[Salesforce's access guidance](https://developer.salesforce.com/docs/platform/multiframework/guide/mfw-manage.html)
distinguishes app visibility/API access from object, field, and record permissions;
successful admin testing does not establish ordinary-user access.

The iframe isolates styles and confines dialogs/toasts to its bounds; it expands
while a dialog is open. The frame follows the body's height, uses a transparent
background around rounded panels, and leaves page scrolling to Lightning.
The native file preview still opens through the LWC host.

Once the SDK connects to an embedding host, Tailwind data-attribute variants hide Salesforce's
`sf-session-banner` and removes its reserved body padding. Standalone launches
retain the banner. This is a workaround using platform markup, not a documented
SDK option; recheck these selectors after Salesforce updates.

Static design review artifacts remain in `review/`; they are not deployed.
