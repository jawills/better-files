import { LightningElement, wire, api, track } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { mapFile } from "c/util";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import getFileCount from "@salesforce/apex/FileListController.getFileCount";
import uploadFile from "@salesforce/apex/FileListController.uploadFile";
import fileListSkeleton from "./fileListSkeleton.html";
import fileList from "./fileList.html";
import { refreshApex } from "@salesforce/apex";
import { loadStyle } from "lightning/platformResourceLoader";
import dropzoneStyle from "@salesforce/resourceUrl/dropzone";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { RefreshEvent } from "lightning/refresh";
import {
  IsConsoleNavigation,
  getFocusedTabInfo,
  openSubtab
} from "lightning/platformWorkspaceApi";
export default class FileList extends NavigationMixin(LightningElement) {
  @api recordId;
  @api objectApiName;
  @api accept;
  @api multiple;
  @api fileLimit;
  @api includeEmails;
  @api filePreview;
  @api filesPerRow;
  @api minimumFileSizeKb;
  cardTitle = "Files";
  isLoading = true;
  showSkeleton = true;
  showDropZone = false;
  isSmall = false;
  listContainerCss = "slds-grid slds-wrap slds-var-p-horizontal_small";
  cardSizeCss =
    "slds-col slds-small-size_1-of-1 slds-medium-size_1-of-3 slds-large-size_1-of-4";
  wiredFiles;
  @track wiredFileCount;
  @track dataTableFiles;
  render() {
    return this.showSkeleton ? fileListSkeleton : fileList;
  }

  @wire(IsConsoleNavigation) isConsoleNavigation;

  renderedCallback() {
    Promise.all([loadStyle(this, dropzoneStyle)]);
    const element = this.template.querySelector("lightning-card");
    if (element) {
      // Get various width measurements
      const boundingRect = element.getBoundingClientRect().width;
      console.log(boundingRect);
      this.isSmall = boundingRect < 600;
      const filesPerRow =
        (this.filesPerRow ?? 3) < 12 ? (this.filesPerRow ?? 3) : 3;
      if (this.isSmall) {
        this.cardSizeCss = "slds-col slds-small-size_1-of-1";
        this.listContainerCss = "slds-grid slds-wrap";
      } else {
        this.cardSizeCss = `slds-col slds-small-size_1-of-1 slds-medium-size_1-of-${filesPerRow} slds-large-size_1-of-${filesPerRow}`;
      }
    }
  }

  viewAllRecords() {
    // Standard Navigation to Related list component
    if (!this.isConsoleNavigation) {
      this[NavigationMixin.Navigate](
        {
          type: "standard__component",
          attributes: {
            componentName: "file1sync__fileRelatedList",
            recordId: this.recordId
          },
          state: {
            c__recordId: this.recordId,
            c__objectName: this.objectApiName,
            c__includeEmails: this.includeEmails,
            c__minimumFileSizeKb: this.normalizeMinimumFileSizeKbForState(
              this.minimumFileSizeKb
            )
          }
        },
        false
      );
    } else {
      getFocusedTabInfo()
        .then((tabInfo) => {
          console.log(tabInfo);
          const { tabId, parentTabId } = tabInfo;
          const selectedTab = parentTabId !== null ? parentTabId : tabId;
          openSubtab(selectedTab, {
            focus: true,
            label: `Files`,
            icon: "standard:file",
            iconAlt: "Files",
            pageReference: {
              type: "standard__component",
              attributes: {
                componentName: "file1sync__fileRelatedList"
              },
              state: {
                c__recordId: this.recordId,
                c__objectName: this.objectApiName,
                c__includeEmails: this.includeEmails,
                c__minimumFileSizeKb: this.normalizeMinimumFileSizeKbForState(
                  this.minimumFileSizeKb
                )
              }
            }
          });
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }

  normalizeMinimumFileSizeKbForState(kb) {
    if (kb == null || kb === "" || kb === 0) {
      return null;
    }
    const n = Number(kb);
    if (Number.isNaN(n) || n <= 0) {
      return null;
    }
    return n;
  }

  get minContentSizeBytesForWire() {
    const n = this.normalizeMinimumFileSizeKbForState(this.minimumFileSizeKb);
    return n == null ? null : Math.floor(n * 1024);
  }

  @wire(getFiles, {
    recordId: "$recordId",
    fileLimit: "$fileLimit",
    page: 0,
    includeEmails: "$includeEmails",
    minContentSize: "$minContentSizeBytesForWire"
  })
  getWiredFiles(result) {
    // @NOTE will product infinite loading screen
    // When Wired Properties are not filled

    this.wiredFiles = result;
    if (result.data) {
      this.dataTableFiles = this.wiredFiles.data.map((file) => {
        const mappedFile = mapFile(file);
        // Turn off file preview if setting is false
        mappedFile.hasPreview = mappedFile.hasPreview && this.filePreview;
        return mappedFile;
      });
      this.showDropZone = this.dataTableFiles.length === 0;
      this.isLoading = false;
      this.showSkeleton = false;
      this.error = undefined;
    } else if (result.error) {
      this.error = result.error;
      this.wiredFiles = undefined;
      console.error("Error loading files:", result.error); // Log the error
    }
  }

  @wire(getFileCount, {
    recordId: "$recordId",
    includeEmails: "$includeEmails",
    minContentSize: "$minContentSizeBytesForWire"
  })
  getWiredFileCount(result) {
    this.wiredFileCount = result;
    if (result.data) {
      this.cardTitle = `Files (${result.data})`;
    } else if (result.error) {
      console.error(result.error);
      this.error = result.error;
    }
  }

  handleUploadFinished() {
    refreshApex(this.wiredFiles).then(() => {
      this.isLoading = false;
    });
    refreshApex(this.wiredFileCount).then(() => {
      this.isLoading = false;
    });
    this.dispatchEvent(new RefreshEvent());
  }

  handleMenuUpload() {
    // Find the hidden file input and trigger a click on it
    const fileInput = this.template.querySelector("input").click();
    fileInput.click();
  }
  handleFileChange(event) {
    const files = event.target.files;
    if (files.length > 0) {
      this.uploadFiles(files);
    }
  }

  uploadFiles(files) {
    if (!this.recordId) {
      this.showToast(
        "Error",
        "Record ID is missing. Make sure this component is used on a record page.",
        "error"
      );
      return;
    }

    this.isUploading = true;
    this.isLoading = true;
    // Process files and convert to base64
    const filePromises = Array.from(files).map((file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const fileContents = reader.result.split(",")[1];
          resolve({
            fileName: file.name,
            fileContent: fileContents
          });
        };
        reader.onerror = () => reject(new Error("File reading failed"));
        reader.readAsDataURL(file);
      });
    });

    // Once all files are processed, upload them
    Promise.all(filePromises)
      .then((fileRecords) => {
        const uploadPromises = fileRecords.map((file) => {
          return uploadFile({
            base64: file.fileContent,
            filename: file.fileName,
            recordId: this.recordId
          });
        });
        return Promise.all(uploadPromises);
      })
      .then(() => {
        // console.log(record?Ids);
        console.log("seconds");
        this.showToast("Success", `File uploaded successfully`, "success");
        // Reset the file input
        this.template.querySelector("input").value = "";
        // notifyRecordUpdateAvailable(recordIds).then(() => {
        // });
      })
      .catch((error) => {
        console.error("Error uploading files", error);
        this.showToast(
          "Error",
          "Error uploading files: " + this.reduceErrors(error),
          "error"
        );
      })
      .finally(() => {
        this.isUploading = false;
      });
    this.handleUploadFinished();
  }

  // Helper method to extract error messages
  reduceErrors(error) {
    if (typeof error === "string") {
      return error;
    }

    // UI API read errors
    if (Array.isArray(error.body)) {
      return error.body.map((e) => e.message).join(", ");
    }

    // UI API DML, Apex and network errors
    else if (error.body && typeof error.body.message === "string") {
      return error.body.message;
    }

    // JS errors
    else if (typeof error.message === "string") {
      return error.message;
    }

    // Unknown error shape
    return "Unknown error";
  }

  showToast(title, message, variant) {
    this.dispatchEvent(
      new ShowToastEvent({
        title: title,
        message: message,
        variant: variant
      })
    );
  }
}
