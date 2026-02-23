const Model = require('objection').Model

class TBDCModule extends Model {
  static get tableName() { return 'tbdc_modules' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['name', 'productId'],
      properties: {
        id: {type: 'integer'},
        name: {type: 'string'},
        productId: {type: 'integer'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      product: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./product'),
        join: {
          from: 'tbdc_modules.productId',
          to: 'tbdc_products.id'
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

module.exports = TBDCModule
