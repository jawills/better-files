# Better Files By 1Sync — Feature Documentation

**Package:** Better Files By 1Sync (`file1sync`)  
**Namespace:** `file1sync`

Better Files replaces the standard Salesforce Files related list on record pages with a richer card view and a dedicated **View All** experience. Files are stored as standard Salesforce Content (ContentVersion / ContentDocument) and respect user sharing via `with sharing` Apex and `asUser()` queries.

---

## Components

| Component | API name | Where it lives | Purpose |
|-----------|----------|----------------|---------|
| **Better Files** | `file1sync:fileList` | Record page (Lightning App Builder) | Compact file card on any record |
| **View All** | `file1sync:fileRelatedList` | URL-addressable page (opened from View All) | Full related list with search, filters, and bulk actions |

Supporting LWCs: `fileCard`, `fileDataTable`, `imagePreview`, `stencil`, `util`.

---

## Record page — Better Files (`fileList`)

### What users see

- A **Files** card with a live file count in the title (e.g. `Files (12)`).
- A **grid of file cards** showing thumbnail (when previewable), title, last modified date, size, and extension.
- **Upload** via `lightning-file-upload` in the card header (or a drop zone when no files exist).
- **View All** link in the footer and in the card title — opens the full related list.
- **Responsive layout**: narrow cards (&lt; 600px) stack one per row and collapse upload into an overflow menu.

### File card behavior

- **Previewable files** (PDF, Office docs, common images, text, CSV) show a thumbnail and open Salesforce’s native file preview on click.
- **Non-previewable files** show a doctype icon based on extension (Excel, Word, ZIP, etc.).
- File preview on the record page can be turned off per component instance (see configuration below).

### Upload

- **Standard upload**: `lightning-file-upload` linked to the current record.
- **Manual upload** (small/narrow layout): hidden file input with Apex `uploadFile` — creates a ContentVersion and ContentDocumentLink.
- **Multiple files** supported when enabled.
- **Accepted formats** configurable (default: PDF, Office, images, ZIP, etc.).
- List refreshes after a successful upload.

### Navigation to View All

- **Standard apps**: navigates to the URL-addressable `fileRelatedList` component.
- **Service Console**: opens View All in a **subtab** with a Files icon.
- Passes context via URL state: record Id, object API name, email inclusion, and minimum file size.

---

## View All — File related list (`fileRelatedList`)

### What users see

- Record **breadcrumbs** (object → record name) with links back to the parent record.
- **Data table** with row selection, custom title column (icon/thumbnail + preview), and row actions.
- **Toolbar**: selection summary, file-type filter, search, bulk Download/Delete, and upload.

### Columns (configurable)

Default columns, controlled by **Custom Metadata** (not App Builder):

| Column | Description |
|--------|-------------|
| **Title** | File name with thumbnail or icon; click opens preview |
| **Owner** | ContentDocument owner (link to user/queue) |
| **Last Modified Date** | ContentDocument last modified |
| **Last Modified By** | User who last modified the file (link) |
| **File Size** | Human-readable size (KB, MB, …) |
| **Actions** | Preview, Download, Delete |

Click any data column header to sort ascending or descending. The default is
**Last Modified Date, descending**. Sorting runs on the server before pagination,
using names for Owner/Last Modified By and bytes for File Size. Duplicate links
to the same file occupy one slot, including files linked through emails.

### Row actions

- **Preview** — Salesforce native file preview page.
- **Download** — Content Document download URL.
- **Delete** — single-file delete with confirmation via Apex (user must have delete access).

### Bulk actions

When one or more rows are selected:

- **Download** — multi-version download via Salesforce file servlet.
- **Delete** — bulk delete with confirmation dialog.

### Search

- Server-side search by **file title** (debounced 350ms).
- Respects current file-type filter, email inclusion, and minimum size settings.
- Uses the selected sort order and supports paging through matching files.
- Clearing search reloads the full list with the selected sort order.

### File type filter

Available on View All only (not the record-page card). The **Filter Mode** custom metadata setting chooses between **Basic** (default) and **Advanced**.

**Basic** keeps the existing categories:

| Filter | Extensions included |
|--------|---------------------|
| **All files** | No filter |
| **Images** | png, jpg, jpeg, gif, bmp, svg, webp, tif, tiff, heic |
| **Documents** | pdf, doc, docx, xls, xlsx, csv, ppt, pptx, txt, rtf, odt, ods, odp |

**Advanced** uses the same dropdown with **All files** plus the exact extensions present on the current record (for example, PDF, PNG, and XLSX). Files without an extension have a **No extension** option.

- Options include all eligible files across every page, including email files when enabled, and respect minimum file size and user access.
- Search and the selected type do not narrow the available options. Results and total counts apply the exact extension filter on the server.
- Navigation, uploads, and deletions refresh the available types. If a selected type disappears, selection returns to **All files**.
- Empty records offer only **All files**. Missing or unrecognized metadata defaults to **Basic**.

### Pagination

- Loads **25 files per page** (Apex `PAGE_SIZE`).
- **Get More Records** button appears when the total count exceeds loaded rows.
- Page 0 replaces the list; later pages append (infinite-style load more).

### Refresh behavior

- Refreshes file list and count together after upload or delete.
- Re-navigating to the same record in Console re-fetches data (handles reused subtabs).

---

## Email message attachments

When **Show Email Message Attachments** is enabled on the record-page component:

- Files linked to **EmailMessage** records related to the parent record are included.
- Only emails with `HasAttachment = true` and `RelatedToId` matching the record are considered.
- When the same file is linked to both the parent record and an email, the **email link is preferred** for display context.

This setting is passed through to View All via URL state (`c__includeEmails`).

---

## Minimum file size filter

- Configured on the record page as **Minimum file size (KB)**.
- Files smaller than the threshold are excluded from both the card and View All.
- `0` or blank means no minimum (all sizes).
- Passed to View All as `c__minimumFileSizeKb`.

---

## Configuration

### Record page — App Builder properties

Add **Better Files** (`file1sync:fileList`) to a Lightning record page and configure:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| **Accepted File Formats** | String | `.pdf,.doc,.docx,…` | Comma-separated extensions for upload `accept` |
| **Allow multiple file uploads at once** | Boolean | `true` | Multi-select upload |
| **Show preview of files** | Boolean | `true` | Thumbnails on record-page cards |
| **How many files are displayed on the record page** | Integer | `6` | Max files shown on the card |
| **How many files per row** | Integer | `3` | Grid columns (1–11; values ≥ 12 fall back to 3) |
| **Show Email Message Attachments** | Boolean | `true` | Include email attachment files |
| **Minimum file size (KB)** | Integer | `0` | Hide files below this size |

#### Deprecated properties (kept for backward compatibility)

These appear in App Builder but **no longer affect View All**. Configure columns in Custom Metadata instead.

| Property | Notes |
|----------|-------|
| `(Deprecated) Show Source on View All` | No-op; was replaced by Owner column via CMDT |
| `(Deprecated) Show Last Modified Date on View All` | No-op |
| `(Deprecated) Show Last Modified By on View All` | No-op |
| `(Deprecated) Show File Size on View All` | No-op |

Existing Lightning pages that saved these values will continue to deploy; values are ignored.

### View All — Custom Metadata

Because `fileRelatedList` is URL-addressable, it cannot expose App Builder design attributes. Column visibility, filter mode, and the React components' theme are controlled org-wide via:

**Setup → Custom Metadata Types → File Related List Config → Manage Records → Default**

| Field | Default | Controls |
|-------|---------|----------|
| `Filter_Mode__c` | `Basic` | Basic categories or Advanced record-specific extensions |
| `Show_Owner__c` | `true` | Owner column |
| `Show_Last_Modified_Date__c` | `true` | Last Modified Date column |
| `Show_Last_Modified_By__c` | `true` | Last Modified By column |
| `Show_File_Size__c` | `true` | File Size column |
| `Theme__c` | `cosmos` | Look of the Better Files React card and its View All list: Cosmos, Lightning Blue, or Better Files. Blank uses Cosmos |

The Title and Actions columns are always shown.

---

## File handling details

### Deduplication

- Files are deduplicated by **latest published ContentVersion**.
- File count reflects **unique files**, not ContentDocumentLink rows.

### Exclusions

- **Salesforce Notes** (`FileExtension = 'snote'`) are excluded from all queries.

### Extension detection & icons

- Doctype icons map common extensions to SLDS icons (Excel, Word, PDF, image, ZIP, code, etc.).
- Unknown extensions use `doctype:unknown`.

### Preview support

Previewable on the record card and via row actions:

`pdf`, `doc`, `docx`, `xlsx`, `ppt`, `pptx`, `jpg`, `jpeg`, `png`, `gif`, `bmp`, `txt`, `csv`

### Security

- Apex runs `with sharing`.
- Queries use Libra `asUser()` for CRUD/FLS enforcement.
- Deletes and uploads use `DatabaseService().asUser()`.
- Assign the **Better Files** permission set to grant access to `FileListController`.

---

## Apex API (`FileListController`)

| Method | Cacheable | Purpose |
|--------|-----------|---------|
| `getFiles` | Yes | Paginated file rows for a record |
| `getFileCount` | Yes | Unique file count for a record |
| `getRelatedListFiles` | No | Sorted, paginated unique files for View All; optional title search |
| `getRelatedListFileCount` | No | Unique count matching View All filters and search |
| `getRelatedListFileExtensions` | No | Unique eligible extensions for the whole record, independent of search and pagination |
| `getRelatedListConfig` | Yes | Column flags and filter mode from CMDT |
| `getTheme` | Yes | React components' theme from CMDT; Cosmos when blank |
| `searchContentVersions` | Yes | Legacy title search (up to 25 results) |
| `getRecordName` | Yes | Breadcrumb label for parent record |
| `uploadFile` | No | Base64 upload + link to record |
| `deleteFile` | No | Delete single ContentDocument |
| `deleteFiles` | No | Bulk delete ContentDocuments |

`fileTypeFilter` accepts `all`, `image`, `document`, or `extension:<lowercase extension>`. `extension:` selects files without an extension.

`FileRow` DTO fields: `version` (ContentVersion), `linkedEntityId`, `linkedEntityType`.

---

## Installation & permissions

### Install links

- [Production](https://login.salesforce.com/packaging/installPackage.apexp?p0=04tQl000000Tis5IAC)
- [Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04tQl000000Tis5IAC)

### Setup steps

1. Install the managed package.
2. Assign the **Better Files** permission set to users who need file management.
3. Add **Better Files** to record pages via Lightning App Builder.
4. (Optional) Edit **File Related List Config → Default** to tune View All columns, select **Basic** or **Advanced** filtering, or choose the React components' theme.

### Dependencies

- [Apex Libra](https://apexlibra.org/apex/) — Shared, Collections, Database, Query

---

## Architecture overview

```
Record Page                    View All (URL-addressable)
┌─────────────────┐           ┌──────────────────────────┐
│  fileList       │  View All │  fileRelatedList         │
│  ├─ fileCard    │ ────────► │  ├─ fileDataTable        │
│  └─ file-upload │           │  ├─ imagePreview (col)   │
└────────┬────────┘           │  └─ file-upload          │
         │                    └────────────┬─────────────┘
         │                                 │
         └──────────────┬──────────────────┘
                        ▼
              FileListController (Apex)
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
 ContentDocumentLink  ContentVersion  EmailMessage
 Query                Query           Query
                        │
                        ▼
         File_Related_List_Config__mdt (columns, filter mode, React theme)
```

---

## Known limitations

- **Record page** does not support file-type filter or search (View All only).
- **Per-user column preferences** are not supported; column config is org-wide via CMDT.
- **Deprecated App Builder column toggles** cannot be removed from `fileList` meta while referenced on existing Lightning pages in subscriber orgs.
- **Large file upload** is subject to Salesforce platform limits for `lightning-file-upload` and Apex heap/ payload size.
- **Basic** filtering has no “Other” category; non-image/non-document files appear only under **All files**. **Advanced** allows filtering by any extension present on the record.
