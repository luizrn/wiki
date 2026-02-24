const Model = require('objection').Model

class TBDCUpdateVote extends Model {
  static get tableName() { return 'tbdc_update_votes' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['updateId', 'rating'],
      properties: {
        id: {type: 'integer'},
        updateId: {type: 'integer'},
        userId: {type: ['integer', 'null']},
        rating: {type: 'integer'},
        comment: {type: 'string'},
        createdAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      update: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./update'),
        join: {
          from: 'tbdc_update_votes.updateId',
          to: 'tbdc_updates.id'
        }
      },
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('../users'),
        join: {
          from: 'tbdc_update_votes.userId',
          to: 'users.id'
        }
      }
    }
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
  }
}

module.exports = TBDCUpdateVote
