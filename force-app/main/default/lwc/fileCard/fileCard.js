import { api, LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";

export default class FileCard extends NavigationMixin(LightningElement) {
  @api file;
  imageUrl;
  viewUrl;

  handleClick(event) {
    event.preventDefault();
    this.previewFile();
  }

  connectedCallback() {
    this[NavigationMixin.GenerateUrl](
      {
        type: "standard__namedPage",
        attributes: {
          pageName: "filePreview"
        },
        state: {
          selectedRecordId: this.file.ContentDocumentId
        }
      },
      false
    ).then((data) => {
      console.log(data);
    });
  }

  previewFile() {
    this[NavigationMixin.Navigate](
      {
        type: "standard__namedPage",
        attributes: {
          pageName: "filePreview"
        },
        state: {
          selectedRecordId: this.file.ContentDocumentId
        }
      },
      false
    );
  }
}
