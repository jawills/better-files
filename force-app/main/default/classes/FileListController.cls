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
}
