const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

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
        const payload = {
          title: _.trim(args.title),
          description: _.trim(args.description || ''),
          url: _.trim(args.url),
          events: _.uniq((args.events || []).filter(Boolean)),
          isEnabled: args.isEnabled !== false,
          secret: _.trim(args.secret || '')
        }
        if (_.isEmpty(payload.title)) {
          throw new Error('Title is required.')
        }
        if (!/^https?:\/\/.+/i.test(payload.url)) {
          throw new Error('A valid target URL is required.')
        }
        if (payload.events.length < 1) {
          throw new Error('At least one event is required.')
        }

        await WIKI.models.webhooks.query().insert({
          ...payload
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
        const payload = _.pickBy({
          title: _.isString(args.title) ? _.trim(args.title) : undefined,
          description: _.isString(args.description) ? _.trim(args.description) : undefined,
          url: _.isString(args.url) ? _.trim(args.url) : undefined,
          events: _.isArray(args.events) ? _.uniq(args.events.filter(Boolean)) : undefined,
          isEnabled: _.isBoolean(args.isEnabled) ? args.isEnabled : undefined,
          secret: _.isString(args.secret) ? _.trim(args.secret) : undefined
        }, v => v !== undefined)

        if (_.has(payload, 'url') && !/^https?:\/\/.+/i.test(payload.url)) {
          throw new Error('A valid target URL is required.')
        }
        if (_.has(payload, 'events') && payload.events.length < 1) {
          throw new Error('At least one event is required.')
        }

        await WIKI.models.webhooks.query().patch(payload).findById(args.id)
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
