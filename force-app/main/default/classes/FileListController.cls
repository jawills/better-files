public with sharing class FileListController {
  public static final Integer FILE_LIMIT_FALLBACK = 6;

  @AuraEnabled(cacheable=true)
  public static List<ContentVersion> getFiles(Id recordId, Integer fileLimit) {
    Set<Id> cvIds = getContentVersionIdsByRelatedRecord(recordId, fileLimit);
    if (fileLimit == null) {
      fileLimit = FILE_LIMIT_FALLBACK;
    }
    return new ContentVersionQuery()
      .byId(cvIds)
      .orderBy('ContentDocument.LastModifiedDate DESC')
      .withLimit(fileLimit)
      .getList();
  }

  private static Set<Id> getContentVersionIdsByRelatedRecord(
    Id recordId,
    Integer fileLimit
  ) {
    if (fileLimit == null) {
      fileLimit = FILE_LIMIT_FALLBACK;
    }
    List<ContentDocumentLink> cdls = new ContentDocumentLinkQuery()
      .byLinkedEntityId(recordId)
      .withLimit(fileLimit)
      .orderBy('SystemModstamp DESC')
      .getList();
    // Can't use collection api b/c nested relationship
    Set<Id> cvIds = new Set<Id>();
    for (ContentDocumentLink cdl : cdls) {
      cvIds.add(cdl.ContentDocument.LatestPublishedVersionId);
    }
    return cvIds;
  }

  @AuraEnabled(cacheable=true)
  public static Integer getFileCount(Id recordId) {
    return new ContentDocumentLinkQuery().byLinkedEntityId(recordId).getCount();
  }

  @AuraEnabled
  public static void deleteFile(String contentDocumentId) {
    new DatabaseService().asUser().deleteRecord((Id) contentDocumentId);
  }

  @AuraEnabled(cacheable=true)
  public static string getRecordName(Id recordId, String objectAPIName) {
    try {
      SObject record = Database.query(
        'SELECT Id, Name FROM ' +
          String.escapeSingleQuotes(objectAPIName) +
          ' WHERE Id = \'' +
          String.escapeSingleQuotes(recordId) +
          '\''
      );
      return (String) record.get('Name');
    } catch (Exception e) {
      System.debug(e);
    }
    return '';
  }

  @AuraEnabled
  public static String uploadFile(
    String base64,
    String filename,
    String recordId
  ) {
    Id cvId = createContentVersion(base64, filename);
    if (cvId == null) {
      // No content version created
      return null;
    }
    return createContentLink(cvId, recordId);
  }

  private static Id createContentVersion(String base64, String filename) {
    ContentVersion cv = new ContentVersion();
    cv.VersionData = EncodingUtil.base64Decode(base64);
    cv.Title = filename;
    cv.PathOnClient = filename;
    DML.Result result = new DatabaseService().asUser().insertRecord(cv);
    if (result.success) {
      return result.id;
    }
    return null;
  }

  private static Id createContentLink(
    String contentVersionId,
    String recordId
  ) {
    if (contentVersionId == null || recordId == null) {
      return null;
    }
    ContentDocumentLink cdl = new ContentDocumentLink();
    cdl.ContentDocumentId = (Id) new ContentVersionQuery()
      .byId(contentVersionId)
      .getFirstFieldOrNull(ContentVersion.ContentDocumentId);
    cdl.LinkedEntityId = recordId;
    // ShareType is either 'V', 'C', or 'I'
    // V = Viewer, C = Collaborator, I = Inferred
    cdl.ShareType = 'V';
    DML.Result result = new DatabaseService().asUser().insertRecord(cdl);
    if (result.success) {
      return result.id;
    }
    return null;
  }

  @AuraEnabled(cacheable=true)
  public static List<ContentVersion> searchContentVersions(
    String searchTerm,
    String recordId
  ) {
    System.debug(recordId);
    Set<Id> cvIds = getContentVersionIdsByRelatedRecord(recordId, 20);
    return new ContentVersionQuery()
      .likeTitle(searchTerm)
      .byId(cvIds)
      .orderBy('ContentDocument.LastModifiedDate DESC')
      .withLimit(20)
      .getList();
  }
}
