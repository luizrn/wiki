const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async pageNotifications () { return {} }
  },
  Mutation: {
    async pageNotifications () { return {} }
  },
  PageNotificationQuery: {
    async config () {
      return WIKI.pageNotifications.getConfig()
    },
    async myPreferences (obj, args, context) {
      if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
        throw new WIKI.Error.AuthRequired()
      }
      return WIKI.pageNotifications.getUserPrefs(context.req.user.id)
    },
    async myInbox (obj, args, context) {
      if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
        return []
      }
      return WIKI.pageNotifications.getInbox(context.req.user.id, args)
    },
    async myUnreadCount (obj, args, context) {
      if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
        return 0
      }
      return WIKI.pageNotifications.getUnreadCount(context.req.user.id)
    }
  },
  PageNotificationMutation: {
    async updateConfig (obj, args) {
      try {
        await WIKI.pageNotifications.updateConfig(args)
        return {
          responseResult: graphHelper.generateSuccess('Notification settings updated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async sendDiscordTest (obj, args) {
      try {
        await WIKI.pageNotifications.sendDiscordTest(args.message)
        return {
          responseResult: graphHelper.generateSuccess('Discord test sent successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async sendEmailTest (obj, args) {
      try {
        await WIKI.pageNotifications.sendEmailTest(args.recipientEmail)
        return {
          responseResult: graphHelper.generateSuccess('Email test sent successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateMyPreferences (obj, args, context) {
      try {
        if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
          throw new WIKI.Error.AuthRequired()
        }
        await WIKI.pageNotifications.updateUserPrefs(context.req.user.id, args)
        return {
          responseResult: graphHelper.generateSuccess('Notification preferences updated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async markRead (obj, args, context) {
      try {
        if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
          throw new WIKI.Error.AuthRequired()
        }
        await WIKI.pageNotifications.markRead(context.req.user.id, args.inboxId)
        return {
          responseResult: graphHelper.generateSuccess('Notification marked as read.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async markAllRead (obj, args, context) {
      try {
        if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
          throw new WIKI.Error.AuthRequired()
        }
        await WIKI.pageNotifications.markAllRead(context.req.user.id)
        return {
          responseResult: graphHelper.generateSuccess('Notifications marked as read.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
