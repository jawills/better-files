public with sharing class EmailMessageQuery extends QueryObject {
    public EmailMessageQuery() {
      super(
        new List<String>{ 'Id', 'RelatedToId' },
        EmailMessage.SObjectType
      );
    }
  
    public EmailMessageQuery byRelationId(Id relId) {
      return (EmailMessageQuery) byField(
        EmailMessage.RelatedToId,
        '=',
        relId
      );
    }
  
    public EmailMessageQuery hasAttatchment() {
      return (EmailMessageQuery) byField(
        'EmailMessage.HasAttachment',
        '=',
        true
      );
    }
  }
  