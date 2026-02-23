const Model = require('objection').Model

/**
 * ChatMessages model
 */
module.exports = class ChatMessage extends Model {
  static get tableName() { return 'chat_messages' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['senderId', 'receiverId', 'message'],

      properties: {
        id: {type: 'integer'},
        senderId: {type: 'integer'},
        receiverId: {type: 'integer'},
        message: {type: 'string'},
        isRead: {type: 'boolean'},
        createdAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      sender: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'chat_messages.senderId',
          to: 'users.id'
        }
      },
      receiver: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'chat_messages.receiverId',
          to: 'users.id'
        }
      }
    }
  }
}
