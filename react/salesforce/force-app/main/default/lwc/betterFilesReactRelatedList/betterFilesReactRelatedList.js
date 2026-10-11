import { LightningElement, wire } from "lwc";
import { NavigationMixin, CurrentPageReference } from "lightning/navigation";
import { loadScript, loadStyle } from "lightning/platformResourceLoader";
import {
  registerRefreshHandler,
  unregisterRefreshHandler
} from "lightning/refresh";
import getFiles from "@salesforce/apex/FileListController.getRelatedListFiles";
import getCount from "@salesforce/apex/FileListController.getRelatedListFileCount";
import getExtensions from "@salesforce/apex/FileListController.getRelatedListFileExtensions";
import getConfig from "@salesforce/apex/FileListController.getRelatedListConfig";
import getRecordName from "@salesforce/apex/FileListController.getRecordName";
import deleteFiles from "@salesforce/apex/FileListController.deleteFiles";
import uploadFile from "@salesforce/apex/BetterFilesReactUpload.uploadFile";
import {
  IsConsoleNavigation,
  EnclosingTabId,
  setTabLabel,
  setTabIcon
} from "lightning/platformWorkspaceApi";
import reactFiles from "@salesforce/resourceUrl/betterFilesReact";

const message = (error) =>
  error?.body?.message || error?.message || "Unable to load files.";
const stateValue = (state, key) =>
  state[`file1sync__${key}`] || state[`c__${key}`];

/** URL-addressable host; all data access stays in Salesforce's user-mode controller. */
export default class BetterFilesReactRelatedList extends NavigationMixin(
  LightningElement
) {
  context;
  library;
  instance;
  loading;
  props;
  resourceError;
  isLoadingLibrary = true;
  refreshRegistration;
  revision = 0;
  recordName = "";
  isConsoleNavigation;
  enclosingTabId;
  previousTitle;
  appliedTitle;

  @wire(IsConsoleNavigation)
  navigationMode(value) {
    this.isConsoleNavigation = typeof value === "boolean" ? value : value?.data;
    this.updateTabIdentity();
  }

  @wire(EnclosingTabId)
  enclosingTab(value) {
    this.enclosingTabId = typeof value === "string" ? value : value?.data;
    this.updateTabIdentity();
  }

  updateTabIdentity() {
    if (!this.isConnected || !this.context?.recordId) return;
    const label = this.recordName ? `${this.recordName} · Files` : "Files";
    if (this.isConsoleNavigation === true && this.enclosingTabId) {
      // Use this component's tab, even if the user focused another tab while loading.
      Promise.all([
        setTabLabel(this.enclosingTabId, label),
        setTabIcon(this.enclosingTabId, "standard:file", { iconAlt: "Files" })
      ]).catch((error) =>
        console.warn("Unable to name the Files tab", message(error))
      );
    } else if (this.isConsoleNavigation === false) {
      this.previousTitle ??= document.title;
      this.appliedTitle = `${label} | Salesforce`;
      document.title = this.appliedTitle;
    }
  }

  @wire(CurrentPageReference)
  pageReference(reference) {
    if (!reference) return;
    const state = reference.state || {};
    const size = Number(stateValue(state, "minimumFileSizeKb"));
    const context = {
      recordId: stateValue(state, "recordId"),
      objectApiName: stateValue(state, "objectName") || "",
      includeEmails: stateValue(state, "includeEmails") !== "false",
      minimumFileSizeKb:
        Number.isFinite(size) && size > 0
          ? Math.min(size, 2147483647 / 1024)
          : 0,
      fileTypeFilter: stateValue(state, "fileTypeFilter") || "all"
    };
    if (JSON.stringify(context) === JSON.stringify(this.context)) return;
    this.unmount();
    this.context = context;
    this.recordName = "";
    this.updateTabIdentity();
    this.props = undefined;
    this.mount();
  }
  get showMissingRecord() {
    return (
      !this.context?.recordId && !this.isLoadingLibrary && !this.resourceError
    );
  }
  connectedCallback() {
    this.refreshRegistration = registerRefreshHandler(this, async () => {
      if (this.instance)
        this.instance.update({ ...this.props, revision: ++this.revision });
      return true;
    });
  }
  renderedCallback() {
    if (this.library) {
      this.mount();
      return;
    }
    if (this.loading || this.resourceError) return;
    this.loading = Promise.all([
      loadScript(this, reactFiles + "/better-files.js"),
      loadStyle(this, reactFiles + "/better-files.css")
    ])
      .then(() => {
        this.library = window.BetterFilesReact;
        if (!this.library?.mountRelatedList)
          throw new Error("Unable to initialize the related list.");
        this.mount();
      })
      .catch((error) => {
        this.library = undefined;
        this.resourceError = message(error);
      })
      .finally(() => {
        this.loading = undefined;
        this.isLoadingLibrary = false;
      });
  }
  retryResource() {
    this.resourceError = undefined;
    this.isLoadingLibrary = true;
  }
  mount() {
    if (
      !this.isConnected ||
      !this.library ||
      !this.context?.recordId ||
      this.instance
    )
      return;
    const container = this.template.querySelector("[data-card]");
    if (!container) return;
    const context = { ...this.context };
    const library = this.library;
    const scope = {
      recordId: context.recordId,
      includeEmails: context.includeEmails,
      minContentSize: context.minimumFileSizeKb
        ? Math.floor(context.minimumFileSizeKb * 1024)
        : null
    };
    const safe = async (operation) => {
      try {
        return await operation();
      } catch (error) {
        throw new Error(message(error));
      }
    };
    this.props = {
      context: {
        recordId: context.recordId,
        objectApiName: context.objectApiName
      },
      settings: {
        ...library.defaultSettings,
        includeEmails: context.includeEmails,
        minimumFileSizeKb: context.minimumFileSizeKb
      },
      initialFilter: context.fileTypeFilter,
      adapter: {
        info: () =>
          safe(async () => {
            const [config, recordName] = await Promise.all([
              getConfig(),
              getRecordName({
                recordId: context.recordId,
                objectAPIName: context.objectApiName
              })
            ]);
            if (
              this.isConnected &&
              this.context?.recordId === context.recordId
            ) {
              this.recordName = recordName;
              this.updateTabIdentity();
            }
            const extensions =
              config.filterMode === "Advanced"
                ? await getExtensions(scope)
                : [];
            return { config, recordName, extensions };
          }),
        load: (query) =>
          safe(async () => {
            const { page, sortBy, sortDirection, ...filters } = query;
            const [rows, total] = await Promise.all([
              getFiles({
                ...scope,
                ...filters,
                page,
                sortBy,
                sortDirection,
                fileLimit: 25
              }),
              getCount({ ...scope, ...filters })
            ]);
            return {
              files: rows.map(library.fromSalesforceRelatedFile),
              total
            };
          }),
        delete: (files) =>
          safe(async () => {
            const ids = files.map((file) => file.documentId);
            const deleted = await deleteFiles({ contentDocumentIds: ids });
            if (!deleted || !ids.every((id) => deleted.includes(id)))
              throw new Error(
                "Deletion not confirmed. Refresh the list before trying again."
              );
          }),
        upload: (file, record) =>
          safe(async () => {
            const id = await uploadFile({
              filename: file.name,
              base64: await library.fileToBase64(file),
              recordId: record.recordId
            });
            if (!id)
              throw new Error(
                "Upload not confirmed. Refresh the list before trying again."
              );
          })
      },
      actions: {
        preview: (file) =>
          this[NavigationMixin.Navigate]({
            type: "standard__namedPage",
            attributes: { pageName: "filePreview" },
            state: { selectedRecordId: file.documentId }
          }),
        download: (files) =>
          this[NavigationMixin.Navigate]({
            type: "standard__webPage",
            attributes: {
              url:
                files.length === 1
                  ? `/sfc/servlet.shepherd/document/download/${files[0].documentId}`
                  : `/sfc/servlet.shepherd/version/download/${files.map((file) => file.versionId).join("/")}?`
            }
          }),
        record: () =>
          this[NavigationMixin.Navigate]({
            type: "standard__recordPage",
            attributes: {
              recordId: context.recordId,
              objectApiName: context.objectApiName,
              actionName: "view"
            }
          }),
        object: () =>
          this[NavigationMixin.Navigate]({
            type: "standard__objectPage",
            attributes: {
              objectApiName: context.objectApiName,
              actionName: "list"
            }
          })
      }
    };
    this.instance = library.mountRelatedList(container, this.props);
  }
  unmount() {
    this.instance?.unmount();
    this.instance = undefined;
  }
  disconnectedCallback() {
    this.unmount();
    if (this.appliedTitle && document.title === this.appliedTitle) {
      document.title = this.previousTitle ?? "Salesforce";
    }
    this.previousTitle = undefined;
    this.appliedTitle = undefined;
    unregisterRefreshHandler(this.refreshRegistration);
  }
}
