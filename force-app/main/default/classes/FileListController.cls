public with sharing class FileListController {
  public static final Integer FILE_LIMIT_FALLBACK = 6;
  public static final Integer PAGE_SIZE = 25;

  public class FileRow {
    @AuraEnabled
    public ContentVersion version { get; set; }
    @AuraEnabled
    public Id linkedEntityId { get; set; }
    @AuraEnabled
    public String linkedEntityType { get; set; }
  }

  public class RelatedListConfig {
    @AuraEnabled
    public Boolean showOwner { get; set; }
    @AuraEnabled
    public Boolean showLastModifiedDate { get; set; }
    @AuraEnabled
    public Boolean showLastModifiedBy { get; set; }
    @AuraEnabled
    public Boolean showFileSize { get; set; }
  }

  private static final String RELATED_LIST_CONFIG_DEVELOPER_NAME = 'Default';

  @AuraEnabled(cacheable=true)
  public static RelatedListConfig getRelatedListConfig() {
    RelatedListConfig config = new RelatedListConfig();
    config.showOwner = true;
    config.showLastModifiedDate = true;
    config.showLastModifiedBy = true;
    config.showFileSize = true;

    List<File_Related_List_Config__mdt> rows = [
      SELECT
        Show_Owner__c,
        Show_Last_Modified_Date__c,
        Show_Last_Modified_By__c,
        Show_File_Size__c
      FROM File_Related_List_Config__mdt
      WHERE DeveloperName = :RELATED_LIST_CONFIG_DEVELOPER_NAME
      WITH USER_MODE
      LIMIT 1
    ];
    if (!rows.isEmpty()) {
      File_Related_List_Config__mdt row = rows[0];
      config.showOwner = row.Show_Owner__c;
      config.showLastModifiedDate = row.Show_Last_Modified_Date__c;
      config.showLastModifiedBy = row.Show_Last_Modified_By__c;
      config.showFileSize = row.Show_File_Size__c;
    }
    return config;
  }

  @AuraEnabled(cacheable=true)
  public static List<FileRow> getFiles(
    Id recordId,
    Integer fileLimit,
    Integer page,
    Boolean includeEmails,
    Integer minContentSize,
    String fileTypeFilter
  ) {
    if (fileLimit == null) {
      fileLimit = FILE_LIMIT_FALLBACK;
    }
    Set<Id> recordIds = new Set<Id>{ recordId };
    if (includeEmails) {
      recordIds.addAll(getEmailMessageIds(recordId));
    }
    return getFileRowsByRelatedRecords(
      recordIds,
      fileLimit,
      page,
      minContentSize,
      fileTypeFilter
    );
  }

  private static List<FileRow> getFileRowsByRelatedRecords(
    Set<Id> recordIds,
    Integer fileLimit,
    Integer page,
    Integer minContentSize,
    String fileTypeFilter
  ) {
    if (fileLimit == null) {
      fileLimit = FILE_LIMIT_FALLBACK;
    }
    List<ContentDocumentLink> cdls = baseContentDocumentLinkQuery(
        recordIds,
        minContentSize,
        fileTypeFilter
      )
      .withLimit(fileLimit)
      .orderBy('SystemModstamp DESC')
      .withOffset(page * PAGE_SIZE)
      .asUser()
      .getList();
    return toFileRows(cdls, fileLimit);
  }

  private static List<FileRow> getFileRowsByTitle(
    Set<Id> recordIds,
    String title,
    Integer fileLimit,
    Integer minContentSize,
    String fileTypeFilter
  ) {
    if (fileLimit == null) {
      fileLimit = FILE_LIMIT_FALLBACK;
    }
    ContentDocumentLinkQuery cdlQuery = (ContentDocumentLinkQuery) baseContentDocumentLinkQuery(
        recordIds,
        minContentSize,
        fileTypeFilter
      )
      .byContentDocumentTitle(title)
      .withLimit(fileLimit)
      .asUser()
      .orderBy('SystemModstamp DESC');
    List<ContentDocumentLink> cdls = cdlQuery.getList();
    return toFileRows(cdls, fileLimit);
  }

  private static ContentDocumentLinkQuery baseContentDocumentLinkQuery(
    Set<Id> recordIds,
    Integer minContentSize,
    String fileTypeFilter
  ) {
    return new ContentDocumentLinkQuery()
      .excludeSNote()
      .byLinkedEntityIds(recordIds)
      .byMinimumContentSize(minContentSize)
      .byFileTypeFilter(fileTypeFilter);
  }

  /**
   * Dedupe by latest published version, preferring EmailMessage links when both exist.
   */
  private static List<FileRow> toFileRows(
    List<ContentDocumentLink> cdls,
    Integer fileLimit
  ) {
    Map<Id, ContentDocumentLink> preferredByVersionId = new Map<Id, ContentDocumentLink>();
    List<Id> versionOrder = new List<Id>();

    for (ContentDocumentLink cdl : cdls) {
      Id versionId = cdl.ContentDocument.LatestPublishedVersionId;
      if (versionId == null) {
        continue;
      }
      ContentDocumentLink existing = preferredByVersionId.get(versionId);
      if (existing == null) {
        preferredByVersionId.put(versionId, cdl);
        versionOrder.add(versionId);
      } else if (
        isEmailMessage(cdl.LinkedEntityId) &&
        !isEmailMessage(existing.LinkedEntityId)
      ) {
        preferredByVersionId.put(versionId, cdl);
      }
    }

    Map<Id, ContentVersion> versionsById = new Map<Id, ContentVersion>();
    if (!preferredByVersionId.isEmpty()) {
      for (
        ContentVersion cv : (List<ContentVersion>) new ContentVersionQuery()
          .byId(preferredByVersionId.keySet())
          .orderBy('ContentDocument.LastModifiedDate DESC')
          .withLimit(fileLimit)
          .asUser()
          .getList()
      ) {
        versionsById.put(cv.Id, cv);
      }
    }

    List<FileRow> rows = new List<FileRow>();
    for (Id versionId : versionOrder) {
      if (rows.size() >= fileLimit) {
        break;
      }
      ContentVersion version = versionsById.get(versionId);
      if (version == null) {
        continue;
      }
      ContentDocumentLink cdl = preferredByVersionId.get(versionId);
      rows.add(buildFileRow(version, cdl));
    }
    return rows;
  }

  private static FileRow buildFileRow(
    ContentVersion version,
    ContentDocumentLink cdl
  ) {
    FileRow row = new FileRow();
    row.version = version;
    row.linkedEntityId = cdl.LinkedEntityId;
    row.linkedEntityType = resolveLinkedEntityType(cdl);
    return row;
  }

  private static String resolveLinkedEntityType(ContentDocumentLink cdl) {
    if (cdl.LinkedEntityId == null) {
      return null;
    }
    try {
      return cdl.LinkedEntityId.getSObjectType().getDescribe().getName();
    } catch (Exception e) {
      return null;
    }
  }

  private static Boolean isEmailMessage(Id linkedEntityId) {
    return linkedEntityId != null &&
      linkedEntityId.getSObjectType() == EmailMessage.SObjectType;
  }

  @AuraEnabled(cacheable=true)
  public static Integer getFileCount(
    Id recordId,
    Boolean includeEmails,
    Integer minContentSize,
    String fileTypeFilter
  ) {
    Set<Id> recordIds = new Set<Id>{ recordId };
    if (includeEmails) {
      recordIds.addAll(getEmailMessageIds(recordId));
    }
    List<ContentDocumentLink> cdls = baseContentDocumentLinkQuery(
        recordIds,
        minContentSize,
        fileTypeFilter
      )
      .asUser()
      .getList();

    // Count unique files, not link rows, to keep parity with getFiles().
    Set<Id> cvIds = new Set<Id>();
    for (ContentDocumentLink cdl : cdls) {
      cvIds.add(cdl.ContentDocument.LatestPublishedVersionId);
    }
    return cvIds.size();
  }

  /** Non-cacheable so View All always loads fresh data after record-page uploads. */
  @AuraEnabled
  public static List<FileRow> getRelatedListFiles(
    Id recordId,
    Integer fileLimit,
    Integer page,
    Boolean includeEmails,
    Integer minContentSize,
    String fileTypeFilter
  ) {
    return getFiles(
      recordId,
      fileLimit,
      page,
      includeEmails,
      minContentSize,
      fileTypeFilter
    );
  }

  /** Non-cacheable so View All always loads fresh data after record-page uploads. */
  @AuraEnabled
  public static Integer getRelatedListFileCount(
    Id recordId,
    Boolean includeEmails,
    Integer minContentSize,
    String fileTypeFilter
  ) {
    return getFileCount(recordId, includeEmails, minContentSize, fileTypeFilter);
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
  public static List<FileRow> searchContentVersions(
    String searchTerm,
    String recordId,
    Boolean includeEmails,
    Integer minContentSize,
    String fileTypeFilter
  ) {
    Set<Id> recordIds = new Set<Id>{ recordId };
    if (includeEmails) {
      recordIds.addAll(getEmailMessageIds(recordId));
    }
    return getFileRowsByTitle(
      recordIds,
      searchTerm,
      25,
      minContentSize,
      fileTypeFilter
    );
  }
}
