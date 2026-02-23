const Model = require('objection').Model

module.exports = class DashboardHomeSettings extends Model {
  static get tableName () { return 'dashboardHomeSettings' }

  static get jsonAttributes () {
    return ['quickLinks']
  }

  $beforeInsert () {
    const now = new Date().toISOString()
    this.createdAt = now
    this.updatedAt = now
  }

  $beforeUpdate () {
    this.updatedAt = new Date().toISOString()
  }
}
