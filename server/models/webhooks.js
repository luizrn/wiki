const Model = require('objection').Model
const _ = require('lodash')

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

  $parseDatabaseJson(json) {
    const parsed = super.$parseDatabaseJson(json)

    if (_.isString(parsed.events)) {
      try {
        parsed.events = JSON.parse(parsed.events)
      } catch (err) {
        parsed.events = []
      }
    }
    if (!_.isArray(parsed.events)) {
      parsed.events = []
    }

    if (_.isString(parsed.headers)) {
      try {
        parsed.headers = JSON.parse(parsed.headers)
      } catch (err) {
        parsed.headers = {}
      }
    }
    if (!_.isPlainObject(parsed.headers)) {
      parsed.headers = {}
    }

    return parsed
  }

  $formatDatabaseJson(json) {
    const dbJson = super.$formatDatabaseJson(json)
    if (!_.isArray(dbJson.events)) {
      dbJson.events = []
    }
    if (!_.isPlainObject(dbJson.headers)) {
      dbJson.headers = {}
    }
    return dbJson
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }
}
