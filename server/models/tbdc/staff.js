const Model = require('objection').Model

class TBDCStaff extends Model {
  static get tableName() { return 'tbdc_staff' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['name', 'email', 'role'],
      properties: {
        id: {type: 'integer'},
        name: {type: 'string'},
        email: {type: 'string'},
        role: {type: 'string'}, // CS, IMPLANTADOR
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
}

module.exports = TBDCStaff
