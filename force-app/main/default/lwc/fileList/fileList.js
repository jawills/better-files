import { LightningElement, wire, api, track } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import {
  getFileIcon,
  formatBytes,
  hasPreview,
  getFormattedFileCount
} from "c/util";
import getPartialFiles from "@salesforce/apex/FileListController.getPartialFiles";
import getFileCount from "@salesforce/apex/FileListController.getFileCount";
import fileListSkeleton from "./fileListSkeleton.html";
import fileList from "./fileList.html";
import { refreshApex } from "@salesforce/apex";
import { loadStyle } from "lightning/platformResourceLoader";
import dropzoneStyle from "@salesforce/resourceUrl/dropzone";

export default class FileList extends NavigationMixin(LightningElement) {
  @api recordId;
  @api objectApiName;
  @api accept;
  @api multiple;

  cardTitle = "Files";
  isLoading = true;
  showDropZone = false;
  @track wiredFiles;

  render() {
    return this.isLoading ? fileListSkeleton : fileList;
  }

  renderedCallback() {
    Promise.all([loadStyle(this, dropzoneStyle)]);
  }
  viewAllRecords() {
    this[NavigationMixin.Navigate](
      {
        type: "standard__component",
        attributes: {
          componentName: "file1sync__fileRelatedList",
          recordId: this.recordId
        },
        state: {
          c__recordId: this.recordId,
          c__objectName: this.objectApiName
        }
      },
      false
    );
  }

  @wire(getPartialFiles, { recordId: "$recordId" })
  getWiredFiles(result) {
    this.wiredFiles = result;
    if (result.data) {
      this.dataTableFiles = this.wiredFiles.data.map((file) => {
        return {
          Id: file.Id,
          ContentDocumentId: file.ContentDocument.Id,
          Title: file.ContentDocument.Title,
          CreatedDate: file.ContentDocument.CreatedDate,
          LastModifiedDate: file.ContentDocument.LastModifiedDate,
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
      this.showDropZone = this.dataTableFiles.length === 0;
      this.isLoading = false;
      this.error = undefined;
    } else if (result.error) {
      this.error = result.error;
      this.wiredFiles = undefined;
      console.error("Error loading files:", result.error); // Log the error
    }
  }

  @wire(getFileCount, { recordId: "$recordId" })
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
  }
}
