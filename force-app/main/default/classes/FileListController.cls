public with sharing class FileListController {
  @AuraEnabled(cacheable=true)
  public static List<ContentVersion> getFiles(Id recordId) {
    List<ContentDocumentLink> cdls = new ContentDocumentLinkQuery()
      .byLinkedEntityId(recordId)
      .withLimit(25)
      .getList();
    // Can't use collection api b/c nested relationship
    Set<Id> cvIds = new Set<Id>();
    for (ContentDocumentLink cdl : cdls) {
      cvIds.add(cdl.ContentDocument.LatestPublishedVersionId);
    }
    return new ContentVersionQuery().byId(cvIds).withLimit(25).getList();
  }
}
