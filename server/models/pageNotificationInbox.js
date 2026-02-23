const Model = require('objection').Model

module.exports = class PageNotificationInbox extends Model {
  static get tableName () { return 'pageNotificationInbox' }

  static get relationMappings () {
    return {
      event: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pageNotificationEvents'),
        join: {
          from: 'pageNotificationInbox.eventId',
          to: 'pageNotificationEvents.id'
        }
      }
    }
  }

  $beforeInsert () {
    if (!this.createdAt) {
      this.createdAt = new Date().toISOString()
    }
  }
}
