/** Publishes uploads with user permissions. Binary SDK uploads never enter Apex heap. */
public with sharing class BetterFilesReactUpload {
  private static final Integer MAX_BYTES = 2097152;
  private static final Set<String> EXTENSIONS = new Set<String>{
    'pdf',
    'doc',
    'docx',
    'rtf',
    'txt',
    'xls',
    'xlsx',
    'csv',
    'ppt',
    'pptx',
    'jpg',
    'jpeg',
    'png',
    'gif',
    'zip'
  };

  @AuraEnabled
  public static Id uploadFile(String filename, String base64, Id recordId) {
    if (
      recordId == null ||
      String.isBlank(filename) ||
      filename.length() > 255 ||
      filename.contains('/') ||
      filename.contains('\\') ||
      !EXTENSIONS.contains(filename.substringAfterLast('.').toLowerCase())
    ) {
      throw new AuraHandledException(
        'Choose an allowed file with a valid filename and record.'
      );
    }
    if (String.isBlank(base64) || base64.length() > 2796204) {
      throw new AuraHandledException('Choose a non-empty file up to 2 MB.');
    }
    Blob contents;
    try {
      contents = EncodingUtil.base64Decode(base64);
    } catch (Exception e) {
      throw new AuraHandledException('Unable to read the file data.');
    }
    if (contents.size() == 0 || contents.size() > MAX_BYTES) {
      throw new AuraHandledException('Choose a non-empty file up to 2 MB.');
    }
    ContentVersion version = new ContentVersion(
      Title = filename,
      PathOnClient = filename,
      VersionData = contents,
      FirstPublishLocationId = recordId
    );
    try {
      insert as user version;
    } catch (DmlException e) {
      AuraHandledException failure = new AuraHandledException(
        e.getDmlMessage(0)
      );
      failure.setMessage(e.getDmlMessage(0));
      throw failure;
    }
    return version.Id;
  }
  @AuraEnabled
  public static Id completeUpload(
    String filename,
    Id contentBodyId,
    Id recordId
  ) {
    if (
      recordId == null ||
      contentBodyId == null ||
      contentBodyId.getSObjectType() != ContentBody.SObjectType ||
      String.isBlank(filename) ||
      filename.length() > 255 ||
      filename.contains('/') ||
      filename.contains('\\') ||
      !EXTENSIONS.contains(filename.substringAfterLast('.').toLowerCase())
    ) {
      throw new AuraHandledException(
        'Choose an allowed file with a valid filename and record.'
      );
    }
    ContentVersion version = new ContentVersion(
      Title = filename,
      PathOnClient = filename,
      ContentBodyId = contentBodyId,
      FirstPublishLocationId = recordId
    );
    Savepoint checkpoint = Database.setSavepoint();
    try {
      insert as user version;
    } catch (DmlException e) {
      AuraHandledException failure = new AuraHandledException(
        e.getDmlMessage(0)
      );
      failure.setMessage(e.getDmlMessage(0));
      throw failure;
    }
    ContentVersion saved = [
      SELECT ContentSize
      FROM ContentVersion
      WHERE Id = :version.Id
      WITH USER_MODE
    ];
    if (saved.ContentSize == 0 || saved.ContentSize > 104857600) {
      Database.rollback(checkpoint);
      throw new AuraHandledException('Choose a non-empty file up to 100 MB.');
    }
    return version.Id;
  }
}
