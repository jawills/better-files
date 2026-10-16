# Better Files 2.1.0: Improved drag and drop functionality

The React file card and related list now use React Dropzone for drag-and-drop uploads and file selection. The existing layout, per-file validation messages, sequential upload queue, and upload status dialogs are preserved.

- Preserve the drop overlay when dragging across nested elements.
- Keep file selection on the Upload Files action, without opening the picker from other card actions.
- Allow selecting the same file again and prevent uploads after the upload surface unmounts during file extraction.

## Installation

Salesforce package version **2.1.0.1** follows **2.0.0.1**. Existing orgs are not upgraded automatically.

- [Install in production](https://login.salesforce.com/packaging/installPackage.apexp?p0=04tQl000000To33IAC)
- [Install in a sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04tQl000000To33IAC)
- Package version ID: `04tQl000000To33IAC`
- Package description: improved drag and drop functionality

## Validation

All **26 React tests** and both the local and Salesforce bundle builds passed, including TypeScript checks. The combined managed-package build passed full validation with **91% Apex coverage**. This refactor has not been installed or manually verified in a Salesforce org.
