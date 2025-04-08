public with sharing class ContentVersionQuery extends QueryObject {
  public ContentVersionQuery() {
    super(
      new List<String>{
        'Id',
        'VersionData',
        'ContentDocument.Title',
        'ContentDocument.CreatedDate',
        'ContentDocument.LastModifiedDate',
        'ContentDocument.ContentSize',
        'ContentDocument.FileExtension'
      },
      ContentVersion.SObjectType
    );
  }
}
