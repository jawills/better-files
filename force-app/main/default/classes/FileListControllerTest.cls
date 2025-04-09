@isTest
public with sharing class FileListControllerTest {
  @TestSetup
  static void makeData() {
    Account acc = new Account();
    acc.Name = 'Test 1Sync File';
    insert acc;

    ContentVersion contentVersionInsert = new ContentVersion(
      Title = 'Test',
      PathOnClient = 'Test.jpg',
      VersionData = Blob.valueOf('Test Data'),
      IsMajorVersion = true
    );
    insert contentVersionInsert;

    // Get ContentDocumentId from the ContentVersion
    ContentVersion insertedContentVersion = [
      SELECT Id, ContentDocumentId
      FROM ContentVersion
      WHERE Id = :contentVersionInsert.Id
    ];

    // Create ContentDocumentLink to link the document to the Account
    ContentDocumentLink contentDocumentLink = new ContentDocumentLink(
      ContentDocumentId = insertedContentVersion.ContentDocumentId,
      LinkedEntityId = acc.Id,
      ShareType = 'V' // V = Viewer, C = Collaborator, I = Inferred
    );
    insert contentDocumentLink;
  }
  @isTest
  static void testFileCount() {
    Account acc = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    Integer fileCount = FileListController.getFileCount(acc.Id);
    System.assertEquals(1, fileCount, 'Incorrect file count recieved');
  }

  @isTest
  static void testPartialFile() {
    Account acc = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    List<ContentVersion> fileVersions = FileListController.getFiles(acc.Id, 25);
    System.assertEquals(
      1,
      fileVersions.size(),
      'Incorrect file count recieved'
    );
  }

  @isTest
  static void testDeleteFile() {
    Account acc = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    List<ContentVersion> fileVersions = FileListController.getFiles(acc.Id, 25);

    for (ContentVersion cv : fileVersions) {
      FileListController.deleteFile(cv.ContentDocumentId);
    }

    fileVersions = FileListController.getFiles(acc.Id, 25);
    System.assertEquals(0, fileVersions.size(), 'File not deleted correctly');
  }
}
