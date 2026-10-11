# React files: milestones 1–5

Option A from the [approved design mocks](https://mcmijra1n885.postplan.dev).
Status: all five milestones approved by Justin. Milestone 4 uses option A.
Milestone 5 is satisfied by opening the URL-addressable related list in a new tab.
Justin selected upload option A, with an upload-status modal and success/failure toasts.

## Run locally

This repository uses npm. From the repository root:

```sh
npm ci --prefix react
npm run dev:react
```

Open http://localhost:5173. The harness defaults to **Live record**, connected to
the `1Sync` account (`001fL000009dbKKQAY`) in `better-files` using the existing
Salesforce CLI login. No deployment or browser token configuration is needed.
Click a file to preview images, PDFs, or text locally; other formats offer a
download. View All opens the account's Salesforce Related page. Refresh files
reads the record again. Drop files onto either card or choose Upload Files to attach
them to the account. Each file is limited to 2 MB in this development milestone.

The harness shows independent wide and narrow instances on a white background.
Choose populated, empty, loading, error, long-filename, or broken-thumbnail
fixtures from **State** to return to sample data. In fixture mode, preview opens
a placeholder dialog, and Upload and View All display callback payloads.
Adjust card width, columns, file limit, minimum size, thumbnail visibility,
email inclusion, and multiple-upload settings in either mode.

`dev/salesforce.ts` adds Vite development endpoints for reads and uploads. The adapter is
pinned to the approved org ID and account in `src/demo/live-record.ts`, checks
same-origin loopback requests, and serves only file versions linked to that
record or its emails. Salesforce CLI owns authentication. Downloads use private
temporary directories removed after the response. Credentials are never sent
to the browser. The adapter is absent from production/static builds, which
default to fixtures. Local reads use REST/SOQL as the CLI user, not the Apex
controller; the Salesforce embedding test exercises the Apex path. Uploads require
a matching Origin header and use a single ContentVersion insert with
FirstPublishLocationId to create the file and its record link together.

```sh
npm run build:react
npm run test:react
npm run build:salesforce --prefix react
```

## Component boundary

- `src/model.ts`: typed file records, record context, current App Builder settings,
  loading/error/ready states, and preview/upload/View All/retry callbacks.
- `src/components/file-card.tsx`: the compact card. Its host supplies filtered,
  limited rows and the full eligible count. At widths below 600px it stacks
  files and exposes upload through a menu.
- `src/components/upload-file-card.tsx`: file picker, drop target, sequential queue,
  status modal, and per-file toasts. Hosts provide upload and refresh adapters.
- `src/upload.ts`: shared file validation and FileReader encoding.
- `src/mount.tsx`: `mountFiles(element, props)` returns `update(props)` and
  `unmount()`. One React root per host. Unmount before removing the host.
- `src/demo/`: fixture data and the local review harness.
- `src/salesforce.ts`: maps existing Apex file rows into typed React file records.
- `src/spike.tsx`: static-resource entry point exposing `mountFiles` and
  `mountFixture` on `window.BetterFilesReact`.

The React UI uses shadcn/ui components backed by Base UI. Tailwind utilities and
theme variables use the `bf` prefix. Global preflight is omitted; resets are
scoped to `.better-files`. Overlays portal into a per-instance container.

Base UI was selected after the Radix menu failed under Lightning Web Security:
its global focus guards insert spans adjacent to `document.body`. Base UI keeps
the relevant DOM inside the supplied portal container. The fixture preview
explicitly retains its clicked file button for focus restoration across LWC's
shadow boundary. No security setting or vendor code was patched.

## Salesforce development spike

A separate Salesforce project under `salesforce/` contains:

- `betterFilesReact`, the generated static resource.
- `betterFilesReactSpike`, a URL-addressable test host with two independent
  React roots and controls to unmount/remount. Without a record ID it shows fixtures.
  With a record ID it reads existing files through `FileListController`.
- `BetterFilesReactUpload` and its test class: development-only upload transport,
  inserting ContentVersion and its record link together in user mode.
- `betterFilesReactCard`: the single-card LWC for record pages.
- `Better_Files_React_Account` and `BetterFilesReactReview`: a review copy of the
  existing Account page and a dedicated app with that page assigned only in this app.
- `Better_Files_React`: review-app visibility and access to the React upload class.

The generated bundle is ignored by Git. Build it before deploying.
This separate project is not part of the existing package's `force-app`
directory, so it does not change the current record-page card or related list.

Justin authorized the `better-files` org for this check: File Manager,
Developer Edition, namespace `file1sync`.

```sh
npm run build:salesforce --prefix react
cd react/salesforce
sf project deploy start --target-org better-files \
  --source-dir force-app/main/default/lwc/betterFilesReactSpike \
  --source-dir force-app/main/default/staticresources \
  --source-dir force-app/main/default/classes \
  --test-level RunSpecifiedTests --tests BetterFilesReactUploadTest
sf org open --target-org better-files \
  --path /lightning/cmp/file1sync__betterFilesReactSpike
```

[Open the development spike](https://1sync-file-dev-ed.develop.lightning.force.com/lightning/cmp/file1sync__betterFilesReactSpike).

[Test real files on the 1Sync account](https://1sync-file-dev-ed.develop.lightning.force.com/lightning/cmp/file1sync__betterFilesReactSpike?c__recordId=001fL000009dbKKQAY&c__objectName=Account).
The test and local harness use white backgrounds. For another record, change
`c__recordId` and `c__objectName` in the test URL. File clicks open Salesforce's
native preview; View All navigates to the existing related list. Upload and drop
attach files to the supplied record and refresh both cards.

## Milestone 3: record-page LWC

[Open 1Sync in the development review app](https://1sync-file-dev-ed.develop.lightning.force.com/lightning/app/06mal0000085jEPAAY/r/Account/001fL000009dbKKQAY/view).

The component is **Better Files React** in Lightning App Builder. To place it on
another development record page, open that record, choose **Setup → Edit Page**,
drag **Better Files React** into a region, configure it, then save and activate
for the intended development app. Salesforce supplies `recordId` and
`objectApiName`; neither needs a URL parameter or an App Builder property.

The wrapper exposes accepted formats, multiple uploads, thumbnails, file count
limit, files per row, email attachments, and minimum file size. The development
upload service allows the default file extensions; Accepted file formats can
narrow that set. The existing 2 MB upload limit still applies.

Native Salesforce preview and the existing Better Files related list handle file
clicks and View All. Filters carry through to View All. The wrapper registers with
RefreshView and refreshes both Apex wires. Record changes unmount the previous
React root and clear its file results, dialogs, and queued uploads. Disconnecting
unregisters refresh and unmounts React; reconnecting mounts a fresh root. A file
already submitted to Salesforce can still finish on its original record.

The review page copies the existing Account layout and replaces its file card.
The new app owns the page assignment. Existing apps and org-wide defaults keep
their current pages. No existing `force-app` component has been replaced.

Deploy the review components from the repository root:

```sh
npm run build:salesforce --prefix react
cd react/salesforce
sf project deploy start --target-org better-files --source-dir force-app/main/default \
  --test-level RunSpecifiedTests --tests BetterFilesReactUploadTest
sf org assign permset --target-org better-files --name Better_Files_React
```

For additional test users, assign the existing Better Files permission set as
well as Better Files React Review, and grant the required record/file access.
The CLI assignment above applies only to the authenticated development user.

Run the wrapper's focused tests from the repository root:

```sh
npm run test:react:lwc -- -- --runInBand
```

Six passing LWC tests cover defaults and setting changes, wire queries and counts,
record changes and reconnects, upload context, refresh/error propagation,
navigation, resource retry, and disconnecting while the bundle is loading.

On the actual 1Sync Account page, the wrapper loaded the record's files, opened
native image preview, navigated to the existing related list, and remounted when
returning. A synthetic TXT upload showed completion and refreshed the count; its
record link was checked and the test file removed. Record-page verification also
identified a sticky-header overlap, fixed by raising the scoped dialog and toast
stacking levels.

## Upload behavior

- Each file shows Waiting, Uploading, Uploaded, or Failed in the modal. The progress
  bar counts processed files; it does not estimate byte-level progress.
- Success and failure produce dismissible toasts. Success toasts disappear after
  eight seconds; errors remain until dismissed. The modal retains every result.
- Invalid types, empty files, files over 2 MB, and disallowed multi-file selections
  are rejected before sending. A failed file does not prevent the next upload.
- Closing the modal leaves the queue running; Show upload status reopens it.
  Leaving/unmounting the page stops remaining queued files. An already submitted
  upload may finish. Cancellation, resumable uploads, and automatic retries are
  outside this milestone. Refresh before retrying an uncertain server response.
- Successful uploads refresh the list once per batch. A refresh failure does not
  mark successfully uploaded files as failed.

The 2 MB limit is deliberate for this JSON/base64 development transport. Larger
files need a separate transport decision before production use.

## Review evidence

Verified in the namespaced development org under Lightning Web Security:

- Two simultaneous instances: three columns at 960px, one column at 320px.
- Menu opens in its own host; keyboard selection invokes only that card's callback.
- Dialog opens inside its host; Tab/Shift+Tab stay inside; Escape closes it and
  restores focus to the clicked file.
- Empty state reports zero files. Error recovery affects only the selected instance.
- Loading placeholders have no running animations.
- Long filenames truncate without horizontal overflow and retain their full title.
- Failed thumbnails fall back to extension icons.
- Unmount clears each host; remount creates fresh roots with unique heading IDs.
- The live test reads files from the 1Sync account. Clicking its logo file
  opens native Salesforce preview and loads the image. The test background is white.
- View All opens the existing related list for the same account.
- A local drop containing a valid TXT and rejected EXE showed mixed results and
  success/error toasts, created the valid file, and refreshed both cards.
- The embedded Salesforce picker uploaded a 2 MB TXT under Lightning Web Security,
  showed the completed modal and success toast, and refreshed both cards. Its
  ContentVersion size and account link were verified. Both synthetic uploads were
  removed after testing.

Twelve focused React tests cover host updates and cleanup, two-instance dialog
ownership and focus, keyboard menu selection with document-body insertion blocked,
error/thumbnail recovery, and Apex row mapping with separate document and version
IDs and thumbnail fallbacks, local record loading/preview and retry recovery,
mixed upload outcomes, validation, duplicate-drop prevention, nested drag events,
file selection, and refresh failures. Three Apex tests cover file/link creation,
invalid input, and the exact 2 MB boundary. All pass, as do type checking and both
build modes.

Salesforce compilation/deployment is not a managed-package installation test.
Lightning Locker, mobile Salesforce, and restricted-user file permissions
remain unverified. Live reads, uploads, and native preview were checked as the
development-org user. The record-page wrapper and App Builder configuration are
development-review components pending package validation.

Use Lightning navigation or the explicit mount/unmount API for lifecycle changes.
An additional probe that manually removed and reinserted the LWC host through
external DOM APIs did not restore its React roots. That relocation path is not
supported by this spike; ordinary navigation back to the component and its
mount/unmount controls were verified.

## Milestone 4: related list

Justin selected option A from [the related-list mocks](review/milestone-4.html).

- Local fixture review: http://localhost:5173/?view=related (58 sample rows).
  Search, sort, pagination, selection, upload and deletion operate on memory-only
  fixtures. Preview/download/navigation report their requested callbacks.
- Live review: open the **Better Files React Review** app, open the 1Sync account,
  and click **View All** on the React card. The URL-addressable host is
  `file1sync__betterFilesReactRelatedList`; the legacy related list is unchanged.
- Reuses `FileListController` for server search, global sorting, 25-row pages,
  deduplicated counts, Basic/Advanced filters, configured columns, and user-mode
  deletion. Record/email inclusion and minimum-size settings travel with View All.
- Select all selects loaded rows only. Search, filter and sort changes clear
  selection. Failed pagination keeps rows and retries the same page; request IDs
  discard late results. Both single and bulk deletion require confirmation and
  explain that deleting a Salesforce file affects all records sharing it.
- `UploadSurface` shares the existing drop/picker queue, modal, toasts, validation
  and 2 MB/file transport with both views. Upload refresh uses the current query,
  including when search changes while an upload is running.
- Dialogs stay in the per-instance portal. Lightning prevents the library from
  reliably traversing DOM ancestors for document-wide aria hiding, so the shared
  popup uses `aria-modal`, local Tab wrapping, and the backdrop instead.

Focused checks: 17 React tests and 9 LWC tests pass, including append retry,
stale response rejection, delete failure/confirmation, metadata filters, scoped
Apex requests, context changes, and navigation. Both build modes pass.
Live review verified View All, the account's nine files, Advanced PNG filtering,
search, title sorting, native preview, and a synthetic-file deletion with a
backend soft-delete check. The synthetic file was removed; existing files remain.
Local browser pagination was verified from 25 to 50 rows. The revised dialog's
accessible controls and keyboard focus wrapping were verified in Salesforce.
Download navigation is covered by the wrapper tests; the connected browser did
not expose a completed-download event, so file arrival was not independently
verified. The shared upload transport passed earlier live milestones and remains
covered by the React upload and wrapper tests.

## Milestone 5: open the related list in a new tab

Justin confirmed that the existing URL-addressable related list satisfies this
milestone. A separate standalone Salesforce navigation-tab component is not needed.
All five milestone reviews are complete.
The 2 MB upload limit and restricted-user/package-installation verification remain
production-readiness work.

## References

- [shadcn Base UI menu](https://ui.shadcn.com/docs/components/base/dropdown-menu)
- [shadcn Base UI dialog](https://ui.shadcn.com/docs/components/base/dialog)
- [Salesforce third-party library loading](https://developer.salesforce.com/docs/platform/lwc/guide/js-third-party-library.html)
- [Salesforce record-page configuration](https://developer.salesforce.com/docs/platform/lwc/guide/targets-lightning-record-page.html)
- [Salesforce RefreshView lifecycle](https://developer.salesforce.com/docs/platform/lwc/guide/data-refreshview-api.html)
- [Original five-milestone plan](https://5l7wcvfucgcy.postplan.dev)
