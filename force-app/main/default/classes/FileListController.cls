public with sharing class FileListController {
  public static final Integer FILE_LIMIT_FALLBACK = 6;
  public static final Integer PAGE_SIZE = 25;
  /** Theme__c picklist values, which are also the React app's theme ids. */
  private static final Set<String> THEMES = new Set<String>{
    'cosmos',
    'lightning-blue',
    'better-files'
  };
  private static final String DEFAULT_THEME = 'cosmos';

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
    @AuraEnabled
    public String filterMode { get; set; }
  }

  private static final String RELATED_LIST_CONFIG_DEVELOPER_NAME = 'Default';

  /** Resolve the installed app in this org without a subscriber-maintained URL. */
  @AuraEnabled(cacheable=true)
  public static String getReactAppUrl() {
    List<AppMenuItem> apps = [
      SELECT StartUrl, IsAccessible
      FROM AppMenuItem
      WHERE Name = 'BetterFilesReact' AND NamespacePrefix = 'file1sync'
      WITH USER_MODE
      LIMIT 1
    ];
    return apps.isEmpty() || !apps[0].IsAccessible ? null : apps[0].StartUrl;
  }

  @AuraEnabled(cacheable=true)
  public static RelatedListConfig getRelatedListConfig() {
    RelatedListConfig config = new RelatedListConfig();
    config.showOwner = true;
    config.showLastModifiedDate = true;
    config.showLastModifiedBy = true;
    config.showFileSize = true;
    config.filterMode = 'Basic';

    List<File_Related_List_Config__mdt> rows = [
      SELECT
        Show_Owner__c,
        Show_Last_Modified_Date__c,
        Show_Last_Modified_By__c,
        Show_File_Size__c,
        Filter_Mode__c
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
      config.filterMode = row.Filter_Mode__c == 'Advanced'
        ? 'Advanced'
        : 'Basic';
    }
    return config;
  }

  /** The org-wide theme for both React views. Blank or unknown values use Cosmos. */
  @AuraEnabled(cacheable=true)
  public static String getTheme() {
    List<File_Related_List_Config__mdt> rows = [
      SELECT Theme__c
      FROM File_Related_List_Config__mdt
      WHERE DeveloperName = :RELATED_LIST_CONFIG_DEVELOPER_NAME
      WITH USER_MODE
      LIMIT 1
    ];
    String theme = rows.isEmpty() ? null : rows[0].Theme__c;
    return THEMES.contains(theme) ? theme : DEFAULT_THEME;
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

  /** Available extensions across the whole eligible record, independent of search and pagination. */
  @AuraEnabled
  public static List<String> getRelatedListFileExtensions(
    Id recordId,
    Boolean includeEmails,
    Integer minContentSize
  ) {
    Set<String> extensions = new Set<String>();
    for (
      ContentDocumentLink link : (List<ContentDocumentLink>) getRelatedListLinks(
        recordId,
        includeEmails,
        minContentSize,
        null,
        null
      )
    ) {
      if (link.ContentDocument.LatestPublishedVersionId != null) {
        String extension = link.ContentDocument.FileExtension;
        extensions.add(
          String.isBlank(extension) ? '' : extension.toLowerCase()
        );
      }
    }
    List<String> result = new List<String>(extensions);
    result.sort();
    return result;
  }

  /** Non-cacheable so View All always loads fresh data after record-page uploads. */
  @AuraEnabled
  public static List<FileRow> getRelatedListFiles(
    Id recordId,
    Integer fileLimit,
    Integer page,
    Boolean includeEmails,
    Integer minContentSize,
    String fileTypeFilter,
    String searchTerm,
    String sortBy,
    String sortDirection
  ) {
    List<ContentDocumentLink> links = getRelatedListLinks(
      recordId,
      includeEmails,
      minContentSize,
      fileTypeFilter,
      searchTerm
    );

    // Page unique files, not links: a file can belong to both the record and emails.
    Map<Id, ContentDocumentLink> preferredByVersionId = new Map<Id, ContentDocumentLink>();
    for (ContentDocumentLink link : links) {
      Id versionId = link.ContentDocument.LatestPublishedVersionId;
      if (
        versionId != null &&
        (!preferredByVersionId.containsKey(versionId) ||
        isEmailMessage(link.LinkedEntityId))
      ) {
        preferredByVersionId.put(versionId, link);
      }
    }
    if (preferredByVersionId.isEmpty()) {
      return new List<FileRow>();
    }

    Integer limitSize = fileLimit == null ? PAGE_SIZE : fileLimit;
    Integer pageNumber = page == null ? 0 : page;
    List<FileRow> rows = new List<FileRow>();
    for (
      ContentVersion version : (List<ContentVersion>) new ContentVersionQuery()
        .byId(preferredByVersionId.keySet())
        .orderBy(relatedListOrderBy(sortBy, sortDirection))
        .withLimit(limitSize)
        .withOffset(pageNumber * limitSize)
        .asUser()
        .getList()
    ) {
      rows.add(buildFileRow(version, preferredByVersionId.get(version.Id)));
    }
    return rows;
  }

  /** Only allow known fields and directions into the dynamic ORDER BY clause. */
  private static String relatedListOrderBy(
    String sortBy,
    String sortDirection
  ) {
    Map<String, String> fields = new Map<String, String>{
      'Title' => 'ContentDocument.Title',
      'Owner' => 'ContentDocument.Owner.Name',
      'LastModifiedDate' => 'ContentDocument.LastModifiedDate',
      'LastModifiedBy' => 'ContentDocument.LastModifiedBy.Name',
      'ContentSize' => 'ContentDocument.ContentSize'
    };
    String field = fields.get(sortBy);
    String direction = sortDirection == 'asc' ? 'ASC' : 'DESC';
    if (field == null) {
      field = fields.get('LastModifiedDate');
      direction = 'DESC';
    }
    // A unique tie-breaker keeps equal values in the same order across pages.
    return field + ' ' + direction + ' NULLS LAST, Id ASC';
  }

  private static List<ContentDocumentLink> getRelatedListLinks(
    Id recordId,
    Boolean includeEmails,
    Integer minContentSize,
    String fileTypeFilter,
    String searchTerm
  ) {
    Set<Id> recordIds = new Set<Id>{ recordId };
    if (includeEmails == true) {
      recordIds.addAll(getEmailMessageIds(recordId));
    }
    ContentDocumentLinkQuery query = baseContentDocumentLinkQuery(
      recordIds,
      minContentSize,
      fileTypeFilter == 'extension:' ? null : fileTypeFilter
    );
    if (String.isNotBlank(searchTerm)) {
      query.byContentDocumentTitle(searchTerm);
    }
    List<ContentDocumentLink> links = query.asUser().getList();
    if (fileTypeFilter == 'extension:') {
      // Salesforce returns blank extensions but does not match them with a
      // null/empty SOQL predicate. Filter before deduplication, paging, and counting.
      for (Integer i = links.size() - 1; i >= 0; i--) {
        if (String.isNotBlank(links[i].ContentDocument.FileExtension)) {
          links.remove(i);
        }
      }
    }
    return links;
  }

  /** Non-cacheable so View All always loads fresh data after record-page uploads. */
  @AuraEnabled
  public static Integer getRelatedListFileCount(
    Id recordId,
    Boolean includeEmails,
    Integer minContentSize,
    String fileTypeFilter,
    String searchTerm
  ) {
    Set<Id> versionIds = new Set<Id>();
    for (
      ContentDocumentLink link : (List<ContentDocumentLink>) getRelatedListLinks(
        recordId,
        includeEmails,
        minContentSize,
        fileTypeFilter,
        searchTerm
      )
    ) {
      if (link.ContentDocument.LatestPublishedVersionId != null) {
        versionIds.add(link.ContentDocument.LatestPublishedVersionId);
      }
    }
    return versionIds.size();
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
