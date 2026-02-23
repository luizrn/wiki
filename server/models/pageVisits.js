const Model = require('objection').Model

module.exports = class PageVisits extends Model {
  static get tableName () { return 'pageVisits' }

  $beforeInsert () {
    if (!this.createdAt) {
      this.createdAt = new Date().toISOString()
    }
  }
}
