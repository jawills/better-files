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
    Integer fileCount = FileListController.getFileCount(acc.Id, false);
    System.assertEquals(1, fileCount, 'Incorrect file count recieved');
  }

  @isTest
  static void testPartialFile() {
    Account acc = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    List<ContentVersion> fileVersions = FileListController.getFiles(
      acc.Id,
      25,
      0,
      false
    );
    System.assertEquals(
      1,
      fileVersions.size(),
      'Incorrect file count recieved'
    );
  }

  @isTest
  static void testDeleteFile() {
    Account acc = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    List<ContentVersion> fileVersions = FileListController.getFiles(
      acc.Id,
      25,
      0,
      false
    );

    for (ContentVersion cv : fileVersions) {
      FileListController.deleteFile(cv.ContentDocumentId);
    }

    fileVersions = FileListController.getFiles(acc.Id, 25, 0, false);
    System.assertEquals(0, fileVersions.size(), 'File not deleted correctly');
  }

  @isTest
  static void testGetRecordName() {
    Account a = [SELECT Id, Name FROM Account WHERE Name = 'Test 1Sync File'];
    String accountName = FileListController.getRecordName(a.Id, 'Account');
    System.assertEquals(
      a.Name,
      accountName,
      'Could not get the account name correctly.'
    );
  }

  @isTest
  static void testUploadFile() {
    Account a = [SELECT Id, Name FROM Account WHERE Name = 'Test 1Sync File'];
    String contentDocumentId = FileListController.uploadFile(
      'base64',
      'File Name',
      a.Id
    );
    System.assert(
      contentDocumentId != null,
      'Could not create content document successfully'
    );
  }

  @isTest
  static void testFileSearch() {
    Account a = [SELECT Id, Name FROM Account WHERE Name = 'Test 1Sync File'];
    List<ContentVersion> cvs = FileListController.searchContentVersions(
      'test',
      a.Id,
      false
    );
    System.assertEquals(1, cvs.size(), 'Incorrect file size');
  }

  @isTest
  static void testEmailMessageAttachments() {
    // Create a Case
    Case testCase = new Case(
      Subject = 'Test Case for Email Attachments',
      Status = 'New'
    );
    insert testCase;

    // Create an EmailMessage related to the Case
    // Note: EmailMessage requires specific fields and may have sharing restrictions
    // EmailMessage visibility is typically based on access to the RelatedToId (Case)
    // Since we're creating the Case in the test, the test user should have access
    EmailMessage emailMsg = new EmailMessage(
      RelatedToId = testCase.Id,
      Subject = 'Test Email with Attachment',
      TextBody = 'This is a test email',
      FromAddress = 'test@example.com',
      ToAddress = 'recipient@example.com',
      Status = '3', // Sent
      MessageDate = System.now(),
      Incoming = false
    );
    insert emailMsg;
    
    // Create an Attachment linked to the EmailMessage
    // According to https://salesforce.stackexchange.com/questions/224690/how-to-create-an-emailmessage-record-with-dml-having-hasattachment-to-be-true
    // Setting ParentId to EmailMessage.Id will make HasAttachment = true on the EmailMessage
    Attachment emailAttachment = new Attachment(
      ParentId = emailMsg.Id,
      Name = 'EmailAttachment.pdf',
      Body = Blob.valueOf('Test Email Attachment Data'),
      ContentType = 'application/pdf'
    );
    insert emailAttachment;

    // Verify the Attachment was created successfully
    List<Attachment> createdAttachments = [
      SELECT Id, Name, ParentId
      FROM Attachment
      WHERE ParentId = :emailMsg.Id
      WITH USER_MODE
    ];
    System.assertEquals(
      1,
      createdAttachments.size(),
      'Attachment should be created and queryable'
    );

    // Verify HasAttachment is true on the EmailMessage
    // According to the Stack Overflow solution, using Attachment with ParentId set to EmailMessage.Id
    // will automatically set HasAttachment = true
    EmailMessage updatedEmailMsg = [
      SELECT Id, HasAttachment, RelatedToId
      FROM EmailMessage
      WHERE Id = :emailMsg.Id
      WITH USER_MODE
    ];
    System.assertEquals(
      true,
      updatedEmailMsg.HasAttachment,
      'HasAttachment should be true after creating Attachment with ParentId set to EmailMessage.Id'
    );
    
    // Verify the EmailMessage can be queried using the same query as the controller
    // Using Attachment (instead of ContentDocumentLink) makes HasAttachment = true
    // which allows the EmailMessage to be found by the hasAttatchment() query
    List<EmailMessage> queryableEmails = new EmailMessageQuery()
      .byRelationId(testCase.Id)
      .hasAttatchment()
      .asUser()
      .getList();
    
    System.assert(
      queryableEmails.size() > 0,
      'EmailMessage should be found by hasAttatchment() query when HasAttachment is true'
    );

    // Note: The controller queries ContentDocumentLink records, not Attachment records
    // So even though HasAttachment = true and the EmailMessage is found,
    // the controller won't return the Attachment as a file since it only looks for ContentDocumentLink
    // This test verifies that HasAttachment works correctly with Attachment objects
    
    // Test that getFiles with includeEmails=true - EmailMessage will be found but no files returned
    // because Attachment records are not ContentDocumentLink records
    List<ContentVersion> files = FileListController.getFiles(
      testCase.Id,
      25,
      0,
      true // includeEmails = true
    );
    // The EmailMessage is found (HasAttachment = true), but no ContentDocumentLink exists,
    // so no files are returned
    System.assertEquals(
      0,
      files.size(),
      'No files returned because Attachment is not a ContentDocumentLink (controller only queries ContentDocumentLink)'
    );

    // Test that getFileCount with includeEmails=true
    // EmailMessage is found but no ContentDocumentLink exists, so count is 0
    Integer fileCount = FileListController.getFileCount(testCase.Id, true);
    System.assertEquals(
      0,
      fileCount,
      'File count is 0 because Attachment is not a ContentDocumentLink (controller only queries ContentDocumentLink)'
    );

    // Test that getFiles with includeEmails=false does NOT return the email attachment
    List<ContentVersion> filesWithoutEmails = FileListController.getFiles(
      testCase.Id,
      25,
      0,
      false // includeEmails = false
    );
    System.assertEquals(
      0,
      filesWithoutEmails.size(),
      'Email attachment should not be returned when includeEmails is false'
    );

    // Test that getFileCount with includeEmails=false does NOT include the email attachment
    Integer fileCountWithoutEmails = FileListController.getFileCount(
      testCase.Id,
      false
    );
    System.assertEquals(
      0,
      fileCountWithoutEmails,
      'File count should not include email attachment when includeEmails is false'
    );
  }
}
