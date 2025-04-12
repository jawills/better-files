public with sharing class FileListController {
  @AuraEnabled(cacheable=true)
  public static List<ContentVersion> getPartialFiles(Id recordId) {
    return getFiles(recordId, 6);
  }

  @AuraEnabled(cacheable=true)
  public static List<ContentVersion> getFiles(Id recordId, Integer fileLimit) {
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
    return new ContentVersionQuery()
      .byId(cvIds)
      .orderBy('ContentDocument.LastModifiedDate DESC')
      .withLimit(fileLimit)
      .getList();
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
    String query =
      'SELECT Id, Name FROM ' +
      objectAPIName +
      ' WHERE Id = \'' +
      String.escapeSingleQuotes(recordId) +
      '\'';
    try {
      SObject record = Database.query(query);
      return (String) record.get('Name');
    } catch (Exception e) {
      System.debug(e);
    }
    return '';
  }

  /*
   * @method uploadFile()
   * @desc Creates a content version from a given file's base64 and name
   *
   * @param {String} base64 - base64 string that represents the file
   * @param {String} filename - full file name with extension, i.e. 'products.csv'
   * @param {String} recordId - Id of the record you want to attach this file to
   *
   * @return {ContentVersion} - returns the created ContentDocumentLink Id if the
   *   upload was successful, otherwise returns null
   */
  @AuraEnabled
  public static String uploadFile(
    String base64,
    String filename,
    String recordId
  ) {
    ContentVersion cv = createContentVersion(base64, filename);
    ContentDocumentLink cdl = createContentLink(cv.Id, recordId);
    if (cv == null || cdl == null) {
      return null;
    }
    return cdl.Id;
  }
  /*
   * @method createContentVersion() [private]
   * @desc Creates a content version from a given file's base64 and name
   *
   * @param {String} base64 - base64 string that represents the file
   * @param {String} filename - full file name with extension, i.e. 'products.csv'
   *
   * @return {ContentVersion} - returns the newly created ContentVersion, or null
   *   if there was an error inserting the record
   */
  private static ContentVersion createContentVersion(
    String base64,
    String filename
  ) {
    ContentVersion cv = new ContentVersion();
    cv.VersionData = EncodingUtil.base64Decode(base64);
    cv.Title = filename;
    cv.PathOnClient = filename;
    try {
      insert cv;
      return cv;
    } catch (DMLException e) {
      System.debug(e);
      return null;
    }
  }

  /*
   * @method createContentLink() [private]
   * @desc Creates a content link for a given ContentVersion and record
   *
   * @param {String} contentVersionId - Id of the ContentVersion of the file
   * @param {String} recordId - Id of the record you want to attach this file to
   *
   * @return {ContentDocumentLink} - returns the newly created ContentDocumentLink,
   *   or null if there was an error inserting the record
   */
  private static ContentDocumentLink createContentLink(
    String contentVersionId,
    String recordId
  ) {
    if (contentVersionId == null || recordId == null) {
      return null;
    }
    ContentDocumentLink cdl = new ContentDocumentLink();
    cdl.ContentDocumentId = [
      SELECT ContentDocumentId
      FROM ContentVersion
      WHERE Id = :contentVersionId
    ]
    .ContentDocumentId;
    cdl.LinkedEntityId = recordId;
    // ShareType is either 'V', 'C', or 'I'
    // V = Viewer, C = Collaborator, I = Inferred
    cdl.ShareType = 'V';
    try {
      insert cdl;
      return cdl;
    } catch (DMLException e) {
      System.debug(e);
      return null;
    }
  }
}
