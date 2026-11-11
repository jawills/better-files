@IsTest
private class BetterFilesReactUploadTest {
  @IsTest
  static void createsFileLinkedToRecord() {
    Account record = new Account(Name = 'React upload test');
    insert record;
    Test.startTest();
    Id versionId = BetterFilesReactUpload.uploadFile(
      'test.txt',
      EncodingUtil.base64Encode(Blob.valueOf('Upload test')),
      record.Id
    );
    Test.stopTest();
    ContentVersion version = [
      SELECT ContentDocumentId, VersionData
      FROM ContentVersion
      WHERE Id = :versionId
    ];
    System.assertEquals('Upload test', version.VersionData.toString());
    System.assertEquals(
      1,
      [
        SELECT COUNT()
        FROM ContentDocumentLink
        WHERE
          LinkedEntityId = :record.Id
          AND ContentDocumentId = :version.ContentDocumentId
      ]
    );
  }

  @IsTest
  static void acceptsTheTwoMegabyteBoundary() {
    Account record = new Account(Name = 'React size boundary test');
    insert record;
    // Construct encoded data directly so the test does not retain another 2 MB blob.
    String payload = 'eHh4'.repeat(699050) + 'eHg=';
    Test.startTest();
    Id versionId = BetterFilesReactUpload.uploadFile(
      'boundary.txt',
      payload,
      record.Id
    );
    Test.stopTest();
    System.assertEquals(
      2097152,
      [SELECT ContentSize FROM ContentVersion WHERE Id = :versionId].ContentSize
    );
  }

  @IsTest
  static void rejectsInvalidFileWithoutCreatingAnything() {
    Account record = new Account(Name = 'React validation test');
    insert record;
    for (
      String filename : new List<String>{
        'unsafe.html',
        '../test.txt',
        'empty.txt'
      }
    ) {
      Boolean rejected = false;
      try {
        BetterFilesReactUpload.uploadFile(
          filename,
          filename == 'empty.txt' ? '' : 'dGVzdA==',
          record.Id
        );
      } catch (AuraHandledException e) {
        rejected = true;
      }
      System.assert(rejected, 'Invalid file must be rejected');
    }
    System.assertEquals(
      0,
      [
        SELECT COUNT()
        FROM ContentDocumentLink
        WHERE LinkedEntityId = :record.Id
      ]
    );
  }
  @IsTest
  static void rejectsAnAlreadyPublishedBody() {
    Account record = new Account(Name = 'SDK upload test');
    insert record;
    ContentVersion original = new ContentVersion(
      Title = 'Body fixture',
      PathOnClient = 'body.txt',
      VersionData = Blob.valueOf('SDK binary body')
    );
    insert original;
    Id bodyId = [
      SELECT ContentBodyId
      FROM ContentVersion
      WHERE Id = :original.Id
    ]
    .ContentBodyId;
    // Apex cannot create an unpublished upload body. The real SDK flow is verified in the development org.
    Boolean rejected = false;
    Test.startTest();
    try {
      BetterFilesReactUpload.completeUpload('uploaded.txt', bodyId, record.Id);
    } catch (AuraHandledException e) {
      rejected = true;
      System.assert(e.getMessage().contains('content bodies'));
    }
    Test.stopTest();
    System.assert(rejected, 'A published body must not be reusable');
    System.assertEquals(
      0,
      [
        SELECT COUNT()
        FROM ContentDocumentLink
        WHERE LinkedEntityId = :record.Id
      ]
    );
  }

  @IsTest
  static void rejectsInvalidUploadBody() {
    Account record = new Account(Name = 'Invalid SDK upload test');
    insert record;
    Boolean rejected = false;
    try {
      BetterFilesReactUpload.completeUpload('test.txt', record.Id, record.Id);
    } catch (AuraHandledException e) {
      rejected = true;
    }
    System.assert(rejected);
    System.assertEquals(
      0,
      [
        SELECT COUNT()
        FROM ContentDocumentLink
        WHERE LinkedEntityId = :record.Id
      ]
    );
  }
}
