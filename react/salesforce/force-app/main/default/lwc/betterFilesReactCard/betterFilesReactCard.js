import { LightningElement, api, wire } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { refreshApex } from "@salesforce/apex";
import {
  registerRefreshHandler,
  unregisterRefreshHandler
} from "lightning/refresh";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import getFileCount from "@salesforce/apex/FileListController.getFileCount";

function message(error) {
  return (
    error?.body?.message || error?.message || "Unable to load record files."
  );
}

/** Record-page host. Data and native navigation stay in Lightning. */
export default class BetterFilesReactCard extends NavigationMixin(
  LightningElement
) {
  _recordId;
  _objectApiName;
  options = {};
  filesResult;
  countResult;
  refreshRegistration;

  @api get recordId() {
    return this._recordId;
  }
  set recordId(value) {
    if (value === this._recordId) return;
    // Stop the old record's queued uploads and dialogs before switching context.
    this.filesResult = undefined;
    this.countResult = undefined;
    this._recordId = value || undefined;
  }

  @api get objectApiName() {
    return this._objectApiName;
  }
  set objectApiName(value) {
    this._objectApiName = value;
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
  }

  get hasRecord() {
    return Boolean(this.recordId);
  }
  get showMissingRecord() {
    return !this.hasRecord;
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
  }

  @wire(getFileCount, {
    recordId: "$recordId",
    includeEmails: "$wiredIncludeEmails",
    minContentSize: "$minContentSize",
    fileTypeFilter: "all"
  })
  handleCount(result) {
    this.countResult = result;
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
        rows: this.filesResult.data,
        total: this.countResult.data
      };
    }
    const settings = {
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
      upload: { refresh: () => this.refreshFiles() },
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
            attributes: {
              componentName: "file1sync__betterFilesReactRelatedList"
            },
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

  disconnectedCallback() {
    unregisterRefreshHandler(this.refreshRegistration);
    this.refreshRegistration = undefined;
  }
}
