# Better Files By 1Sync

A better way to manage files on Salesforce record pages — compact card view, native preview, email attachments, and a full **View All** related list with search, filters, and bulk actions.

## Features at a glance

- **Record-page file card** — thumbnail grid, file count, drag-and-drop upload
- **View All related list** — data table with Owner, dates, size, preview, download, delete
- **Bulk download & delete** on View All
- **Search by file name** (View All)
- **File type filter** — Basic categories or Advanced record-specific extensions, configured in custom metadata (View All)
- **Email message attachments** — optionally include files from related emails
- **Minimum file size** filter
- **Service Console** — View All opens in a subtab
- **Configurable columns** — org-wide via Custom Metadata
- **Responsive layout** — adapts to narrow record page regions

See **[docs/FEATURES.md](docs/FEATURES.md)** for full documentation: configuration, deprecated settings, Apex API, and architecture.

## Install

- [Production](https://login.salesforce.com/packaging/installPackage.apexp?p0=04tQl000000Tis5IAC)
- [Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04tQl000000Tis5IAC)

After install:

1. Assign the **Better Files** permission set.
2. Add the **Better Files** component to record pages in App Builder.
3. (Optional) Configure View All columns under **Setup → Custom Metadata Types → File Related List Config**.

## Dependencies

- [Apex Libra](https://apexlibra.org/apex/)
  - [Shared](https://apexlibra.org/apex/runtime)
  - [Collections](https://apexlibra.org/apex/collection)
  - [Database](https://apexlibra.org/apex/database-service)
  - [Query](https://apexlibra.org/apex/query)

## Development

The React replacement is being built in reviewable milestones. See
[the React implementation and development demo](react/README.md).

```bash
npm install
npm test
```
