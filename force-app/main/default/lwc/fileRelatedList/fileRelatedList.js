import { LightningElement, wire, api, track } from "lwc";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import deleteFile from "@salesforce/apex/FileListController.deleteFile";
import getRecordName from "@salesforce/apex/FileListController.getRecordName";
import { NavigationMixin, CurrentPageReference } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { refreshApex } from "@salesforce/apex";
import { getFileIcon, formatBytes, hasPreview } from "c/util";
import LightningConfirm from "lightning/confirm";

//@todo make dynamic
const ACTIONS = [
  { label: "Preview", name: "Preview" },
  { label: "Download", name: "Download" },
  { label: "Delete", name: "Delete" }
];

export default class FileRelatedList extends NavigationMixin(LightningElement) {
  @api baseObjectName;
  @api baseObjectUrl;
  @api baseRecordId;
  @track relatedRecordName;
  @track relatedRecordUrl;
  @track selectedRecords = [];
  isLoading = true;
  hasSelectedRecords = false;
  showFileUpload = true;
  fileCount = 0;
  cardTitle = "Files";
  wiredFiles;
  dataTableFiles;

  @wire(CurrentPageReference)
  getCurrentPageReference(currentPageReference) {
    this.currentPageReference = currentPageReference;
    new Promise((resolve, reject) => {
      setTimeout(() => {
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
            });
          resolve();
        }
      }, 0);
    })
      .catch((error) => {
        console.error(JSON.stringify(error));
      })
      .finally(() => {
        this.isLoading = false;
      });
  }
  @wire(getFiles, { recordId: "$baseRecordId", fileLimit: 25 })
  getWiredFiles(result) {
    this.wiredFiles = result;
    if (result.data) {
      this.dataTableFiles = this.wiredFiles.data.map((file) => {
        return {
          Id: file.Id,
          ContentDocumentId: file.ContentDocument.Id,
          Title: file.ContentDocument.Title,
          CreatedDate: file.ContentDocument.CreatedDate,
          ContentSize: formatBytes(file.ContentDocument.ContentSize),
          FileExtension: file.ContentDocument.FileExtension,
          VersionData: file.VersionData,
          hasPreview: hasPreview(file.ContentDocument.FileExtension),
          downloadUrl: `/sfc/servlet.shepherd/document/download/${file.ContentDocumentId}`,
          imageUrl: `/sfc/servlet.shepherd/version/renditionDownload?rendition=thumb120by90&versionId=${file.Id}`,
          fileUrl: `/lightning/r/${file.ContentDocument.Id}/view`,
          icon: getFileIcon(file.ContentDocument.FileExtension)
        };
      });
      this.fileCount = this.dataTableFiles.length;
      this.isLoading = false;
      this.error = undefined;
    } else if (result.error) {
      this.error = result.error;
      this.wiredFiles = undefined;
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
    { label: "CreatedDate", fieldName: "CreatedDate", type: "date" },
    { label: "ContentSize", fieldName: "ContentSize" },
    { label: "FileExtension", fieldName: "FileExtension" },
    {
      fieldName: "actions",
      type: "action",
      typeAttributes: { rowActions: ACTIONS }
    }
  ];

  handleUploadFinished() {
    return refreshApex(this.wiredFiles).then(() => {
      this.isLoading = false;
    });
  }

  getSelectedRecords(event) {
    this.selectedRecords = event.detail.selectedRows;
    this.hasSelectedRecords = this.selectedRecords.length > 0;
    this.showFileUpload = this.selectedRecords.length === 0;
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
    const promises = records.map((record) =>
      deleteFile({ contentDocumentId: record.ContentDocumentId })
    );
    Promise.all(promises)
      .then(() => {
        this.showToast("Success", "Files deleted", "success");
        this.selectedRecords = undefined;
        return refreshApex(this.wiredFiles).then(() => {
          this.isLoading = false;
        });
      })
      .catch((error) => {
        console.error(error);
        this.isLoading = false;
        this.showToast("Error deleting records", error?.body?.message, "error");
      });
  }

  downloadSelectedRecords() {
    for (const record of this.selectedRecords) {
      this.downloadFile(record);
    }
  }

  showToast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }

  deleteCurrentRecord(row) {
    this.isLoading = true;
    deleteFile({ contentDocumentId: row.ContentDocumentId })
      .then(() => {
        this.showToast("Success", "File deleted", "success");
        return refreshApex(this.wiredFiles).then(() => {
          this.isLoading = false;
        });
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
}
