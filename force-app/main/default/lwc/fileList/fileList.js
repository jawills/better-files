import { LightningElement, wire, api } from "lwc";
import getFiles from "@salesforce/apex/FileListController.getFiles";

const ACTIONS = [{ label: "Delete", name: "delete" }];

export default class FileList extends LightningElement {
  @api recordId;
  loading = false;
  showFileUpload = true;
  wiredFiles;
  dataTableFiles;
  @wire(getFiles, { recordId: "$recordId" })
  wiredContacts({ error, data }) {
    if (data) {
      this.wiredFiles = data;
      console.log(data);
      this.dataTableFiles = this.wiredFiles.map((file) => ({
        Id: file.ContentDocument.Id,
        Title: file.ContentDocument.Title,
        CreatedDate: file.ContentDocument.CreatedDate,
        ContentSize: this.formatBytes(file.ContentDocument.ContentSize),
        FileExtension: file.ContentDocument.FileExtension,
        icon: this.getFileIcon(file.ContentDocument.FileExtension)
      }));
      console.log(JSON.stringify(this.dataTableFiles));

      this.error = undefined;
    } else if (error) {
      this.error = error;
      this.wiredFiles = undefined;
      console.error("Error loading files:", error); // Log the error
    }
  }
  columns = [
    { label: "Image", fieldName: "Image" },
    {
      label: "Title",
      fieldName: "Title",
      wrapText: true,
      cellAttributes: {
        iconName: { fieldName: "icon" },
        iconPosition: "left"
      }
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
  handleUploadFinish(e) {
    console.log(e);
  }

  /**
   * Formats bytes into a human-readable string.
   *
   * @param {number} bytes The number of bytes.
   * @param {number} [decimals=0] The number of decimal places to use.
   * @returns {string} The formatted string.
   */
  formatBytes(bytes, decimals = 0) {
    if (!+bytes) {
      return "0 Bytes";
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  /**
   * @description Returns the Lightning Design System doctype icon based on the file extension provided.
   *
   * @param {string} fileExtension The file extension of the file. Include the leading period. Case-insensitive.
   * @returns {string} The doctype icon name. Returns 'doctype:unknown' if no match is found.
   */
  getFileIcon(fileExtension) {
    const lowerExtension = fileExtension.toLowerCase();

    const extensionToIcon = {
      xlsx: "doctype:excel",
      xls: "doctype:excel",
      csv: "doctype:csv",
      docx: "doctype:word",
      doc: "doctype:word",
      pdf: "doctype:pdf",
      pptx: "doctype:ppt",
      ppt: "doctype:ppt",
      txt: "doctype:txt",
      rtf: "doctype:txt",
      png: "doctype:image",
      jpg: "doctype:image",
      jpeg: "doctype:image",
      gif: "doctype:image",
      bmp: "doctype:image",
      svg: "doctype:image",
      zip: "doctype:zip",
      rar: "doctype:zip",
      "7z": "doctype:zip",
      xml: "doctype:xml",
      json: "doctype:json",
      mp3: "doctype:audio",
      wav: "doctype:audio",
      mp4: "doctype:video",
      avi: "doctype:video",
      mov: "doctype:video",
      htm: "doctype:html",
      html: "doctype:html",
      css: "doctype:css",
      js: "doctype:script",
      java: "doctype:code",
      apex: "doctype:code",
      log: "doctype:log"
    };

    return extensionToIcon[lowerExtension] || "doctype:unknown";
  }
}
