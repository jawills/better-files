import { api, LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";

export default class FileCard extends NavigationMixin(LightningElement) {
  @api file;
  imageUrl;
  viewUrl;
  connectedCallback() {
    this.renderImage();
  }

  async renderImage() {
    if (this.file && this.file.VersionData) {
      this.imageUrl = `/sfc/servlet.shepherd/version/renditionDownload?rendition=thumb120by90&versionId=${this.file.Id}&operationContext=CHATTER`;
      this[NavigationMixin.GenerateUrl]({
        type: "standard__recordPage",
        attributes: {
          recordId: this.file.ContentDocumentId,
          actionName: "view"
        }
      }).then((url) => {
        this.viewUrl = url;
      });
    }
  }
}
