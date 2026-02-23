const Model = require('objection').Model

module.exports = class PageNotificationSettings extends Model {
  static get tableName () { return 'pageNotificationSettings' }

  $beforeInsert () {
    const now = new Date().toISOString()
    this.createdAt = now
    this.updatedAt = now
  }

  $beforeUpdate () {
    this.updatedAt = new Date().toISOString()
  }
}
