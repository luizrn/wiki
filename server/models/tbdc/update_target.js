const Model = require('objection').Model

class TBDCUpdateTarget extends Model {
  static get tableName() { return 'tbdc_update_targets' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: {type: 'integer'},
        name: {type: 'string'},
        icon: {type: 'string'}
      }
    }
  }
}

module.exports = TBDCUpdateTarget
