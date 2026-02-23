const Model = require('objection').Model

module.exports = class PageNotificationEvents extends Model {
  static get tableName () { return 'pageNotificationEvents' }

  static get relationMappings () {
    return {
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'pageNotificationEvents.pageId',
          to: 'pages.id'
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
