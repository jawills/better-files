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

  public ContentDocumentLinkQuery byLinkedEntityIds(Set<Id> linkedEntityIds) {
    return (ContentDocumentLinkQuery) byField(
      ContentDocumentLink.LinkedEntityId,
      'IN',
      linkedEntityIds
    );
  }

  public ContentDocumentLinkQuery byContentDocumentTitle(String title) {
    return (ContentDocumentLinkQuery) byField(
      'ContentDocumentLink.ContentDocument.Title',
      'LIKE',
      '%' + title + '%'
    );
  }

  public ContentDocumentLinkQuery excludeSNote() {
    return (ContentDocumentLinkQuery) byField(
      'ContentDocumentLink.ContentDocument.FileExtension',
      '!=',
      'snote'
    );
  }

  public ContentDocumentLinkQuery byMinimumContentSize(Integer minBytes) {
    if (minBytes != null && minBytes > 0) {
      return (ContentDocumentLinkQuery) byField(
        'ContentDocument.ContentSize',
        '>=',
        minBytes
      );
    }
    return this;
  }

  public ContentDocumentLinkQuery byFileTypeFilter(String fileTypeFilter) {
    if (String.isBlank(fileTypeFilter) || fileTypeFilter == 'all') {
      return this;
    }
    // Prefix exact extensions so files named .image or .document remain distinct from categories.
    if (fileTypeFilter.startsWith('extension:')) {
      String extension = fileTypeFilter.substring('extension:'.length())
        .toLowerCase();
      return (ContentDocumentLinkQuery) byField(
        'ContentDocument.FileExtension',
        '=',
        extension
      );
    }
    if (fileTypeFilter == 'image') {
      return (ContentDocumentLinkQuery) byField(
        'ContentDocument.FileExtension',
        'IN',
        new List<String>{
          'png',
          'jpg',
          'jpeg',
          'gif',
          'bmp',
          'svg',
          'webp',
          'tif',
          'tiff',
          'heic'
        }
      );
    }
    if (fileTypeFilter == 'document') {
      return (ContentDocumentLinkQuery) byField(
        'ContentDocument.FileExtension',
        'IN',
        new List<String>{
          'pdf',
          'doc',
          'docx',
          'xls',
          'xlsx',
          'csv',
          'ppt',
          'pptx',
          'txt',
          'rtf',
          'odt',
          'ods',
          'odp'
        }
      );
    }
    return this;
  }
}
