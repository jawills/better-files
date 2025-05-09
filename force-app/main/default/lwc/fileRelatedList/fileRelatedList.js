import { LightningElement, wire, track } from "lwc";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import getFileCount from "@salesforce/apex/FileListController.getFileCount";
import deleteFile from "@salesforce/apex/FileListController.deleteFile";
import deleteFiles from "@salesforce/apex/FileListController.deleteFiles";
import getRecordName from "@salesforce/apex/FileListController.getRecordName";
import searchContentVersions from "@salesforce/apex/FileListController.searchContentVersions";
import { NavigationMixin, CurrentPageReference } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { refreshApex } from "@salesforce/apex";
import { mapFile } from "c/util";
import LightningConfirm from "lightning/confirm";
import fileRelatedListSkeleton from "./fileRelatedListSkeleton.html";
import fileRelatedList from "./fileRelatedList.html";

//@todo make dynamic
const ACTIONS = [
  { label: "Preview", name: "Preview" },
  { label: "Download", name: "Download" },
  { label: "Delete", name: "Delete" }
];

const DELAY = 350; // Debounce delay in milliseconds

export default class FileRelatedList extends NavigationMixin(LightningElement) {
  @track baseObjectUrl;
  @track baseObjectName;
  @track baseRecordId;
  @track searchTerm = "";
  @track relatedRecordName;
  @track relatedRecordUrl;
  @track selectedRecords = [];
  searchTermUpdated;
  // Unique set of Content Document Ids to filter main set
  contentDocumentIdSet = new Set();
  isLoading = true;
  showSkeleton = true;
  hasSelectedRecords = false;
  showFileUpload = true;
  fileCount = 0;
  cardTitle = "Files";
  wiredFiles;
  @track wiredFileCount;
  selectedText;
  selectedCount = 0;
  currentPage = 0;
  @track dataTableFiles = [];
  hasAdditionalFiles = false;

  render() {
    // return fileRelatedListSkeleton;
    return this.showSkeleton ? fileRelatedListSkeleton : fileRelatedList;
  }
  @wire(CurrentPageReference)
  getCurrentPageReference(currentPageReference) {
    this.currentPageReference = currentPageReference;
    new Promise((resolve, reject) => {
      if (this.currentPageReference) {
        this.baseRecordId = this.currentPageReference.state.c__recordId
          ? this.currentPageReference.state.c__recordId
          : null;
        this.baseObjectName = this.currentPageReference.state.c__objectName
          ? this.currentPageReference.state.c__objectName
          : null;
        this.getBaseObjectUrl();
        getRecordName({
          recordId: this.baseRecordId,
          objectAPIName: this.baseObjectName
        })
          .then((data) => {
            this.relatedRecordName = data;
          })
          .catch((err) => {
            console.error(err);
            reject(err);
          });
        resolve();
      }
    }).catch((error) => {
      console.error(JSON.stringify(error));
    });
  }
  @wire(getFiles, {
    recordId: "$baseRecordId",
    fileLimit: 25,
    page: "$currentPage"
  })
  getWiredFiles(result) {
    this.wiredFiles = result;
    this.isLoading = true;
    if (result.data) {
      const uniqueNewFiles = result.data
        .map((file) => mapFile(file))
        .filter((mappedFile) => {
          const isUnique = !this.contentDocumentIdSet.has(
            mappedFile.ContentDocumentId
          );
          if (isUnique) {
            this.contentDocumentIdSet.add(mappedFile.ContentDocumentId);
          }
          return isUnique;
        });
      this.dataTableFiles = [...this.dataTableFiles, ...uniqueNewFiles];
      this.originalFiles = this.dataTableFiles;
      this.fileCount = this.dataTableFiles.length;
      this.isLoading = false;
      this.error = undefined;
      this.getSelectedText();
      this.hasAdditionalFiles =
        this.dataTableFiles.length < this.wiredFileCount.data;
      this.originalHasAdditionalFiles = this.hasAdditionalFiles;
      this.showSkeleton = false;
    } else if (result.error) {
      this.error = result.error;
      console.error("Error loading files:", result.error); // Log the error
    }
  }

  columns = [
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
    },
    {
      label: "Last Modified Date",
      fieldName: "LastModifiedDate",
      type: "date"
    },
    {
      label: "Last Modified By",
      fieldName: "LastModifiedByLink",
      type: "url",
      typeAttributes: { label: { fieldName: "LastModifiedBy" } }
    },
    { label: "File Size", fieldName: "ContentSize" },
    {
      fieldName: "actions",
      type: "action",
      typeAttributes: { rowActions: ACTIONS }
    }
  ];

  handleUploadFinished() {
    refreshApex(this.wiredFileCount);
    return refreshApex(this.wiredFiles).then(() => {
      this.isLoading = false;
    });
  }

  getSelectedRecords(event) {
    this.selectedRecords = event.detail.selectedRows;
    this.hasSelectedRecords = this.selectedRecords.length > 0;
    this.showFileUpload = this.selectedRecords.length === 0;
    this.selectedCount = this.selectedRecords.length;
    this.getSelectedText();
  }

  @wire(getFileCount, { recordId: "$baseRecordId" })
  getWiredFileCount(result) {
    this.wiredFileCount = result;
    if (result.data) {
      this.cardTitle = `Files (${result.data})`;
      this.getSelectedText();
    } else if (result.error) {
      console.error(result.error);
      this.error = result.error;
    }
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
    // Clear any pending debounce timeout
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
    // Set loading state
    this.isLoading = true;

    // Debounce the search to avoid too many server calls
    // Ignore Sev3 "setTimeout" as this is correct usage
    this.delayTimeout = setTimeout(() => {
      searchContentVersions({
        searchTerm: this.searchTerm,
        recordId: this.baseRecordId
      })
        .then((result) => {
          // Process results to add CreatedByName field
          if (this.searchTermUpdated > searchTermUpdated) {
            // Early cancel for stale request
            return;
          }
          this.dataTableFiles = result.map((record) => {
            return mapFile(record);
          });
          this.fileCount = this.dataTableFiles.length;
          this.getSelectedText();
          this.hasAdditionalFiles =
            this.searchTerm == "" &&
            this.dataTableFiles.length < this.wiredFileCount.data;
          this.isLoading = false;
        })
        .catch((error) => {
          console.error("Error searching content versions:", error);
          console.error(error.message);
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
      // Cancel file upload so early return
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
        data.forEach((contentDocumentId) => {
          if (this.contentDocumentIdSet.has(contentDocumentId)) {
            this.contentDocumentIdSet.delete(contentDocumentId);
          }
        });
        return this.handleUploadFinished();
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
          return row.ContentDocumentId === file.ContentDocumentId;
        });
        if (this.contentDocumentIdSet.has(row.ContentDocumentId)) {
          this.contentDocumentIdSet.delete(row.ContentDocumentId);
        }
        return this.handleUploadFinished();
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
    this.selectedText = `${this.selectedCount} of ${this.wiredFileCount.data} file(s) selected.`;
  }

  getAdditionalFiles() {
    this.currentPage++;
    this.isLoading = true;
  }
}
