const Model = require('objection').Model

module.exports = class ServiceCatalogItems extends Model {
  static get tableName () { return 'serviceCatalogItems' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['name', 'entryType', 'createdById'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        entryType: { type: 'string' },
        description: { type: 'string' },
        linkUrl: { type: ['string', 'null'] },
        department: { type: 'string' },
        team: { type: 'string' },
        tags: { type: ['array', 'null'], items: { type: 'string' } },
        createdById: { type: 'integer' },
        updatedById: { type: ['integer', 'null'] },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    }
  }

  static get jsonAttributes () {
    return ['tags']
  }

  $beforeInsert () {
    const now = new Date().toISOString()
    this.createdAt = now
    this.updatedAt = now
  }

  $beforeUpdate () {
    this.updatedAt = new Date().toISOString()
  }
}
