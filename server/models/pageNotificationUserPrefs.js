const Model = require('objection').Model

module.exports = class PageNotificationUserPrefs extends Model {
  static get tableName () { return 'pageNotificationUserPrefs' }

  $beforeInsert () {
    const now = new Date().toISOString()
    this.createdAt = now
    this.updatedAt = now
  }

  $beforeUpdate () {
    this.updatedAt = new Date().toISOString()
  }
}
