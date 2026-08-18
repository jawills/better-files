import { LightningElement, wire, track } from "lwc";
import getRelatedListFiles from "@salesforce/apex/FileListController.getRelatedListFiles";
import getRelatedListFileCount from "@salesforce/apex/FileListController.getRelatedListFileCount";
import deleteFile from "@salesforce/apex/FileListController.deleteFile";
import deleteFiles from "@salesforce/apex/FileListController.deleteFiles";
import getRecordName from "@salesforce/apex/FileListController.getRecordName";
import getRelatedListConfig from "@salesforce/apex/FileListController.getRelatedListConfig";
import searchContentVersions from "@salesforce/apex/FileListController.searchContentVersions";
import { NavigationMixin, CurrentPageReference } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { mapFile, getFileTypeFilterOptions } from "c/util";
import LightningConfirm from "lightning/confirm";
import fileRelatedListSkeleton from "./fileRelatedListSkeleton.html";
import fileRelatedList from "./fileRelatedList.html";

const ACTIONS = [
  { label: "Preview", name: "Preview" },
  { label: "Download", name: "Download" },
  { label: "Delete", name: "Delete" }
];

const DELAY = 350;
const PAGE_SIZE = 25;

export default class FileRelatedList extends NavigationMixin(LightningElement) {
  @track baseObjectUrl;
  @track baseObjectName;
  @track includeEmails = false;
  @track baseRecordId;
  @track searchTerm = "";
  @track fileTypeFilter = "all";
  @track relatedRecordName;
  @track relatedRecordUrl;
  @track selectedRecords = [];
  searchTermUpdated;
  contentDocumentIdSet = new Set();
  isLoading = true;
  showSkeleton = true;
  hasSelectedRecords = false;
  showFileUpload = true;
  fileCount = 0;
  cardTitle = "Files";
  totalFileCount = null;
  selectedText;
  selectedCount = 0;
  currentPage = 0;
  @track dataTableFiles = [];
  hasAdditionalFiles = false;
  lastPageResultCount = 0;
  loadRequestId = 0;
  @track minimumFileSizeBytes = null;
  showOwner = true;
  showLastModifiedDate = true;
  showLastModifiedBy = true;
  showFileSize = true;
  columns = [];
  tableLayoutKey = 0;
  layoutRemeasured = false;
  error;

  get tableMountKey() {
    return [{ id: this.tableLayoutKey }];
  }

  get loadErrorMessage() {
    const err = this.error;
    if (!err) {
      return null;
    }
    return err.body?.message || err.message || "Unable to load files.";
  }

  get showEmptyTableMessage() {
    return (
      !this.isLoading &&
      !this.loadErrorMessage &&
      Array.isArray(this.dataTableFiles) &&
      this.dataTableFiles.length === 0
    );
  }

  getStateValue(state, key) {
    const namespaced = state[`file1sync__${key}`];
    if (namespaced != null && namespaced !== "") {
      return namespaced;
    }
    const custom = state[`c__${key}`];
    if (custom != null && custom !== "") {
      return custom;
    }
    return undefined;
  }

  parseBoolFlag(value, defaultValue = true) {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }
    if (value === true || value === "true") {
      return true;
    }
    if (value === false || value === "false") {
      return false;
    }
    return defaultValue;
  }

  connectedCallback() {
    this.buildColumns();
  }

  renderedCallback() {
    if (this.showSkeleton || this.layoutRemeasured) {
      return;
    }
    this.layoutRemeasured = true;
    // Remount after flexipage layout settles so the datatable measures full width.
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    requestAnimationFrame(() => {
      this.tableLayoutKey += 1;
    });
  }

  @wire(getRelatedListConfig)
  wiredRelatedListConfig(result) {
    if (result.data) {
      this.showOwner = result.data.showOwner !== false;
      this.showLastModifiedDate = result.data.showLastModifiedDate !== false;
      this.showLastModifiedBy = result.data.showLastModifiedBy !== false;
      this.showFileSize = result.data.showFileSize !== false;
      this.buildColumns();
    } else if (result.error) {
      console.error("Error loading related list config:", result.error);
      this.buildColumns();
    }
  }

  get fileTypeOptions() {
    return getFileTypeFilterOptions();
  }

  resetFileListState() {
    this.currentPage = 0;
    this.contentDocumentIdSet = new Set();
    this.dataTableFiles = [];
    this.originalFiles = [];
    this.selectedRecords = [];
    this.hasSelectedRecords = false;
    this.showFileUpload = true;
    this.selectedCount = 0;
    this.hasAdditionalFiles = false;
    this.lastPageResultCount = 0;
    this.totalFileCount = null;
    this.isLoading = true;
    this.error = undefined;
  }

  handleFileTypeChange(event) {
    const nextFilter = event.detail.value;
    if (nextFilter === this.fileTypeFilter) {
      return;
    }
    this.fileTypeFilter = nextFilter;
    this.searchTerm = "";
    this.resetFileListState();
    void this.loadAllFileData();
  }

  render() {
    return this.showSkeleton ? fileRelatedListSkeleton : fileRelatedList;
  }

  buildColumns() {
    const cols = [
      {
        label: "Title",
        fieldName: "fileUrl",
        type: "imagePreview",
        typeAttributes: {
          Title: {
            fieldName: "Title"
          },
          ContentDocumentId: {
            fieldName: "ContentDocumentId"
          },
          ContentVersionId: {
            fieldName: "Id"
          },
          IconName: {
            fieldName: "icon"
          }
        },
        wrapText: true
      }
    ];
    if (this.showOwner) {
      cols.push({
        label: "Owner",
        fieldName: "OwnerLink",
        type: "url",
        typeAttributes: { label: { fieldName: "Owner" } }
      });
    }
    if (this.showLastModifiedDate) {
      cols.push({
        label: "Last Modified Date",
        fieldName: "LastModifiedDate",
        type: "date"
      });
    }
    if (this.showLastModifiedBy) {
      cols.push({
        label: "Last Modified By",
        fieldName: "LastModifiedByLink",
        type: "url",
        typeAttributes: { label: { fieldName: "LastModifiedBy" } }
      });
    }
    if (this.showFileSize) {
      cols.push({
        label: "File Size",
        fieldName: "ContentSize"
      });
    }
    cols.push({
      type: "action",
      typeAttributes: { rowActions: ACTIONS }
    });
    this.columns = cols;
  }

  kbFromStateToMinContentSizeBytes(kb) {
    if (kb == null || kb === "" || kb === false) {
      return null;
    }
    const n = Number(kb);
    if (Number.isNaN(n) || n <= 0) {
      return null;
    }
    return Math.floor(n * 1024);
  }

  getFilesQueryParams() {
    return {
      recordId: this.baseRecordId,
      fileLimit: PAGE_SIZE,
      page: this.currentPage,
      includeEmails: this.includeEmails,
      minContentSize: this.minimumFileSizeBytes,
      fileTypeFilter: this.fileTypeFilter
    };
  }

  getCountQueryParams() {
    return {
      recordId: this.baseRecordId,
      includeEmails: this.includeEmails,
      minContentSize: this.minimumFileSizeBytes,
      fileTypeFilter: this.fileTypeFilter
    };
  }

  applyFilesPage(data) {
    const mappedNewFiles = data.map((file) => mapFile(file));
    if (this.currentPage === 0) {
      this.contentDocumentIdSet = new Set();
    }
    const uniqueNewFiles = mappedNewFiles.filter((mappedFile) => {
      const isUnique = !this.contentDocumentIdSet.has(
        mappedFile.ContentDocumentId
      );
      if (isUnique) {
        this.contentDocumentIdSet.add(mappedFile.ContentDocumentId);
      }
      return isUnique;
    });
    this.lastPageResultCount = uniqueNewFiles.length;

    if (this.currentPage > 0 && this.lastPageResultCount === 0) {
      this.hasAdditionalFiles = false;
      this.originalHasAdditionalFiles = false;
      return;
    }

    this.dataTableFiles =
      this.currentPage === 0
        ? uniqueNewFiles
        : [...this.dataTableFiles, ...uniqueNewFiles];
    this.originalFiles = this.dataTableFiles;
    this.fileCount = this.dataTableFiles.length;
    this.error = undefined;
    this.getSelectedText();
    this.updateHasAdditionalFiles();
    this.showSkeleton = false;
  }

  async loadFilePage(requestId) {
    const data = await getRelatedListFiles(this.getFilesQueryParams());
    if (requestId !== this.loadRequestId) {
      return;
    }
    this.applyFilesPage(data);
  }

  async loadFileCount(requestId) {
    const count = await getRelatedListFileCount(this.getCountQueryParams());
    if (requestId !== this.loadRequestId) {
      return;
    }
    this.totalFileCount = count;
    this.cardTitle = `Files (${count})`;
    this.getSelectedText();
    this.updateHasAdditionalFiles();
  }

  async loadAllFileData() {
    if (!this.baseRecordId) {
      return;
    }

    const requestId = ++this.loadRequestId;
    this.currentPage = 0;
    this.contentDocumentIdSet = new Set();
    this.hasAdditionalFiles = false;
    this.lastPageResultCount = 0;
    this.isLoading = true;

    try {
      const [files, count] = await Promise.all([
        getRelatedListFiles({
          ...this.getFilesQueryParams(),
          page: 0
        }),
        getRelatedListFileCount(this.getCountQueryParams())
      ]);

      if (requestId !== this.loadRequestId) {
        return;
      }

      this.totalFileCount = count;
      this.cardTitle = `Files (${count})`;
      this.applyFilesPage(files);
    } catch (error) {
      if (requestId !== this.loadRequestId) {
        return;
      }
      this.error = error;
      console.error("Error loading files:", error);
      this.showSkeleton = false;
    } finally {
      if (requestId === this.loadRequestId) {
        this.isLoading = false;
        this.updateHasAdditionalFiles();
      }
    }
  }

  async loadNextPage() {
    if (!this.baseRecordId || !this.hasAdditionalFiles || this.isLoading) {
      return;
    }

    const requestId = ++this.loadRequestId;
    this.currentPage++;
    this.isLoading = true;

    try {
      await this.loadFilePage(requestId);
    } catch (error) {
      if (requestId !== this.loadRequestId) {
        return;
      }
      this.error = error;
      console.error("Error loading more files:", error);
    } finally {
      if (requestId === this.loadRequestId) {
        this.isLoading = false;
        this.updateHasAdditionalFiles();
      }
    }
  }

  refreshFileData() {
    return this.loadAllFileData();
  }

  @wire(CurrentPageReference)
  getCurrentPageReference(currentPageReference) {
    this.currentPageReference = currentPageReference;
    if (!this.currentPageReference) {
      return;
    }

    const state = this.currentPageReference.state || {};
    const nextRecordId = this.getStateValue(state, "recordId") || null;
    const nextMinBytes = this.kbFromStateToMinContentSizeBytes(
      this.getStateValue(state, "minimumFileSizeKb")
    );
    const nextIncludeEmails = this.parseBoolFlag(
      this.getStateValue(state, "includeEmails"),
      true
    );
    const nextFileTypeFilter =
      this.getStateValue(state, "fileTypeFilter") || "all";
    const contextChanged =
      nextRecordId !== this.baseRecordId ||
      nextMinBytes !== this.minimumFileSizeBytes ||
      nextIncludeEmails !== this.includeEmails ||
      nextFileTypeFilter !== this.fileTypeFilter;

    if (contextChanged) {
      this.resetFileListState();
    }

    this.baseRecordId = nextRecordId;
    this.minimumFileSizeBytes = nextMinBytes;
    this.baseObjectName = this.getStateValue(state, "objectName") || null;
    this.includeEmails = nextIncludeEmails;
    this.fileTypeFilter = nextFileTypeFilter;
    this.buildColumns();
    this.getBaseObjectUrl();

    if (nextRecordId) {
      void this.loadAllFileData();
    }

    getRecordName({
      recordId: nextRecordId,
      objectAPIName: this.baseObjectName
    })
      .then((data) => {
        this.relatedRecordName = data;
      })
      .catch((err) => {
        console.error(err);
      });
  }

  handleUploadFinished() {
    void this.refreshFileData();
  }

  getSelectedRecords(event) {
    this.selectedRecords = event.detail.selectedRows;
    this.hasSelectedRecords = this.selectedRecords.length > 0;
    this.showFileUpload = this.selectedRecords.length === 0;
    this.selectedCount = this.selectedRecords.length;
    this.getSelectedText();
  }

  handleRowAction(event) {
    const actionName = event.detail.action.name;
    const row = event.detail.row;
    switch (actionName) {
      case "Preview":
        this.previewFile(row);
        break;
      case "Download":
        this.downloadFile(row);
        break;
      case "Delete":
        this.deleteCurrentRecord(row);
        break;
      default:
    }
  }

  async handleSearchKeyChange(event) {
    clearTimeout(this.delayTimeout);
    this.searchTermUpdated = Date.now();
    const searchTermUpdated = this.searchTermUpdated;
    const searchValue = event.target.value;
    this.searchTerm = searchValue;

    if (this.searchTerm == "") {
      this.dataTableFiles = this.originalFiles;
      this.hasAdditionalFiles = this.originalHasAdditionalFiles;
      this.isLoading = false;
      return;
    }

    this.isLoading = true;

    this.delayTimeout = setTimeout(() => {
      searchContentVersions({
        searchTerm: this.searchTerm,
        recordId: this.baseRecordId,
        includeEmails: this.includeEmails,
        minContentSize: this.minimumFileSizeBytes,
        fileTypeFilter: this.fileTypeFilter
      })
        .then((result) => {
          if (this.searchTermUpdated > searchTermUpdated) {
            return;
          }
          this.dataTableFiles = result.map((record) => mapFile(record));
          this.fileCount = this.dataTableFiles.length;
          this.getSelectedText();
          this.hasAdditionalFiles =
            this.searchTerm == "" &&
            this.totalFileCount != null &&
            this.dataTableFiles.length < this.totalFileCount;
          this.isLoading = false;
        })
        .catch((error) => {
          console.error("Error searching content versions:", error);
          this.isLoading = false;
        });
    }, DELAY);
  }

  async deleteSelectedRecords() {
    this.isLoading = true;
    const records = this.selectedRecords;
    const result = await LightningConfirm.open({
      message: `Are you sure you wish do delete ${records.length} file${records.length === 1 ? "" : "s"}?`,
      variant: "header",
      label: "Delete Files?"
    });
    if (result === false) {
      this.isLoading = false;
      return;
    }
    deleteFiles({
      contentDocumentIds: records.map((record) => {
        return record.ContentDocumentId;
      })
    })
      .then((data) => {
        this.showToast("Success", "Files deleted", "success");
        this.selectedRecords = undefined;
        this.dataTableFiles = this.dataTableFiles.filter((file) => {
          return !data.includes(file.ContentDocumentId);
        });
        this.originalFiles = this.dataTableFiles;
        data.forEach((contentDocumentId) => {
          if (this.contentDocumentIdSet.has(contentDocumentId)) {
            this.contentDocumentIdSet.delete(contentDocumentId);
          }
        });
        return this.refreshFileData();
      })
      .catch((error) => {
        console.error(error);
        this.isLoading = false;
        this.showToast("Error deleting records", error?.body?.message, "error");
      });
    this.getSelectedText();
  }

  downloadSelectedRecords() {
    let attatchmentIds = "";
    for (const record of this.selectedRecords) {
      attatchmentIds += record.Id + "/";
    }

    if (attatchmentIds.length > 0) {
      attatchmentIds = attatchmentIds.replace(/.$/, "?");
    }

    this[NavigationMixin.Navigate](
      {
        type: "standard__webPage",
        attributes: {
          url: "/sfc/servlet.shepherd/version/download/" + attatchmentIds
        }
      },
      false
    );
  }

  showToast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }

  deleteCurrentRecord(row) {
    this.isLoading = true;
    deleteFile({ contentDocumentId: row.ContentDocumentId })
      .then(() => {
        this.showToast("Success", "File deleted", "success");
        this.dataTableFiles = this.dataTableFiles.filter((file) => {
          return row.ContentDocumentId !== file.ContentDocumentId;
        });
        this.originalFiles = this.dataTableFiles;
        if (this.contentDocumentIdSet.has(row.ContentDocumentId)) {
          this.contentDocumentIdSet.delete(row.ContentDocumentId);
        }
        return this.refreshFileData();
      })
      .catch((error) => {
        console.error(error);
        this.isLoading = false;
        this.showToast("Error deleting record", error?.body?.message, "error");
      });
  }

  downloadFile(file) {
    this[NavigationMixin.Navigate](
      {
        type: "standard__webPage",
        attributes: {
          url: file.downloadUrl
        }
      },
      false
    );
  }

  getBaseObjectUrl() {
    this[NavigationMixin.GenerateUrl]({
      type: "standard__objectPage",
      attributes: {
        objectApiName: this.baseObjectName,
        actionName: "home"
      }
    }).then((url) => {
      this.baseObjectUrl = url;
      this.relatedRecordUrl = url;
    });
  }

  viewRelatedRecord(event) {
    event.preventDefault();
    this[NavigationMixin.Navigate]({
      type: "standard__recordPage",
      attributes: {
        objectApiName: this.baseObjectName,
        recordId: this.baseRecordId,
        actionName: "view"
      }
    });
  }

  previewFile(file) {
    this[NavigationMixin.Navigate](
      {
        type: "standard__namedPage",
        attributes: {
          pageName: "filePreview"
        },
        state: {
          selectedRecordId: file.ContentDocumentId
        }
      },
      false
    );
  }

  getSelectedText() {
    this.selectedText =
      this.totalFileCount != null
        ? `${this.selectedCount} of ${this.totalFileCount} file(s) selected.`
        : `${this.selectedCount} file(s) selected.`;
  }

  updateHasAdditionalFiles() {
    const exhaustedPagination =
      this.currentPage > 0 && this.lastPageResultCount === 0;
    this.hasAdditionalFiles =
      !exhaustedPagination &&
      this.totalFileCount != null &&
      this.dataTableFiles.length > 0 &&
      this.dataTableFiles.length < this.totalFileCount;
    this.originalHasAdditionalFiles = this.hasAdditionalFiles;
  }

  getAdditionalFiles() {
    void this.loadNextPage();
  }
}
