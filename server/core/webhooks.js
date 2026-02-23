const request = require('request-promise')
const _ = require('lodash')
const crypto = require('crypto')

/* global WIKI */

module.exports = {
  init() {
    WIKI.logger.info('Initializing Webhooks Service...')
    return this
  },
  async execute(webhook, event, data) {
    if (!webhook.isEnabled || (!_.includes(webhook.events, event) && event !== 'test')) {
      return
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data
    }

    const headers = {
      'User-Agent': 'Wiki.js Webhook',
      'Content-Type': 'application/json',
      ...(webhook.headers || {})
    }

    if (webhook.secret) {
      const signature = crypto.createHmac('sha256', webhook.secret).update(JSON.stringify(payload)).digest('hex')
      headers['X-Wiki-Signature'] = signature
    }

    try {
      await request({
        method: 'POST',
        uri: webhook.url,
        body: payload,
        headers,
        json: true,
        timeout: 10000
      })
      WIKI.logger.info(`Webhook ${webhook.title} sent successfully for event ${event}.`)
    } catch (err) {
      WIKI.logger.warn(`Failed to send Webhook ${webhook.title} for event ${event}: ${err.message}`)
    }
  },
  async trigger(event, data) {
    try {
      const hooks = await WIKI.models.webhooks.query().where('isEnabled', true)
      for (let hook of hooks) {
        if (_.includes(hook.events, event)) {
          this.execute(hook, event, data)
        }
      }
    } catch (err) {
      WIKI.logger.warn(`Failed to trigger webhooks for event ${event}: ${err.message}`)
    }
  }
}
