/** Development upload transport. Creates the file and its record link atomically. */
public with sharing class BetterFilesReactUpload {
    private static final Integer MAX_BYTES = 2097152;
    private static final Set<String> EXTENSIONS = new Set<String>{
        'pdf', 'doc', 'docx', 'rtf', 'txt', 'xls', 'xlsx', 'csv',
        'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'zip'
    };

    @AuraEnabled
    public static Id uploadFile(String filename, String base64, Id recordId) {
        if (recordId == null || String.isBlank(filename) || filename.length() > 255 ||
            filename.contains('/') || filename.contains('\\') ||
            !EXTENSIONS.contains(filename.substringAfterLast('.').toLowerCase())) {
            throw new AuraHandledException('Choose an allowed file with a valid filename and record.');
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
            Title = filename, PathOnClient = filename, VersionData = contents,
            FirstPublishLocationId = recordId
        );
        try {
            insert as user version;
        } catch (DmlException e) {
            throw new AuraHandledException(e.getDmlMessage(0));
        }
        return version.Id;
    }
}
