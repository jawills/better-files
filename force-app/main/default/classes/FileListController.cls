public with sharing class FileListController {
  public static final Integer FILE_LIMIT_FALLBACK = 6;
  public static final Integer PAGE_SIZE = 25;
  @AuraEnabled(cacheable=true)
  public static List<ContentVersion> getFiles(
    Id recordId,
    Integer fileLimit,
    Integer page,
    Boolean includeEmails
  ) {
    if (fileLimit == null) {
      fileLimit = FILE_LIMIT_FALLBACK;
    }
    Set<Id> recordIds = new Set<Id>{ recordId };
    if (includeEmails) {
      recordIds.addAll(getEmailMessageIds(recordId));
    }
    Set<Id> cvIds = getContentVersionIdsByRelatedRecords(
      recordIds,
      fileLimit,
      page
    );
    return new ContentVersionQuery()
      .byId(cvIds)
      .orderBy('ContentDocument.LastModifiedDate DESC')
      .withLimit(fileLimit)
      .asUser()
      .getList();
  }

  private static Set<Id> getContentVersionIdsByRelatedRecords(
    Set<Id> recordIds,
    Integer fileLimit,
    Integer page
  ) {
    if (fileLimit == null) {
      fileLimit = FILE_LIMIT_FALLBACK;
    }
    List<ContentDocumentLink> cdls = new ContentDocumentLinkQuery()
      .excludeSNote()
      .byLinkedEntityIds(recordIds)
      .withLimit(fileLimit)
      .orderBy('SystemModstamp DESC')
      .withOffset(page * PAGE_SIZE)
      .asUser()
      .getList();
    // Can't use collection api b/c nested relationship
    Set<Id> cvIds = new Set<Id>();
    for (ContentDocumentLink cdl : cdls) {
      cvIds.add(cdl.ContentDocument.LatestPublishedVersionId);
    }
    return cvIds;
  }

  private static Set<Id> getContentVersionIdsByTitle(
    Set<Id> recordIds,
    String title,
    Integer fileLimit
  ) {
    if (fileLimit == null) {
      fileLimit = FILE_LIMIT_FALLBACK;
    }
    ContentDocumentLinkQuery cdlQuery = (ContentDocumentLinkQuery) new ContentDocumentLinkQuery()
      .byLinkedEntityIds(recordIds)
      .byContentDocumentTitle(title)
      .excludeSNote()
      .withLimit(fileLimit)
      .asUser()
      .orderBy('SystemModstamp DESC');
    List<ContentDocumentLink> cdls = cdlQuery.getList();
    // Can't use collection api b/c nested relationship
    Set<Id> cvIds = new Set<Id>();
    for (ContentDocumentLink cdl : cdls) {
      cvIds.add(cdl.ContentDocument.LatestPublishedVersionId);
    }
    return cvIds;
  }

  @AuraEnabled(cacheable=true)
  public static Integer getFileCount(Id recordId, Boolean includeEmails) {
    //@TODO Add Email Count
    Set<Id> recordIds = new Set<Id>{ recordId };
    if (includeEmails) {
      recordIds.addAll(getEmailMessageIds(recordId));
    }
    return new ContentDocumentLinkQuery()
      .excludeSNote()
      .byLinkedEntityIds(recordIds)
      .asUser()
      .getCount();
  }

  @AuraEnabled
  public static Id deleteFile(String contentDocumentId) {
    new DatabaseService().asUser().deleteRecord((Id) contentDocumentId);
    return contentDocumentId;
  }

  @AuraEnabled
  public static List<Id> deleteFiles(List<Id> contentDocumentIds) {
    new DatabaseService().asUser().deleteRecords(contentDocumentIds);
    return contentDocumentIds;
  }

  /**
   * Get Email Message Ids related to parent record
   */
  private static Set<Id> getEmailMessageIds(Id recordId) {
    Set<Id> emailMessageIds = new Set<Id>();
    List<EmailMessage> emailRelList = (List<EmailMessage>) new EmailMessageQuery()
      .byRelationId(recordId)
      .hasAttatchment()
      .asUser()
      .getList();

    // Cannot use reducer method b/c need casted as id
    for (EmailMessage emailRel : emailRelList) {
      emailMessageIds.add(emailRel.Id);
    }

    return emailMessageIds;
  }

  @AuraEnabled(cacheable=true)
  @SuppressWarnings('sfge.ApexFlsViolationRule')
  public static string getRecordName(Id recordId, String objectAPIName) {
    try {
      // Using WITH USER_MODE when building dynamic SOQL
      SObject record = Database.query(
        'SELECT Id, Name FROM ' +
          String.escapeSingleQuotes(objectAPIName) +
          ' WHERE Id = \'' +
          String.escapeSingleQuotes(recordId) +
          '\' WITH USER_MODE '
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
      .asUser()
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
    String recordId,
    Boolean includeEmails
  ) {
    Set<Id> recordIds = new Set<Id>{ recordId };
    if (includeEmails) {
      recordIds.addAll(getEmailMessageIds(recordId));
    }
    Set<Id> cvIds = getContentVersionIdsByTitle(recordIds, searchTerm, 20);
    return new ContentVersionQuery()
      .likeTitle(searchTerm)
      .byId(cvIds)
      .orderBy('ContentDocument.LastModifiedDate DESC')
      .asUser()
      .withLimit(25)
      .getList();
  }
}
