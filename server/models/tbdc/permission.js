const Model = require('objection').Model

class TBDCPermission extends Model {
  static get tableName() { return 'tbdc_permissions' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['companyId', 'moduleId', 'ruleName', 'level'],
      properties: {
        id: {type: 'integer'},
        companyId: {type: 'integer'},
        moduleId: {type: 'integer'},
        ruleName: {type: 'string'},
        level: {type: 'string'},
        description: {type: 'string'},
        isActive: {type: 'boolean'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      company: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./company'),
        join: {
          from: 'tbdc_permissions.companyId',
          to: 'tbdc_companies.id'
        }
      },
      module: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./module'),
        join: {
          from: 'tbdc_permissions.moduleId',
          to: 'tbdc_modules.id'
        }
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

module.exports = TBDCPermission
