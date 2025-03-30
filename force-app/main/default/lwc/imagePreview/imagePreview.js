import { api, LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";

export default class ImagePreview extends NavigationMixin(LightningElement) {
  @api recordId;
  @api title;
  @api contentdocumentid;
  @api contentversionid;
  @api iconname;
  @api fallbackLink;

  handleClick(event) {
    event.preventDefault();
    // Add your logic here
    this.previewFile();
    console.log("Link clicked!");
  }

  previewFile() {
    this[NavigationMixin.Navigate](
      {
        type: "standard__namedPage",
        attributes: {
          pageName: "filePreview"
        },
        state: {
          selectedRecordId: this.contentdocumentid
        }
      },
      false
    );
  }
}
