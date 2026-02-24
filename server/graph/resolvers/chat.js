const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

function getAuthUser (context) {
  return _.get(context, 'req.user') || _.get(context, 'user') || null
}

module.exports = {
  Query: {
    chat: () => ({})
  },
  Mutation: {
    chat: () => ({})
  },
  Subscription: {
    chatMessageReceived: {
      subscribe: (parent, args, { user }) => {
        if (!user) throw new Error('Unauthorized')
        return WIKI.GQLEmitter.asyncIterator(`CHAT_MSG_${user.id}`)
      }
    },
    userStatusChanged: {
      subscribe: () => WIKI.GQLEmitter.asyncIterator('USER_STATUS_CHANGED')
    }
  },
  ChatQuery: {
    async users(obj, args, context) {
      const authUser = getAuthUser(context)
      if (!authUser || authUser.id < 1) {
        throw new Error('Unauthorized')
      }

      const query = WIKI.models.users.query()
        .where('isSystem', false)
        .where('isActive', true)
        .where('id', '!=', authUser.id)

      if (args.search) {
        const search = `%${_.trim(args.search)}%`
        query.where(builder => {
          builder.where('name', 'like', search)
            .orWhere('email', 'like', search)
        })
      }

      const users = await query.orderBy('name', 'asc').limit(50)
      const now = new Date()

      return users.map(u => {
        const lastActive = u.lastActiveAt ? new Date(u.lastActiveAt) : null
        const isOnline = lastActive && (now - lastActive < 300000) // 5 minutes window
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          pictureUrl: u.pictureUrl,
          isOnline: !!isOnline,
          lastActiveAt: u.lastActiveAt
        }
      })
    },
    async messages(obj, args, context) {
      const authUser = getAuthUser(context)
      if (!authUser || authUser.id < 1) {
        throw new Error('Unauthorized')
      }

      const limit = Math.min(Math.max(_.toSafeInteger(args.limit) || 50, 1), 200)
      const offset = Math.max(_.toSafeInteger(args.offset) || 0, 0)
      return WIKI.models.chatMessages.query()
        .where(builder => {
          builder.where('senderId', authUser.id).where('receiverId', args.userId)
        })
        .orWhere(builder => {
          builder.where('senderId', args.userId).where('receiverId', authUser.id)
        })
        .orderBy('createdAt', 'asc')
        .limit(limit)
        .offset(offset)
    }
  },
  ChatMutation: {
    async sendMessage(obj, args, context) {
      const authUser = getAuthUser(context)
      if (!authUser || authUser.id < 1) {
        throw new Error('Unauthorized')
      }

      const receiverId = _.toSafeInteger(args.receiverId)
      const message = _.trim(args.message || '')
      if (!receiverId || receiverId < 1) {
        throw new Error('Invalid receiver.')
      }
      if (receiverId === authUser.id) {
        throw new Error('Cannot send message to yourself.')
      }
      if (message.length < 1) {
        throw new Error('Message cannot be empty.')
      }

      const targetUser = await WIKI.models.users.query()
        .select('id')
        .where('id', receiverId)
        .where('isActive', true)
        .where('isSystem', false)
        .first()
      if (!targetUser) {
        throw new Error('Receiver not found.')
      }

      const msg = await WIKI.models.chatMessages.query().insertAndFetch({
        senderId: authUser.id,
        receiverId,
        message: message.slice(0, 4000),
        isRead: false,
        createdAt: new Date().toISOString()
      })

      WIKI.GQLEmitter.publish(`CHAT_MSG_${receiverId}`, {
        chatMessageReceived: msg
      })

      return msg
    },
    async markAsRead(obj, args, context) {
      try {
        const authUser = getAuthUser(context)
        if (!authUser || authUser.id < 1) {
          throw new Error('Unauthorized')
        }
        await WIKI.models.chatMessages.query()
          .patch({ isRead: true })
          .where('senderId', args.senderId)
          .where('receiverId', authUser.id)

        return { responseResult: graphHelper.generateSuccess('Messages marked as read.') }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateStatus(obj, args, context) {
      try {
        const authUser = getAuthUser(context)
        if (!authUser || authUser.id < 1) {
          throw new Error('Unauthorized')
        }

        const now = new Date().toISOString()
        await WIKI.models.users.query().patch({ lastActiveAt: now }).findById(authUser.id)

        WIKI.GQLEmitter.publish('USER_STATUS_CHANGED', {
          userStatusChanged: {
            userId: authUser.id,
            isOnline: true
          }
        })

        return { responseResult: graphHelper.generateSuccess('Status updated.') }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
