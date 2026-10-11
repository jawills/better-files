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
are removed after the response. This adapter is absent from static builds.

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
- `src/index.ts`: Salesforce library entry point, exposed as `window.BetterFilesReact`.
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

`src/theme.css` owns the scoped `--files-*` values and maps them into Tailwind’s
`bf`-prefixed theme. Use these shared values for custom styling. No SLDS stylesheet
or `design-system-react` dependency is bundled. White surfaces and light native
controls are intentional. Global Tailwind preflight is omitted; targeted unlayered
rules protect typography and button spacing from Salesforce’s global resets.

## Salesforce components

The separate project in `salesforce/` contains only the retained integration:

- `betterFilesReactCard`: record-page LWC, labelled **Better Files React** in App Builder.
- `betterFilesReactRelatedList`: URL-addressable related list opened by View All.
- `betterFilesReact`: generated JavaScript/CSS static resource, ignored by Git.
- `BetterFilesReactUpload` and its Apex tests: user-mode file upload service.
- `Better_Files_React`: permission set granting access to that upload service.

The existing `FileListController` handles reads, server-side search/sorting,
25-row pages, metadata-driven columns/filters, and user-mode deletion. The wrappers
use Salesforce’s native file preview and download navigation. They preserve the
record, email inclusion, and minimum-size configuration when opening View All.

The related list labels its enclosing console tab `<record name> · Files` with a
Files icon. Standard navigation uses `<record name> · Files | Salesforce` as the
browser title. Late responses from another record cannot overwrite the current
label. Navigation away preserves the next page’s title.

To place the card on a development record page, choose **Setup → Edit Page**,
add **Better Files React**, configure it, then save/activate for the intended app.
Salesforce supplies `recordId` and `objectApiName`. The wrapper supports thumbnails,
file count, columns, accepted formats, multiple uploads, email attachments, and
minimum file size. It refreshes through RefreshView and remounts on record changes.

In `better-files`, the existing `Account_Record_Page3` already hosts the working
card. The embedding experiment’s spike LWC, review app, and duplicate review page
have been removed; the active record page and its assignments are preserved.
The original package’s `force-app/` components remain separate from this project.

Build before deploying from the repository root:

```sh
npm run build:salesforce --prefix react
cd react/salesforce
sf project deploy start --target-org better-files --source-dir force-app/main/default \
  --test-level RunSpecifiedTests --tests BetterFilesReactUploadTest
sf org assign permset --target-org better-files --name Better_Files_React
```

Also grant the existing Better Files permission set and appropriate record/file
access. The CLI assignment above applies only to the authenticated development user.

[Open the account](https://1sync-file-dev-ed.develop.lightning.force.com/lightning/r/Account/001fL000009dbKKQAY/view)
· [Open its React related list](https://1sync-file-dev-ed.develop.lightning.force.com/lightning/cmp/file1sync__betterFilesReactRelatedList?file1sync__recordId=001fL000009dbKKQAY&file1sync__objectName=Account)

## Uploads and file actions

Uploads are limited to **2 MB per file** by the synchronous Apex/base64 transport.
Validation rejects empty files, invalid names, disallowed types, oversized files,
and multiple files when disabled. The server creates each ContentVersion and its
record link atomically in user mode.

The modal reports Waiting, Uploading, Uploaded, or Failed per file. Progress counts
processed files, not bytes. Success toasts disappear after eight seconds; error
toasts stay until dismissed. Closing the modal keeps the queue running; reopening
shows its status. Unmounting stops queued files, but an already submitted upload
may finish. Failed refreshes do not mark successful uploads as failed.

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

Live development-org checks have covered record reads, uploads, native preview,
View All, sorting/filtering, console naming, dialog focus, and a disposable-file
deletion. Typography B was verified in the LWC and on wide/narrow local cards.
Download navigation is tested, but browser download completion was not independently
verified. Lightning Locker, Salesforce mobile, restricted-user access, and managed
package installation remain unverified. Larger/resumable uploads and cancellation
need a separate transport decision before production use.

Static design review artifacts remain in `review/`; they are not deployed.
