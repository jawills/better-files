@isTest
public with sharing class ContentDocumentLinkQueryTest {
  @TestSetup
  static void testSetup() {
    ContentVersion contentVersionInsert = new ContentVersion(
      Title = 'Test',
      PathOnClient = 'Test.jpg',
      VersionData = Blob.valueOf('Test Data'),
      IsMajorVersion = true
    );
    insert contentVersionInsert;
  }

  @IsTest
  static void testSelectByLinkedEntityId() {
    ContentDocumentLinkQuery documents = new ContentDocumentLinkQuery()
      .byLinkedEntityId(UserInfo.getUserId())
      .getList();

    System.assertEquals(1, documents.size());
    System.assertEquals('Test', documents[0].LatestPublishedVersion.Title);
  }
}
