const Model = require('objection').Model

class TBDCCompany extends Model {
  static get tableName() { return 'tbdc_companies' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: {type: 'integer'},
        name: {type: 'string'},
        focalName: {type: 'string'},
        focalEmail: {type: 'string'},
        focalPhone: {type: 'string'},
        alihamento: {type: ['string', 'null']},
        csId: {type: ['integer', 'null']},
        implantadorId: {type: ['integer', 'null']},
        isActive: {type: 'boolean'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      cs: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./staff'),
        join: {
          from: 'tbdc_companies.csId',
          to: 'tbdc_staff.id'
        }
      },
      implantador: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./staff'),
        join: {
          from: 'tbdc_companies.implantadorId',
          to: 'tbdc_staff.id'
        }
      },
      permissions: {
        relation: Model.HasManyRelation,
        modelClass: require('./permission'),
        join: {
          from: 'tbdc_companies.id',
          to: 'tbdc_permissions.companyId'
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

module.exports = TBDCCompany
