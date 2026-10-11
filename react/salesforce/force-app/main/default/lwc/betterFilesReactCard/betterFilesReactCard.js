import { LightningElement, api, wire } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { loadScript, loadStyle } from "lightning/platformResourceLoader";
import { refreshApex } from "@salesforce/apex";
import {
  registerRefreshHandler,
  unregisterRefreshHandler
} from "lightning/refresh";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import getFileCount from "@salesforce/apex/FileListController.getFileCount";
import uploadFile from "@salesforce/apex/BetterFilesReactUpload.uploadFile";
import reactFiles from "@salesforce/resourceUrl/betterFilesReact";

function message(error) {
  return (
    error?.body?.message || error?.message || "Unable to load record files."
  );
}

/** Record-page host. React owns only the DOM inside data-card. */
export default class BetterFilesReactCard extends NavigationMixin(
  LightningElement
) {
  _recordId;
  _objectApiName;
  options = {};
  library;
  instance;
  loading;
  resourceError;
  isLoadingLibrary = true;
  filesResult;
  countResult;
  refreshRegistration;

  @api get recordId() {
    return this._recordId;
  }
  set recordId(value) {
    if (value === this._recordId) return;
    // Stop the old record's queued uploads and dialogs before switching context.
    this.unmountCard();
    this.filesResult = undefined;
    this.countResult = undefined;
    this._recordId = value || undefined;
    this.mountCard();
  }

  @api get objectApiName() {
    return this._objectApiName;
  }
  set objectApiName(value) {
    this._objectApiName = value;
    this.updateCard();
  }

  @api get accept() {
    return this.options.accept;
  }
  set accept(value) {
    this.setOption("accept", value);
  }
  @api get multiple() {
    return this.options.multiple;
  }
  set multiple(value) {
    this.setOption("multiple", value);
  }
  @api get filePreview() {
    return this.options.filePreview;
  }
  set filePreview(value) {
    this.setOption("filePreview", value);
  }
  @api get filesPerRow() {
    return this.options.filesPerRow;
  }
  set filesPerRow(value) {
    this.setOption("filesPerRow", value);
  }
  @api get fileLimit() {
    return this.options.fileLimit;
  }
  set fileLimit(value) {
    this.setOption("fileLimit", value, true);
  }
  @api get includeEmails() {
    return this.options.includeEmails;
  }
  set includeEmails(value) {
    this.setOption("includeEmails", value, true);
  }
  @api get minimumFileSizeKb() {
    return this.options.minimumFileSizeKb;
  }
  set minimumFileSizeKb(value) {
    this.setOption("minimumFileSizeKb", value, true);
  }

  setOption(name, value, changesQuery = false) {
    if (value === this.options[name]) return;
    const previousLimit = this.wiredFileLimit;
    const previousEmails = this.wiredIncludeEmails;
    const previousSize = this.minContentSize;
    this.options = { ...this.options, [name]: value };
    const filtersChanged =
      changesQuery &&
      (previousEmails !== this.wiredIncludeEmails ||
        previousSize !== this.minContentSize);
    if (filtersChanged || previousLimit !== this.wiredFileLimit) {
      this.filesResult = undefined;
    }
    if (filtersChanged) {
      this.countResult = undefined;
    }
    this.updateCard();
  }

  get hasRecord() {
    return Boolean(this.recordId);
  }
  get showMissingRecord() {
    return !this.hasRecord && !this.isLoadingLibrary && !this.resourceError;
  }
  get wiredFileLimit() {
    const value = Number(this.fileLimit);
    return Number.isInteger(value) && value > 0 ? Math.min(value, 100) : 6;
  }
  get wiredIncludeEmails() {
    return this.includeEmails !== false;
  }
  get minContentSize() {
    const value = Number(this.minimumFileSizeKb);
    return Number.isFinite(value) && value > 0
      ? Math.min(Math.floor(value * 1024), 2147483647)
      : null;
  }

  @wire(getFiles, {
    recordId: "$recordId",
    fileLimit: "$wiredFileLimit",
    page: 0,
    includeEmails: "$wiredIncludeEmails",
    minContentSize: "$minContentSize",
    fileTypeFilter: "all"
  })
  handleFiles(result) {
    this.filesResult = result;
    this.updateCard();
  }

  @wire(getFileCount, {
    recordId: "$recordId",
    includeEmails: "$wiredIncludeEmails",
    minContentSize: "$minContentSize",
    fileTypeFilter: "all"
  })
  handleCount(result) {
    this.countResult = result;
    this.updateCard();
  }

  get cardProps() {
    const error = this.filesResult?.error || this.countResult?.error;
    let state = { status: "loading" };
    if (error) state = { status: "error", message: message(error) };
    else if (
      this.filesResult?.data &&
      typeof this.countResult?.data === "number"
    ) {
      state = {
        status: "ready",
        files: this.filesResult.data.map(this.library.fromSalesforceFile),
        total: this.countResult.data
      };
    }
    const settings = {
      ...this.library.defaultSettings,
      ...Object.fromEntries(
        Object.entries(this.options).filter(([, value]) => value != null)
      ),
      fileLimit: this.wiredFileLimit,
      includeEmails: this.wiredIncludeEmails,
      minimumFileSizeKb: (this.minContentSize ?? 0) / 1024
    };
    return {
      context: {
        recordId: this.recordId,
        objectApiName: this.objectApiName || ""
      },
      settings,
      state,
      upload: {
        send: async (file, context) => {
          try {
            const versionId = await uploadFile({
              filename: file.name,
              base64: await this.library.fileToBase64(file),
              recordId: context.recordId
            });
            if (!versionId)
              throw new Error(
                "Upload not confirmed. Refresh files before trying again."
              );
          } catch (error) {
            throw new Error(message(error));
          }
        },
        refresh: () => this.refreshFiles()
      },
      actions: {
        preview: (file) =>
          this[NavigationMixin.Navigate]({
            type: "standard__namedPage",
            attributes: { pageName: "filePreview" },
            state: { selectedRecordId: file.documentId }
          }),
        viewAll: (context, currentSettings) =>
          this[NavigationMixin.Navigate]({
            type: "standard__component",
            attributes: { componentName: "file1sync__fileRelatedList" },
            state: {
              file1sync__recordId: context.recordId,
              file1sync__objectName: context.objectApiName,
              file1sync__includeEmails: String(currentSettings.includeEmails),
              file1sync__minimumFileSizeKb: String(
                currentSettings.minimumFileSizeKb || ""
              )
            }
          }),
        requestUpload: () => {},
        retry: () => this.handleRefresh()
      }
    };
  }

  async refreshFiles() {
    await Promise.all(
      [this.filesResult, this.countResult].filter(Boolean).map(refreshApex)
    );
  }

  async handleRefresh() {
    try {
      await this.refreshFiles();
      return true;
    } catch (error) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Unable to refresh files",
          message: message(error),
          variant: "error"
        })
      );
      return false;
    }
  }

  connectedCallback() {
    this.refreshRegistration = registerRefreshHandler(
      this,
      this.handleRefresh.bind(this)
    );
  }

  renderedCallback() {
    if (this.library) {
      this.mountCard();
      return;
    }
    if (this.loading || this.resourceError) return;
    this.loading = Promise.all([
      loadScript(this, reactFiles + "/better-files.js"),
      loadStyle(this, reactFiles + "/better-files.css")
    ])
      .then(() => {
        this.library = window.BetterFilesReact;
        if (!this.library?.mountFiles || !this.library?.fromSalesforceFile)
          throw new Error("Unable to initialize the file card.");
        this.mountCard();
      })
      .catch((error) => {
        this.library = undefined;
        this.resourceError = message(error);
      })
      .finally(() => {
        this.isLoadingLibrary = false;
        this.loading = undefined;
      });
  }

  retryResource() {
    this.resourceError = undefined;
    this.isLoadingLibrary = true;
  }

  mountCard() {
    if (!this.isConnected || !this.recordId || !this.library || this.instance)
      return;
    const container = this.template.querySelector("[data-card]");
    if (container)
      this.instance = this.library.mountFiles(container, this.cardProps);
  }

  updateCard() {
    if (this.instance) this.instance.update(this.cardProps);
  }

  unmountCard() {
    this.instance?.unmount();
    this.instance = undefined;
  }

  disconnectedCallback() {
    this.unmountCard();
    unregisterRefreshHandler(this.refreshRegistration);
    this.refreshRegistration = undefined;
  }
}
