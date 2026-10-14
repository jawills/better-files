# Better Files 2.0.0: React Release

Better Files 2.0 adds a React file card and full related list inside Salesforce, while keeping the original Lightning components available.

- Add **Better Files React** to a record page in Lightning App Builder.
- Drag and drop files with upload progress, status dialogs, and success or failure toasts. The embedded upload transport supports files up to 100 MiB without sending file contents through Apex.
- Search, sort, filter, and page through the related list. Preview, download, and delete files using Salesforce permissions.
- Open **View All** in a separate tab named for the record.
- Discover the installed React app URL automatically. No manual React URL setting is required, and the legacy packaged Trusted URL remains removed.
- Support both Lightning Locker and Lightning Web Security, including RefreshView registration, component connection checks, and tab naming.

## Setup and upgrade

Assign **Better Files** and **Better Files React** to intended users, ensure they have the required API access, and add the React card to the desired record page. File visibility and actions remain subject to Salesforce object, field, and record permissions.

This version uses the existing **Better Files By 1Sync** managed package and follows version **1.21.0.1**. Building it does not promote it or upgrade installed orgs.

## Validation scope

The card and related list were verified in a disposable scratch org with both Locker and LWS. Managed-package installation and upgrade behavior, restricted-user access, and mobile use still need launch validation. Org-specific CSP policies can require an administrator to allow the discovered app origin.
