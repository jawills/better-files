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

export default class FileList extends NavigationMixin(LightningElement) {
  @api recordId;
  @api objectApiName;
  @api accept = ".csv,.doc,.xsl,.pdf,.png,.jpg,.jpeg,.docx,.doc";

  cardTitle = "Files";
  isLoading = true;
  wiredFiles;

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
      this.selectedFile = this.dataTableFiles[0];
      this.fileCount = this.dataTableFiles.length;
      this.isLoading = false;
      this.error = undefined;
    } else if (result.error) {
      this.error = result.error;
      this.wiredFiles = undefined;
      console.error("Error loading files:", result.error); // Log the error
    }
  }

  @wire(getFileCount, { recordId: "$recordId" })
  getWiredFileCount({ error, data }) {
    if (data) {
      this.cardTitle = `Files (${getFormattedFileCount(data)})`;
    } else if (error) {
      console.error(error);
      this.error = error;
    }
  }

  handleUploadFinished() {
    return refreshApex(this.wiredFiles).then(() => {
      this.isLoading = false;
    });
  }
}
