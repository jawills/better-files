public with sharing class ContentVersionQuery extends QueryObject {
  public ContentVersionQuery() {
    super(
      new List<String>{
        'Id',
        'VersionData',
        'ContentDocument.Title',
        'ContentDocument.CreatedDate',
        'ContentDocument.LastModifiedDate',
        'ContentDocument.LastModifiedById',
        'ContentDocument.LastModifiedBy.Name',
        'ContentDocument.OwnerId',
        'ContentDocument.Owner.Name',
        'ContentDocument.ContentSize',
        'ContentDocument.FileExtension'
      },
      ContentVersion.SObjectType
    );
  }

  public ContentVersionQuery likeTitle(String title) {
    return (ContentVersionQuery) byField(
      ContentVersion.Title,
      'LIKE',
      '%' + String.escapeSingleQuotes(title) + '%'
    );
  }
}
