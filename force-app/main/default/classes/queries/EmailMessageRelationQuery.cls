public with sharing class EmailMessageRelationQuery extends QueryObject {
  public EmailMessageRelationQuery() {
    super(
      new List<String>{ 'Id', 'EmailMessageId' },
      EmailMessageRelation.SObjectType
    );
  }

  public EmailMessageRelationQuery byRelationId(Id relId) {
    return (EmailMessageRelationQuery) byField(
      EmailMessageRelation.RelationId,
      '=',
      relId
    );
  }

  public EmailMessageRelationQuery hasAttatchment() {
    return (EmailMessageRelationQuery) byField(
      'EmailMessageRelation.EmailMessage.HasAttachment',
      '=',
      true
    );
  }
}
