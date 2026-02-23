const Model = require('objection').Model

class TBDCUpdate extends Model {
  static get tableName() { return 'tbdc_updates' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['title', 'content', 'categoryId'],
      properties: {
        id: {type: 'integer'},
        title: {type: 'string'},
        content: {type: 'string'},
        summary: {type: 'string'},
        authorId: {type: ['integer', 'null']},
        categoryId: {type: 'integer'},
        moduleId: {type: ['integer', 'null']},
        targetId: {type: ['integer', 'null']},
        isPublished: {type: 'boolean'},
        publishedAt: {type: ['string', 'null']},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('../user'),
        join: {
          from: 'tbdc_updates.authorId',
          to: 'users.id'
        }
      },
      category: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./update_category'),
        join: {
          from: 'tbdc_updates.categoryId',
          to: 'tbdc_update_categories.id'
        }
      },
      target: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./update_target'),
        join: {
          from: 'tbdc_updates.targetId',
          to: 'tbdc_update_targets.id'
        }
      },
      votes: {
        relation: Model.HasManyRelation,
        modelClass: require('./update_vote'),
        join: {
          from: 'tbdc_updates.id',
          to: 'tbdc_update_votes.updateId'
        }
      }
    }
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
    if (this.isPublished && !this.publishedAt) {
      this.publishedAt = new Date().toISOString()
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
    if (this.isPublished && !this.publishedAt) {
      this.publishedAt = new Date().toISOString()
    }
  }
}

module.exports = TBDCUpdate
