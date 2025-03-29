public with sharing class FileListController {
  @AuraEnabled(cacheable=true)
  public static List<ContentVersion> getFiles(Id recordId) {
    List<ContentDocumentLink> cdls = new ContentDocumentLinkQuery()
      .byLinkedEntityId(recordId)
      .withLimit(6)
      .getList();
    // Can't use collection api b/c nested relationship
    Set<Id> cvIds = new Set<Id>();
    for (ContentDocumentLink cdl : cdls) {
      cvIds.add(cdl.ContentDocument.LatestPublishedVersionId);
    }
    // @TODO order by created / last modified date
    return new ContentVersionQuery().byId(cvIds).withLimit(25).getList();
  }
}
