const Model = require('objection').Model

class TBDCUpdateCategory extends Model {
  static get tableName() { return 'tbdc_update_categories' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: {type: 'integer'},
        name: {type: 'string'},
        color: {type: 'string'},
        icon: {type: 'string'},
        showOnPublicPage: {type: 'boolean'},
        order: {type: 'integer'}
      }
    }
  }
}

module.exports = TBDCUpdateCategory
