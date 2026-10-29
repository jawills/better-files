# Better Files 2.2.0: Salesforce themes

The React file card and related list now come in Salesforce's Cosmos and Lightning Blue themes, chosen org-wide in custom metadata. Cosmos is the default, and the original Better Files look remains available.

- Choose **Cosmos**, **Lightning Blue**, or **Better Files** with **Theme** under **Setup → Custom Metadata Types → File Related List Config → Manage Records → Default**. A blank value uses Cosmos.
- The theme applies to the record card, View All, and their dialogs, menus, and toasts.
- The React components' styles were rebuilt with Tailwind utilities.
- The themes come from [Wisty UI](https://ui.wisty.ai), which is MIT-licensed. Their values are Salesforce's, under the Terms of Use in `react/src/styles/wisty/THIRD_PARTY_NOTICES.md`.

## Upgrade notes

- Existing orgs switch to Cosmos when they upgrade. To keep the previous look, set Theme to **Better Files**.
- Upgrades may not add Theme to an existing org's File Related List Config page layout. If the field is missing from the Default record, add it to the layout.

## Installation

Salesforce package version **2.2.0.1** follows **2.1.0.1**. Existing orgs are not upgraded automatically.

- [Install in production](https://login.salesforce.com/packaging/installPackage.apexp?p0=04tQl000000U261IAC)
- [Install in a sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04tQl000000U261IAC)
- Package version ID: `04tQl000000U261IAC`
- Package description: Salesforce Cosmos and Lightning Blue themes for the React card and View All list, chosen in File Related List Config (Cosmos by default)

## Validation

All **27 React tests** and **80 LWC tests** passed, along with TypeScript checks and the Salesforce bundle build. `npm run scan` reported no critical or high findings. The managed-package build passed full validation with **91% Apex coverage**, and version 2.2.0.1 is promoted. This version has not been installed or manually verified in a Salesforce org.
