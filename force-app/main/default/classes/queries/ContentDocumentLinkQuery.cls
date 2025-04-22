public with sharing class ContentDocumentLinkQuery extends QueryObject {
  public ContentDocumentLinkQuery() {
    super(
      new List<String>{
        'Id',
        'LinkedEntityId',
        'ContentDocument.LatestPublishedVersionId',
        'ContentDocument.Title',
        'ContentDocument.CreatedDate',
        'ContentDocument.ContentSize',
        'ContentDocument.FileExtension'
      },
      ContentDocumentLink.SObjectType
    );
  }

  public ContentDocumentLinkQuery byLinkedEntityId(Id linkedEntityId) {
    return (ContentDocumentLinkQuery) byField(
      ContentDocumentLink.LinkedEntityId,
      '=',
      linkedEntityId
    );
  }

  public ContentDocumentLinkQuery byContentDocumentTitle(String title) {
    return (ContentDocumentLinkQuery) byField(
      'ContentDocumentLink.ContentDocument.Title',
      'LIKE',
      '%' + title + '%'
    );
  }
}
