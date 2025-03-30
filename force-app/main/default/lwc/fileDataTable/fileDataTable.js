import LightningDatatable from "lightning/datatable";
import imageTableControl from "./imageTableControl.html";
import imagePreviewTableControl from "./imagePreviewTableControl.html";

export default class SalesforceCodexDataTable extends LightningDatatable {
  static customTypes = {
    image: {
      template: imageTableControl,
      typeAttributes: ["imageUrl", "icon", "altText", "hasPreview"]
    },
    imagePreview: {
      template: imagePreviewTableControl,
      typeAttributes: [
        "Title",
        "ContentVersionId",
        "ContentDocumentId",
        "FallbackLink",
        "IconName"
      ]
    }
  };
}
