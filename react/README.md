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
- `src/components/upload-file-card.tsx`: shared drop target, picker, upload-status
  modal, and success/error toasts.
- `src/mount.tsx`: `mountFiles` and `mountRelatedList`, each returning `update`
  and `unmount`. One React root per host; unmount before removing that host.
- `src/embedding/`: UI Bundle entry point, typed host channel, and SDK binary upload transport.
- `src/index.ts`: reusable component library exports.
- `src/salesforce.ts`: maps Apex rows to typed React file records.
- `src/demo/`: localhost harness and fixtures, excluded from the Salesforce bundle.

The shadcn primitives use Base UI. Portals and focus guards stay inside each
`.better-files` host for Lightning Web Security. Dialogs use local keyboard-focus
wrapping and backdrop dismissal rules; cancelling deletion restores focus to its
trigger, while deleting that trigger returns focus to Search Files.

## Theme

Approved [option A styling](https://hmsar0grfxmy.postplan.dev/v/1) with
[typography B](https://hmsar0grfxmy.postplan.dev/v/3): system fonts, 16px body,
14px labels/metadata, 20px card headings, and 24px page/dialog headings. Panels
use 12px corners, inputs/menus 8px corners, and buttons rounded ends with 36px height.

Toasts use [option A](https://legectt22zbr.postplan.dev/v/1): solid green/red,
white 16px text, status icons, and 8px corners. They stay centered near the top of
the viewport with the upload modal open or closed; dismiss controls remain within
the modal's keyboard-focus boundary while it is open.

`src/theme.css` owns the scoped `--files-*` values and maps them into Tailwind’s
`bf`-prefixed theme. Use these shared values for custom styling. No SLDS stylesheet
or `design-system-react` dependency is bundled. White surfaces and light native
controls are intentional. Global Tailwind preflight is omitted; targeted unlayered
rules protect typography and button spacing from Salesforce’s global resets.

## Salesforce components

The separate project in `salesforce/` contains only the retained integration:

- `betterFilesReactCard`: record-page LWC, labelled **Better Files React** in App Builder.
- `betterFilesReactRelatedList`: URL-addressable related list opened by View All.
- `betterFilesEmbedding`: shared `lightning-ui-embedding` host and command bridge.
- `uiBundles/betterFiles`: hosted React build; generated `dist` is ignored by Git.
- `BetterFilesReact`: the Salesforce application granting access to the UI Bundle.
- `BetterFilesReactUpload` and its Apex tests: user-mode file upload service.
- `Better_Files_React`: permission set granting app and upload-service access.
- `FileListController.getReactAppUrl`: discovers the installed app URL from `AppMenuItem` in user mode, scoped to the `file1sync` namespace and requiring app access. Both React views share this lookup.
- The legacy `BetterFilesReact` Trusted URL is inactive. The unused `React_App_URL__c` field (removed from the settings layout) and `BetterFilesReactAppUrl` label remain solely for managed-package upgrade compatibility.

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
2. Refresh the record page. The card and View All discover this org's installed app URL automatically, including related-list tabs opened directly. No React URL configuration is required.

No iframe is created until discovery returns an HTTPS Salesforce app URL for Better Files. Missing app access or an invalid URL displays an error. The package does not enable a Trusted URL. In the tested `1sync` org, Lightning's existing `frame-src https:` policy permits the embed with the legacy entry inactive. If another org's CSP blocks the frame, its admin must allow the discovered app origin for `frame-src` in Trusted URLs. This does not grant app, API, record, or field access.

Previously released metadata is retained to avoid relying on Salesforce's restricted managed-package component-removal feature. Existing subscriber customizations can survive upgrades; the legacy URL field and label are ignored regardless of their values.

To place the card on a record page, choose **Setup → Edit Page**,
add **Better Files React**, configure it, then save/activate for the intended app.
Salesforce supplies `recordId` and `objectApiName`. The wrapper supports thumbnails,
file count, columns, accepted formats, multiple uploads, email attachments, and
minimum file size. It refreshes through RefreshView and remounts on record changes.

In `better-files`, the existing `Account_Record_Page3` already hosts the working
card. The embedding experiment’s spike LWC, review app, and duplicate review page
have been removed; the active record page and its assignments are preserved.
The original package’s `force-app/` components remain separate from this project.

When upgrading an existing checkout, remove the old generated
`react/salesforce/force-app/main/default/staticresources/betterFilesReact/`
folder before deployment. It is no longer a build output. The obsolete
`betterFilesReact` static resource has already been removed from `better-files`.

Build before deploying from the repository root:

```sh
npm run build:salesforce --prefix react
cd react/salesforce
sf project deploy start --target-org better-files --source-dir force-app/main/default \
  --test-level RunSpecifiedTests --tests BetterFilesReactUploadTest
sf org assign permset --target-org better-files --name Better_Files_React
```

Also grant the existing Better Files permission set and appropriate record/file
access. Users need **API Enabled** for the Data SDK; the current React permission
set grants app visibility and Apex access but does not grant API Enabled.
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
npm run test:react:lwc -- -- --runInBand
npm run build:react
npm run build:salesforce --prefix react
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
verified. Lightning Locker, Salesforce mobile, restricted-user access, and managed
package installation remain unverified. Resumable uploads and user-controlled cancellation are not implemented.

Combined package builds have succeeded, including released versions 1.17.0.2 and 1.18.0.1.
[Standalone UI Bundles support 2GP packaging](https://developer.salesforce.com/docs/platform/multiframework/guide/mfw-packaging.html),
but Salesforce's [internally hosted embedding documentation](https://developer.salesforce.com/docs/platform/microfrontend/guide/internal-ui-bundles.html)
still marks this embedding path beta and lists packaging and dynamic URL resolution as unavailable. Successful builds do not establish subscriber runtime support. Configure the explicit app URL once per org using the steps above; no development-org endpoint is shipped.
The root package-version script includes only `force-app/`. The combined builds use a temporary packaging project containing both `force-app/` and `react/salesforce/force-app/`, with API version 68.0.

Before considering customer distribution, resolve the embedding support limit,
verify installation/upgrades and restricted-user access in a clean org, and run
Code Analyzer `uibundle` checks for AppExchange review. The embedding build emits
sourcemaps for every JavaScript chunk; the root analyzer command still excludes
this separate React project. For source-integrity checks, the current analyzer
also needs `src` beside the bundle's `dist`; temporarily link it to `react/src`
while scanning and remove the link before deployment.
[Salesforce's access guidance](https://developer.salesforce.com/docs/platform/multiframework/guide/mfw-manage.html)
distinguishes app visibility/API access from object, field, and record permissions;
successful admin testing does not establish ordinary-user access.

The iframe isolates styles and confines dialogs/toasts to its bounds; it expands
while a dialog is open. The frame follows the body's height, uses a transparent
background around rounded panels, and leaves page scrolling to Lightning.
The native file preview still opens through the LWC host.

Once the SDK connects to an embedding host, scoped CSS hides Salesforce's
`sf-session-banner` and removes its reserved body padding. Standalone launches
retain the banner. This is a workaround using platform markup, not a documented
SDK option; recheck these selectors after Salesforce updates.

Static design review artifacts remain in `review/`; they are not deployed.
