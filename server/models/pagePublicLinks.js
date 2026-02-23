const Model = require('objection').Model

/**
 * PagePublicLink model
 */
module.exports = class PagePublicLink extends Model {
  static get tableName() { return 'page_public_links' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['pageId', 'token'],

      properties: {
        id: {type: 'integer'},
        pageId: {type: 'integer'},
        token: {type: 'string'},
        status: {type: 'string', default: 'PENDING'},
        views: {type: 'integer', default: 0},
        createdById: {type: 'integer'},
        approvedById: {type: 'integer'},
        expiresAt: {type: ['string', 'null']},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'page_public_links.pageId',
          to: 'pages.id'
        }
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'page_public_links.createdById',
          to: 'users.id'
        }
      },
      approver: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'page_public_links.approvedById',
          to: 'users.id'
        }
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }
}
