const Model = require('objection').Model
const _ = require('lodash')

/* global WIKI */

/**
 * Webhooks model
 */
module.exports = class Webhook extends Model {
  static get tableName() { return 'webhooks' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['title', 'url'],

      properties: {
        id: {type: 'integer'},
        title: {type: 'string'},
        description: {type: 'string'},
        logo: {type: 'string'},
        url: {type: 'string'},
        secret: {type: 'string'},
        isEnabled: {type: 'boolean'},
        events: {type: 'array', items: {type: 'string'}},
        headers: {type: 'object'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['events', 'headers']
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }
}
