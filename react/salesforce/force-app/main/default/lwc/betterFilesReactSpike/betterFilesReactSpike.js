import { LightningElement, wire } from "lwc";
import { CurrentPageReference, NavigationMixin } from "lightning/navigation";
import { loadScript, loadStyle } from "lightning/platformResourceLoader";
import { refreshApex } from "@salesforce/apex";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import getFileCount from "@salesforce/apex/FileListController.getFileCount";
import uploadFile from "@salesforce/apex/BetterFilesReactUpload.uploadFile";
import reactFiles from "@salesforce/resourceUrl/betterFilesReact";

/** Development host: URL record context enables real file reads and native preview. */
export default class BetterFilesReactSpike extends NavigationMixin(
  LightningElement
) {
  scenario = "Populated";
  errorMessage;
  isLoading = true;
  mounted = false;
  wantsMounted = true;
  loading;
  library;
  instances = [];
  recordId;
  objectApiName = "Account";
  filesResult;
  countResult;
  scenarios = [
    "Populated",
    "Empty",
    "Loading",
    "Error",
    "Long filenames",
    "Missing thumbnails"
  ].map((value) => ({ label: value, value }));

  get isFixture() {
    return !this.recordId;
  }
  get description() {
    return this.isFixture
      ? "Fixture data only. No live file reads, uploads, or deletes."
      : "Files from the selected record. Click a file to open Salesforce preview.";
  }
  get toggleLabel() {
    return this.mounted ? "Unmount cards" : "Mount cards";
  }

  @wire(CurrentPageReference)
  setPageReference(pageReference) {
    const state = pageReference?.state ?? {};
    const recordId =
      state.file1sync__recordId || state.c__recordId || undefined;
    const objectApiName =
      state.file1sync__objectName || state.c__objectName || "Account";
    if (recordId === this.recordId && objectApiName === this.objectApiName)
      return;
    this.unmountCards();
    if (recordId !== this.recordId) {
      this.filesResult = undefined;
      this.countResult = undefined;
    }
    this.recordId = recordId;
    this.objectApiName = objectApiName;
  }

  @wire(getFiles, {
    recordId: "$recordId",
    fileLimit: 6,
    page: 0,
    includeEmails: true,
    minContentSize: null,
    fileTypeFilter: "all"
  })
  handleFiles(result) {
    this.filesResult = result;
    this.updateCards();
  }

  @wire(getFileCount, {
    recordId: "$recordId",
    includeEmails: true,
    minContentSize: null,
    fileTypeFilter: "all"
  })
  handleCount(result) {
    this.countResult = result;
    this.updateCards();
  }

  get liveProps() {
    const error = this.filesResult?.error || this.countResult?.error;
    let state = { status: "loading" };
    if (error) {
      state = {
        status: "error",
        message:
          error.body?.message || error.message || "Unable to load record files."
      };
    } else if (
      this.filesResult?.data &&
      typeof this.countResult?.data === "number"
    ) {
      state = {
        status: "ready",
        files: this.filesResult.data.map(this.library.fromSalesforceFile),
        total: this.countResult.data
      };
    }
    return {
      context: { recordId: this.recordId, objectApiName: this.objectApiName },
      settings: this.library.defaultSettings,
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
                "The upload was not confirmed. Refresh files before trying again."
              );
          } catch (error) {
            throw new Error(
              error.body?.message ||
                error.message ||
                "Upload failed. Refresh files before trying again."
            );
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
        viewAll: () =>
          this[NavigationMixin.Navigate]({
            type: "standard__component",
            attributes: { componentName: "file1sync__fileRelatedList" },
            state: {
              file1sync__recordId: this.recordId,
              file1sync__objectName: this.objectApiName,
              file1sync__includeEmails: "true",
              file1sync__minimumFileSizeKb: ""
            }
          }),
        requestUpload: () => {},
        retry: () => this.refreshFiles()
      }
    };
  }

  async refreshFiles() {
    try {
      await Promise.all(
        [this.filesResult, this.countResult]
          .filter(Boolean)
          .map((result) => refreshApex(result))
      );
    } catch (error) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Unable to refresh files",
          message: error.body?.message || error.message,
          variant: "error"
        })
      );
    }
  }

  connectedCallback() {
    if (this.library && this.wantsMounted) this.mountCards();
  }

  renderedCallback() {
    if (this.library) {
      if (this.wantsMounted && !this.mounted) this.mountCards();
      return;
    }
    if (this.loading || this.errorMessage) return;
    this.loading = Promise.all([
      loadScript(this, reactFiles + "/better-files.js"),
      loadStyle(this, reactFiles + "/better-files.css")
    ])
      .then(() => {
        this.library = window.BetterFilesReact;
        if (!this.library?.mountFiles || !this.library?.fromSalesforceFile)
          throw new Error(
            "React resource did not expose the file card adapter."
          );
        if (this.isConnected) this.mountCards();
      })
      .catch((error) => {
        this.errorMessage =
          error?.message || "Unable to load the React component.";
      })
      .finally(() => {
        this.isLoading = false;
        this.loading = null;
      });
  }

  mountCards() {
    if (this.mounted || !this.library) return;
    const containers = Array.from(
      this.template.querySelectorAll("[data-card]")
    );
    if (!containers.length) return;
    this.instances = containers.map((element) =>
      this.isFixture
        ? this.library.mountFixture(element, {
            scenario: this.scenario,
            label: element.dataset.card
          })
        : this.library.mountFiles(element, this.liveProps)
    );
    this.mounted = true;
  }

  updateCards() {
    if (!this.mounted) return;
    const props = this.isFixture ? { scenario: this.scenario } : this.liveProps;
    this.instances.forEach((instance) => instance.update(props));
  }

  unmountCards() {
    this.instances.forEach((instance) => instance.unmount());
    this.instances = [];
    this.mounted = false;
  }

  toggleMount() {
    this.wantsMounted = !this.mounted;
    if (this.mounted) this.unmountCards();
    else this.mountCards();
  }

  handleScenario(event) {
    this.scenario = event.detail.value;
    this.updateCards();
  }
  disconnectedCallback() {
    this.unmountCards();
  }
}
