const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async webhooks() { return {} }
  },
  Mutation: {
    async webhooks() { return {} }
  },
  WebhooksQuery: {
    async list(obj, args, context) {
      return WIKI.models.webhooks.query().orderBy('title')
    },
    async webhook(obj, args, context) {
      return WIKI.models.webhooks.query().findById(args.id)
    }
  },
  WebhooksMutation: {
    async create(obj, args, context) {
      try {
        await WIKI.models.webhooks.query().insert({
          title: args.title,
          description: args.description,
          url: args.url,
          events: args.events,
          isEnabled: args.isEnabled,
          secret: args.secret
        })
        return {
          responseResult: graphHelper.generateSuccess('Webhook created successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async update(obj, args, context) {
      try {
        await WIKI.models.webhooks.query().patch({
          title: args.title,
          description: args.description,
          url: args.url,
          events: args.events,
          isEnabled: args.isEnabled,
          secret: args.secret
        }).findById(args.id)
        return {
          responseResult: graphHelper.generateSuccess('Webhook updated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async delete(obj, args, context) {
      try {
        await WIKI.models.webhooks.query().deleteById(args.id)
        return {
          responseResult: graphHelper.generateSuccess('Webhook deleted successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async test(obj, args, context) {
      try {
        const webhook = await WIKI.models.webhooks.query().findById(args.id)
        if (!webhook) {
          throw new Error('Webhook not found')
        }

        await WIKI.webhooks.execute(webhook, 'test', {
          message: 'This is a test webhook from Wiki.js',
          timestamp: new Date().toISOString()
        })

        return {
          responseResult: graphHelper.generateSuccess('Test webhook sent successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
