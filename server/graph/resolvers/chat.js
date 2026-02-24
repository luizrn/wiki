/* global WIKI */

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
      const query = WIKI.models.users.query()
        .where('isSystem', false)
        .where('isActive', true)
        .where('id', '!=', context.user.id)

      if (args.search) {
        query.where(builder => {
          builder.where('name', 'like', `%${args.search}%`)
            .orWhere('email', 'like', `%${args.search}%`)
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
      return WIKI.models.chatMessages.query()
        .where(builder => {
          builder.where('senderId', context.user.id).where('receiverId', args.userId)
        })
        .orWhere(builder => {
          builder.where('senderId', args.userId).where('receiverId', context.user.id)
        })
        .orderBy('createdAt', 'asc')
        .limit(args.limit || 50)
        .offset(args.offset || 0)
    }
  },
  ChatMutation: {
    async sendMessage(obj, args, context) {
      const msg = await WIKI.models.chatMessages.query().insertAndFetch({
        senderId: context.user.id,
        receiverId: args.receiverId,
        message: args.message,
        createdAt: new Date().toISOString()
      })

      WIKI.GQLEmitter.publish(`CHAT_MSG_${args.receiverId}`, {
        chatMessageReceived: msg
      })

      return msg
    },
    async markAsRead(obj, args, context) {
      await WIKI.models.chatMessages.query()
        .patch({ isRead: true })
        .where('senderId', args.senderId)
        .where('receiverId', context.user.id)

      return { responseResult: { succeeded: true } }
    },
    async updateStatus(obj, args, context) {
      const now = new Date().toISOString()
      await WIKI.models.users.query().patch({ lastActiveAt: now }).findById(context.user.id)

      WIKI.GQLEmitter.publish('USER_STATUS_CHANGED', {
        userStatusChanged: {
          userId: context.user.id,
          isOnline: true
        }
      })

      return { responseResult: { succeeded: true } }
    }
  }
}
