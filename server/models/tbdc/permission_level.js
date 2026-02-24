const Model = require('objection').Model

class TBDCPermissionLevel extends Model {
  static get tableName () { return 'tbdc_permission_levels' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['code', 'label', 'color'],
      properties: {
        id: { type: 'integer' },
        code: { type: 'string' },
        label: { type: 'string' },
        description: { type: ['string', 'null'] },
        color: { type: 'string' },
        order: { type: 'integer' },
        isActive: { type: 'boolean' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    }
  }

  $beforeInsert () {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  $beforeUpdate () {
    this.updatedAt = new Date().toISOString()
  }
}

module.exports = TBDCPermissionLevel
