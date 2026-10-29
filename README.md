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
3. (Optional) Configure View All columns and the React components' theme under **Setup → Custom Metadata Types → File Related List Config**.

## Dependencies

- [Apex Libra](https://apexlibra.org/apex/)
  - [Shared](https://apexlibra.org/apex/runtime)
  - [Collections](https://apexlibra.org/apex/collection)
  - [Database](https://apexlibra.org/apex/database-service)
  - [Query](https://apexlibra.org/apex/query)

## Development

The React implementation shares the main `force-app/` package with the original
components. See [the React implementation and development demo](react/README.md).

```bash
npm install
npm test
```

## Build and package

From the repository root:

```sh
npm ci
npm ci --prefix react
npm run build:salesforce
npm run scan
npm run version-create
```

`version-create` rebuilds the React UIBundle before creating a package version.
The main `force-app/` directory includes the UIBundle, CustomApplication, React
wrappers, upload service, and both permission sets. No temporary packaging
project is needed. Package creation does not install or promote the version.

`scan` builds the bundle, checks authored Salesforce and React source with
`Recommended` and `AppExchange`, then runs `uibundle` integrity and RetireJS
dependency checks on the compiled assets. It stages source beside the bundle in
a temporary directory and removes that copy afterwards. Reports are written to
`analyzer/`. High/critical findings, engine errors, or skipped integrity checks
fail the command and CI.

## React installation and upgrades

For package versions containing **Better Files React**, assign both **Better
Files** and **Better Files React** permission sets. After every installation or
upgrade, verify the installed bundle in the subscriber org:

```sh
sf data query --target-org subscriber-org --use-tooling-api \
  --query "SELECT Id, DeveloperName, NamespacePrefix, ManageableState, IsActive FROM UIBundle WHERE DeveloperName = 'betterFiles' AND NamespacePrefix = 'file1sync'"
```

Replace `subscriber-org` with the intended org alias. Expect exactly one row,
namespace `file1sync`, `ManageableState = installed` for the managed package, and
`IsActive = true`. A missing row or different installation state needs investigation
before proceeding.

[Salesforce's packaging guide](https://developer.salesforce.com/docs/platform/multiframework/guide/mfw-packaging.html)
notes that upgrades preserve `IsActive`. If the installed bundle is inactive,
activate it explicitly as a subscriber admin:

```sh
sf data update record --target-org subscriber-org --use-tooling-api \
  --sobject UIBundle \
  --where "DeveloperName='betterFiles' NamespacePrefix='file1sync'" \
  --values "IsActive=true"
```

Rerun the query and confirm `IsActive = true`. An already-active bundle needs no
toggle. Activation is an explicit subscriber action, separate from building or
creating a package version.

Open **Better Files** from the App Launcher to confirm the app loads, then open a
record with **Better Files React** and check the card, View All, and an upload as
an intended user. Repeat these checks after upgrades. The metadata's `<version>1</version>`
is its schema version, not the package release or an activation counter.
