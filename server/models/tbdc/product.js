const Model = require('objection').Model

class TBDCProduct extends Model {
  static get tableName() { return 'tbdc_products' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: {type: 'integer'},
        name: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      modules: {
        relation: Model.HasManyRelation,
        modelClass: require('./module'),
        join: {
          from: 'tbdc_products.id',
          to: 'tbdc_modules.productId'
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

module.exports = TBDCProduct
