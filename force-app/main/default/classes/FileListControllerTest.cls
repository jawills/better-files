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

    String largeBody = '';
    for (Integer i = 0; i < 3000; i++) {
      largeBody += 'X';
    }
    ContentVersion largeCv = new ContentVersion(
      Title = 'Test Big',
      PathOnClient = 'Big.bin',
      VersionData = Blob.valueOf(largeBody),
      IsMajorVersion = true
    );
    insert largeCv;
    ContentVersion insertedLarge = [
      SELECT ContentDocumentId
      FROM ContentVersion
      WHERE Id = :largeCv.Id
    ];
    insert new ContentDocumentLink(
      ContentDocumentId = insertedLarge.ContentDocumentId,
      LinkedEntityId = acc.Id,
      ShareType = 'V'
    );
  }
  @isTest
  static void testFileCount() {
    Account acc = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    Integer fileCount = FileListController.getFileCount(acc.Id, false, null, null);
    System.assertEquals(2, fileCount, 'Incorrect file count recieved');
  }

  @isTest
  static void testPartialFile() {
    Account acc = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    List<FileListController.FileRow> fileRows = FileListController.getFiles(
      acc.Id,
      25,
      0,
      false,
      null,
      null
    );
    System.assertEquals(2, fileRows.size(), 'Incorrect file count recieved');
    for (FileListController.FileRow row : fileRows) {
      System.assertEquals(acc.Id, row.linkedEntityId);
      System.assertNotEquals(null, row.version);
      System.assertEquals(
        false,
        row.version.getPopulatedFieldsAsMap().containsKey('VersionData'),
        'Listing files must not query VersionData or large files blow the heap limit'
      );
      System.assertNotEquals(
        null,
        row.version.ContentDocument.OwnerId,
        'Owner should be populated on ContentDocument'
      );
    }
  }

  @isTest
  static void testDeleteFile() {
    Account acc = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    List<FileListController.FileRow> fileRows = FileListController.getFiles(
      acc.Id,
      25,
      0,
      false,
      null,
      null
    );

    for (FileListController.FileRow row : fileRows) {
      FileListController.deleteFile(row.version.ContentDocument.Id);
    }

    fileRows = FileListController.getFiles(acc.Id, 25, 0, false, null, null);
    System.assertEquals(0, fileRows.size(), 'File not deleted correctly');
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
    List<FileListController.FileRow> rows = FileListController.searchContentVersions(
      'Big',
      a.Id,
      false,
      null,
      null
    );
    System.assertEquals(1, rows.size(), 'Incorrect file size');
  }

  @isTest
  static void testMinimumContentSizeFilter() {
    Account acc = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    List<FileListController.FileRow> allFiles = FileListController.getFiles(
      acc.Id,
      25,
      0,
      false,
      null,
      null
    );
    System.assertEquals(2, allFiles.size(), 'Setup should have two files');

    List<FileListController.FileRow> largeOnly = FileListController.getFiles(
      acc.Id,
      25,
      0,
      false,
      100,
      null
    );
    System.assertEquals(1, largeOnly.size(), 'Small file should be excluded');
    System.assertEquals(
      'Test Big',
      largeOnly[0].version.ContentDocument.Title,
      'Larger file should remain'
    );

    Integer filteredCount = FileListController.getFileCount(acc.Id, false, 100, null);
    System.assertEquals(1, filteredCount, 'Count should match filtered list');

    List<FileListController.FileRow> searchLarge = FileListController.searchContentVersions(
      'test',
      acc.Id,
      false,
      100,
      null
    );
    System.assertEquals(
      1,
      searchLarge.size(),
      'Search should respect minimum size'
    );
  }

  @isTest
  static void testFileTypeFilter() {
    Account acc = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];

    List<FileListController.FileRow> images = FileListController.getFiles(
      acc.Id,
      25,
      0,
      false,
      null,
      'image'
    );
    System.assertEquals(1, images.size(), 'Only the jpg file should match image filter');
    System.assertEquals(
      'jpg',
      images[0].version.ContentDocument.FileExtension,
      'Image filter should return the jpg file'
    );

    List<FileListController.FileRow> documents = FileListController.getFiles(
      acc.Id,
      25,
      0,
      false,
      null,
      'document'
    );
    System.assertEquals(0, documents.size(), 'No document extensions in setup');

    Integer imageCount = FileListController.getFileCount(
      acc.Id,
      false,
      null,
      'image'
    );
    System.assertEquals(1, imageCount, 'Image count should match filtered list');

    List<FileListController.FileRow> searchImages = FileListController.searchContentVersions(
      'test',
      acc.Id,
      false,
      null,
      'image'
    );
    System.assertEquals(
      1,
      searchImages.size(),
      'Search should respect image file type filter'
    );
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
    List<FileListController.FileRow> files = FileListController.getFiles(
      testCase.Id,
      25,
      0,
      true, // includeEmails = true
      null,
      null
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
    Integer fileCount = FileListController.getFileCount(testCase.Id, true, null, null);
    System.assertEquals(
      0,
      fileCount,
      'File count is 0 because Attachment is not a ContentDocumentLink (controller only queries ContentDocumentLink)'
    );

    // Test that getFiles with includeEmails=false does NOT return the email attachment
    List<FileListController.FileRow> filesWithoutEmails = FileListController.getFiles(
      testCase.Id,
      25,
      0,
      false, // includeEmails = false
      null,
      null
    );
    System.assertEquals(
      0,
      filesWithoutEmails.size(),
      'Email attachment should not be returned when includeEmails is false'
    );

    // Test that getFileCount with includeEmails=false does NOT include the email attachment
    Integer fileCountWithoutEmails = FileListController.getFileCount(
      testCase.Id,
      false,
      null,
      null
    );
    System.assertEquals(
      0,
      fileCountWithoutEmails,
      'File count should not include email attachment when includeEmails is false'
    );
  }

  @isTest
  static void reproducesDuplicateCountWhenEmailIncluded() {
    Case parentCase = new Case(
      Subject = 'Duplicate Email Attachment Count Repro',
      Status = 'New'
    );
    insert parentCase;

    EmailMessage emailMsg = new EmailMessage(
      RelatedToId = parentCase.Id,
      Subject = 'Email with same linked file',
      TextBody = 'Used for duplicate count reproduction',
      FromAddress = 'sender@example.com',
      ToAddress = 'recipient@example.com',
      Status = '3',
      MessageDate = System.now(),
      Incoming = false
    );
    insert emailMsg;

    ContentVersion contentVersionInsert = new ContentVersion(
      Title = 'SharedAttachment',
      PathOnClient = 'SharedAttachment.pdf',
      VersionData = Blob.valueOf('duplicate count repro'),
      IsMajorVersion = true
    );
    insert contentVersionInsert;

    ContentVersion insertedVersion = [
      SELECT Id, ContentDocumentId
      FROM ContentVersion
      WHERE Id = :contentVersionInsert.Id
    ];

    insert new ContentDocumentLink(
      ContentDocumentId = insertedVersion.ContentDocumentId,
      LinkedEntityId = parentCase.Id,
      ShareType = 'V'
    );

    insert new ContentDocumentLink(
      ContentDocumentId = insertedVersion.ContentDocumentId,
      LinkedEntityId = emailMsg.Id,
      ShareType = 'V'
    );

    // Ensure EmailMessageQuery.hasAttatchment() includes this email in getEmailMessageIds().
    insert new Attachment(
      ParentId = emailMsg.Id,
      Name = 'EmailMarkerAttachment.txt',
      Body = Blob.valueOf('marker'),
      ContentType = 'text/plain'
    );

    Test.startTest();
    List<FileListController.FileRow> files = FileListController.getFiles(
      parentCase.Id,
      25,
      0,
      true,
      null,
      null
    );
    Integer fileCount = FileListController.getFileCount(parentCase.Id, true, null, null);
    Test.stopTest();

    System.assertEquals(
      1,
      files.size(),
      'getFiles should dedupe identical ContentDocument links to one file'
    );
    System.assertEquals(
      1,
      fileCount,
      'getFileCount should dedupe identical ContentDocument links to one unique file count'
    );
    System.assertEquals(
      emailMsg.Id,
      files[0].linkedEntityId,
      'When linked to both parent and email, prefer EmailMessage link'
    );

    insert new ContentVersion(
      Title = 'Z Last File',
      PathOnClient = 'Last.pdf',
      VersionData = Blob.valueOf('another file'),
      FirstPublishLocationId = parentCase.Id
    );
    List<FileListController.FileRow> firstPage = FileListController.getRelatedListFiles(
      parentCase.Id,
      1,
      0,
      true,
      null,
      null,
      null,
      'Title',
      'asc'
    );
    List<FileListController.FileRow> secondPage = FileListController.getRelatedListFiles(
      parentCase.Id,
      1,
      1,
      true,
      null,
      null,
      null,
      'Title',
      'asc'
    );
    System.assertEquals(
      'SharedAttachment',
      firstPage[0].version.ContentDocument.Title
    );
    System.assertEquals(emailMsg.Id, firstPage[0].linkedEntityId);
    System.assertEquals(
      'Z Last File',
      secondPage[0].version.ContentDocument.Title,
      'Duplicate links must not consume pagination slots'
    );
    System.assertEquals(
      2,
      FileListController.getRelatedListFileCount(
        parentCase.Id,
        true,
        null,
        null,
        null
      )
    );

    ContentVersion emailOnly = new ContentVersion(
      Title = 'Email only',
      PathOnClient = 'Email.csv',
      VersionData = Blob.valueOf('email data')
    );
    insert emailOnly;
    emailOnly = [
      SELECT ContentDocumentId
      FROM ContentVersion
      WHERE Id = :emailOnly.Id
    ];
    insert new ContentDocumentLink(
      ContentDocumentId = emailOnly.ContentDocumentId,
      LinkedEntityId = emailMsg.Id,
      ShareType = 'V'
    );
    System.assertEquals(
      new List<String>{ 'pdf' },
      FileListController.getRelatedListFileExtensions(
        parentCase.Id,
        false,
        null
      )
    );
    System.assertEquals(
      new List<String>{ 'csv', 'pdf' },
      FileListController.getRelatedListFileExtensions(
        parentCase.Id,
        true,
        null
      ),
      'Include email-only types and deduplicate files linked to both record and email'
    );
    System.assertEquals(
      1,
      FileListController.getRelatedListFileCount(
        parentCase.Id,
        true,
        null,
        'extension:csv',
        null
      )
    );
  }

  @isTest
  static void testRelatedListSortAcrossPages() {
    Account account = new Account(Name = 'Sorted Files');
    insert account;
    List<ContentVersion> versions = new List<ContentVersion>();
    String body = '';
    for (Integer i = 26; i >= 0; i--) {
      body += 'X';
      versions.add(
        new ContentVersion(
          Title = 'Sort ' + ('0' + i).right(2),
          PathOnClient = 'Sort.txt',
          VersionData = Blob.valueOf(body),
          FirstPublishLocationId = account.Id
        )
      );
    }
    insert versions;

    Test.startTest();
    List<FileListController.FileRow> firstPage = FileListController.getRelatedListFiles(
      account.Id,
      25,
      0,
      false,
      null,
      null,
      null,
      'Title',
      'asc'
    );
    List<FileListController.FileRow> secondPage = FileListController.getRelatedListFiles(
      account.Id,
      25,
      1,
      false,
      null,
      null,
      null,
      'Title',
      'asc'
    );
    List<FileListController.FileRow> descending = FileListController.getRelatedListFiles(
      account.Id,
      25,
      0,
      false,
      null,
      null,
      null,
      'Title',
      'desc'
    );
    List<FileListController.FileRow> bySize = FileListController.getRelatedListFiles(
      account.Id,
      25,
      0,
      false,
      null,
      null,
      null,
      'ContentSize',
      'asc'
    );
    List<FileListController.FileRow> filtered = FileListController.getRelatedListFiles(
      account.Id,
      25,
      0,
      false,
      5,
      'document',
      'Sort 2',
      'Title',
      'desc'
    );
    Integer count = FileListController.getRelatedListFileCount(
      account.Id,
      false,
      5,
      'document',
      'Sort 2'
    );
    Test.stopTest();

    System.assertEquals(25, firstPage.size());
    System.assertEquals(2, secondPage.size());
    System.assertEquals('Sort 00', firstPage[0].version.ContentDocument.Title);
    System.assertEquals('Sort 24', firstPage[24].version.ContentDocument.Title);
    System.assertEquals('Sort 25', secondPage[0].version.ContentDocument.Title);
    System.assertEquals('Sort 26', secondPage[1].version.ContentDocument.Title);
    System.assertEquals('Sort 26', descending[0].version.ContentDocument.Title);
    System.assertEquals('Sort 26', bySize[0].version.ContentDocument.Title);
    System.assertEquals(1, bySize[0].version.ContentDocument.ContentSize);
    System.assertEquals(
      2,
      bySize[1].version.ContentDocument.ContentSize,
      'File sizes must sort numerically, not as formatted strings'
    );
    System.assertEquals(
      3,
      count,
      'Search, type, and size filters must match the count'
    );
    System.assertEquals(count, filtered.size());
    System.assertEquals('Sort 22', filtered[0].version.ContentDocument.Title);
  }

  @isTest
  static void testRelatedListSortTiesAndInvalidInput() {
    Account account = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    List<ContentVersion> expected = [
      SELECT Id
      FROM ContentVersion
      ORDER BY Id ASC
    ];
    Test.startTest();
    // Both files have the same owner and modifier. The Id tie-breaker must
    // produce stable, non-overlapping pages in either direction.
    for (String field : new List<String>{ 'Owner', 'LastModifiedBy' }) {
      for (String direction : new List<String>{ 'asc', 'desc' }) {
        List<FileListController.FileRow> first = FileListController.getRelatedListFiles(
          account.Id,
          1,
          0,
          false,
          null,
          null,
          null,
          field,
          direction
        );
        List<FileListController.FileRow> second = FileListController.getRelatedListFiles(
          account.Id,
          1,
          1,
          false,
          null,
          null,
          null,
          field,
          direction
        );
        System.assertEquals(expected[0].Id, first[0].version.Id);
        System.assertEquals(expected[1].Id, second[0].version.Id);
      }
    }
    List<FileListController.FileRow> defaultSort = FileListController.getRelatedListFiles(
      account.Id,
      25,
      0,
      false,
      null,
      null,
      null,
      'LastModifiedDate',
      'desc'
    );
    List<FileListController.FileRow> invalidSort = FileListController.getRelatedListFiles(
      account.Id,
      25,
      0,
      false,
      null,
      null,
      null,
      'Title LIMIT 1',
      'ASC LIMIT 1'
    );
    List<FileListController.FileRow> omittedSort = FileListController.getRelatedListFiles(
      account.Id,
      null,
      null,
      false,
      null,
      null,
      null,
      null,
      null
    );
    Test.stopTest();
    System.assertEquals(2, invalidSort.size());
    System.assertEquals(defaultSort[0].version.Id, invalidSort[0].version.Id);
    System.assertEquals(defaultSort[0].version.Id, omittedSort[0].version.Id);
  }

  @isTest
  static void testAvailableFileExtensions() {
    Account account = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    Account other = new Account(Name = 'Other record');
    insert other;
    insert new ContentVersion(
      Title = 'Unrelated',
      PathOnClient = 'Unrelated.csv',
      VersionData = Blob.valueOf('data'),
      FirstPublishLocationId = other.Id
    );
    Test.startTest();
    System.assertEquals(
      new List<String>{ 'bin', 'jpg' },
      FileListController.getRelatedListFileExtensions(account.Id, false, null),
      'Only extensions linked to this record should be offered'
    );
    System.assertEquals(
      new List<String>{ 'bin' },
      FileListController.getRelatedListFileExtensions(account.Id, false, 100),
      'Types below the minimum size should be excluded'
    );
    System.assertEquals(
      new List<String>(),
      FileListController.getRelatedListFileExtensions(account.Id, false, 10000)
    );
    Test.stopTest();
  }

  @isTest
  static void testExactExtensionFiltersAcrossPages() {
    Account account = [SELECT Id FROM Account WHERE Name = 'Test 1Sync File'];
    List<ContentVersion> versions = new List<ContentVersion>();
    for (Integer i = 0; i < 27; i++) {
      versions.add(
        new ContentVersion(
          Title = 'PDF ' + ('0' + i).right(2),
          PathOnClient = 'File.PDF',
          VersionData = Blob.valueOf('PDF data'),
          FirstPublishLocationId = account.Id
        )
      );
    }
    versions.add(
      new ContentVersion(
        Title = 'No extension',
        PathOnClient = 'README',
        VersionData = Blob.valueOf('data'),
        FirstPublishLocationId = account.Id
      )
    );
    versions.add(
      new ContentVersion(
        Title = 'Category name',
        PathOnClient = 'File.image',
        VersionData = Blob.valueOf('data'),
        FirstPublishLocationId = account.Id
      )
    );
    insert versions;
    Test.startTest();
    System.assertEquals(
      new List<String>{ '', 'bin', 'image', 'jpg', 'pdf' },
      FileListController.getRelatedListFileExtensions(account.Id, false, null),
      'Types must be unique, normalized, and include files beyond the first page'
    );
    List<FileListController.FileRow> firstPage = FileListController.getRelatedListFiles(
      account.Id,
      25,
      0,
      false,
      null,
      'extension:pdf',
      null,
      'Title',
      'asc'
    );
    List<FileListController.FileRow> secondPage = FileListController.getRelatedListFiles(
      account.Id,
      25,
      1,
      false,
      null,
      'extension:pdf',
      null,
      'Title',
      'asc'
    );
    System.assertEquals(25, firstPage.size());
    System.assertEquals(2, secondPage.size());
    System.assertEquals('PDF 25', secondPage[0].version.ContentDocument.Title);
    System.assertEquals(
      27,
      FileListController.getRelatedListFileCount(
        account.Id,
        false,
        null,
        'extension:pdf',
        null
      )
    );
    List<FileListController.FileRow> searched = FileListController.getRelatedListFiles(
      account.Id,
      25,
      0,
      false,
      null,
      'extension:pdf',
      'PDF 26',
      'Title',
      'asc'
    );
    System.assertEquals(1, searched.size());
    System.assertEquals(
      searched.size(),
      FileListController.getRelatedListFileCount(
        account.Id,
        false,
        null,
        'extension:pdf',
        'PDF 26'
      )
    );
    System.assertEquals(
      0,
      FileListController.getRelatedListFileCount(
        account.Id,
        false,
        100,
        'extension:pdf',
        null
      )
    );
    System.assertEquals(
      1,
      FileListController.getRelatedListFileCount(
        account.Id,
        false,
        null,
        'extension:',
        null
      ),
      'Extensionless files can be selected'
    );
    System.assertEquals(
      1,
      FileListController.getRelatedListFileCount(
        account.Id,
        false,
        null,
        'extension:image',
        null
      ),
      'An exact extension must not be interpreted as the Images category'
    );
    System.assertEquals(
      0,
      FileListController.getRelatedListFileCount(
        account.Id,
        false,
        null,
        'extension:pdf\' OR Id != null',
        null
      ),
      'Extension values must be bound, not inserted into SOQL'
    );
    Test.stopTest();
  }

  @isTest
  static void testRelatedListConfigDefaults() {
    FileListController.RelatedListConfig config = FileListController.getRelatedListConfig();
    System.assertEquals(true, config.showOwner, 'Owner column on by default');
    System.assertEquals(
      true,
      config.showLastModifiedDate,
      'Last Modified Date on by default'
    );
    System.assertEquals(
      true,
      config.showLastModifiedBy,
      'Last Modified By on by default'
    );
    System.assertEquals(true, config.showFileSize, 'File Size on by default');
    System.assertEquals(
      'Basic',
      config.filterMode,
      'Existing filters are the default'
    );
  }
}
