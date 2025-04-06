import { LightningElement, wire, api, track } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { getFileIcon, formatBytes, hasPreview, getFileCount } from "c/util";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import fileListSkeleton from "./fileListSkeleton.html";
import fileList from "./fileList.html";

export default class FileList extends NavigationMixin(LightningElement) {
  @api recordId;
  @api objectApiName;
  cardTitle = "Files";
  isLoading = true;

  render() {
    return this.isLoading ? fileListSkeleton : fileList;
  }
  viewAllRecords() {
    this[NavigationMixin.Navigate](
      {
        type: "standard__component",
        attributes: {
          componentName: "c__fileRelatedList",
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

  @wire(getFiles, { recordId: "$recordId" })
  getWiredFiles({ error, data }) {
    if (data) {
      this.wiredFiles = data;
      this.dataTableFiles = this.wiredFiles.map((file) => {
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
      this.selectedFile = this.dataTableFiles[0];
      this.fileCount = this.dataTableFiles.length;
      this.cardTitle = `Files (${getFileCount(this.dataTableFiles.length)})`;
      this.isLoading = false;
      this.error = undefined;
    } else if (error) {
      this.error = error;
      this.wiredFiles = undefined;
      console.error("Error loading files:", error); // Log the error
    }
  }
}
