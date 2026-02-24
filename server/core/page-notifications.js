const _ = require('lodash')
const request = require('request-promise')

/* global WIKI */

module.exports = {
  init () {
    return this
  },

  async getConfig () {
    let cfg = await WIKI.models.pageNotificationSettings.query().first()
    if (!cfg) {
      cfg = await WIKI.models.pageNotificationSettings.query().insertAndFetch({
        isEnabled: false,
        channelInApp: true,
        channelEmail: false,
        channelDiscord: false,
        eventPageCreated: true,
        eventPageUpdated: true,
        discordWebhookUrl: ''
      })
    }
    return cfg
  },

  async updateConfig (payload) {
    const cfg = await this.getConfig()
    return WIKI.models.pageNotificationSettings.query().patchAndFetchById(cfg.id, {
      isEnabled: _.get(payload, 'isEnabled', cfg.isEnabled),
      channelInApp: _.get(payload, 'channelInApp', cfg.channelInApp),
      channelEmail: _.get(payload, 'channelEmail', cfg.channelEmail),
      channelDiscord: _.get(payload, 'channelDiscord', cfg.channelDiscord),
      eventPageCreated: _.get(payload, 'eventPageCreated', cfg.eventPageCreated),
      eventPageUpdated: _.get(payload, 'eventPageUpdated', cfg.eventPageUpdated),
      discordWebhookUrl: _.trim(_.get(payload, 'discordWebhookUrl', cfg.discordWebhookUrl || ''))
    })
  },

  async getUserPrefs (userId) {
    let prefs = await WIKI.models.pageNotificationUserPrefs.query().findOne({ userId })
    if (!prefs) {
      prefs = await WIKI.models.pageNotificationUserPrefs.query().insertAndFetch({
        userId,
        inAppEnabled: true,
        emailEnabled: true,
        discordEnabled: true
      })
    }
    return prefs
  },

  async updateUserPrefs (userId, payload) {
    const prefs = await this.getUserPrefs(userId)
    return WIKI.models.pageNotificationUserPrefs.query().patchAndFetchById(prefs.id, {
      inAppEnabled: _.get(payload, 'inAppEnabled', prefs.inAppEnabled),
      emailEnabled: _.get(payload, 'emailEnabled', prefs.emailEnabled),
      discordEnabled: _.get(payload, 'discordEnabled', prefs.discordEnabled)
    })
  },

  async getInbox (userId, { limit = 15, offset = 0, unreadOnly = false } = {}) {
    const q = WIKI.models.pageNotificationInbox.query()
      .alias('i')
      .join('pageNotificationEvents as e', 'e.id', 'i.eventId')
      .where('i.userId', userId)
      .select(
        'i.id',
        'i.userId',
        'i.isRead',
        'i.readAt',
        'i.createdAt',
        'e.eventType',
        'e.localeCode',
        'e.path',
        'e.title',
        'e.actorName',
        'e.pageDate'
      )
      .orderBy('i.createdAt', 'desc')
      .offset(_.toSafeInteger(offset))
      .limit(Math.min(_.toSafeInteger(limit) || 15, 100))

    if (unreadOnly) {
      q.andWhere('i.isRead', false)
    }

    const rows = await q
    return rows.map(r => ({
      ...r,
      url: `/${r.localeCode}/${r.path}`
    }))
  },

  async getUnreadCount (userId) {
    const row = await WIKI.models.pageNotificationInbox.query()
      .where({ userId, isRead: false })
      .count('* as total')
      .first()
    return _.toSafeInteger(_.get(row, 'total', 0))
  },

  async markRead (userId, inboxId) {
    await WIKI.models.pageNotificationInbox.query()
      .patch({
        isRead: true,
        readAt: new Date().toISOString()
      })
      .where({
        id: inboxId,
        userId
      })
  },

  async markAllRead (userId) {
    await WIKI.models.pageNotificationInbox.query()
      .patch({
        isRead: true,
        readAt: new Date().toISOString()
      })
      .where({
        userId,
        isRead: false
      })
  },

  async triggerPageEvent ({ eventType, page, actor }) {
    try {
      const config = await this.getConfig()
      if (!config.isEnabled) {
        return
      }

      if (eventType === 'created' && !config.eventPageCreated) {
        return
      }
      if (eventType === 'updated' && !config.eventPageUpdated) {
        return
      }
      if (!page.isPublished) {
        return
      }

      const pageDate = page.updatedAt || page.createdAt || new Date().toISOString()
      const eventKey = `${eventType}:${page.id}:${pageDate}`
      const event = await this.insertEventIfNew({
        eventKey,
        eventType,
        pageId: page.id,
        localeCode: page.localeCode,
        path: page.path,
        title: page.title,
        actorId: _.get(actor, 'id', null),
        actorName: _.get(actor, 'name', 'Sistema'),
        pageDate
      })

      if (!event) {
        return
      }

      const recipients = await this.getEligibleRecipients(page)
      if (recipients.length < 1) {
        return
      }

      if (config.channelInApp) {
        await this.dispatchInApp(event.id, recipients.filter(r => r.prefs.inAppEnabled))
      }
      if (config.channelEmail) {
        await this.dispatchEmail(event, recipients.filter(r => r.prefs.emailEnabled))
      }
      if (config.channelDiscord) {
        const hasEligibleDiscordUser = recipients.some(r => r.prefs.discordEnabled)
        if (hasEligibleDiscordUser) {
          await this.dispatchDiscord(config, event)
        }
      }
    } catch (err) {
      WIKI.logger.warn(`Page notifications failed: ${err.message}`)
    }
  },

  async sendDiscordTest (message) {
    const config = await this.getConfig()
    if (!config.channelDiscord || _.isEmpty(config.discordWebhookUrl)) {
      throw new Error('Discord channel is disabled or webhook is empty.')
    }

    const sampleEvent = {
      eventType: 'created',
      title: message || 'Teste de notificação de artigos',
      localeCode: 'pt-br',
      path: 'exemplo/novo-artigo',
      actorName: 'Sistema',
      pageDate: new Date().toISOString(),
      id: 0
    }

    await request({
      method: 'POST',
      uri: config.discordWebhookUrl,
      json: true,
      body: this.buildDiscordPayload(sampleEvent, { isTest: true })
    })
  },

  async sendEmailTest (recipientEmail) {
    await WIKI.mail.send({
      template: 'page-notification',
      to: recipientEmail,
      subject: 'Teste de notificacao de artigos',
      text: 'Este e um teste de notificacao de artigos.',
      data: {
        preheadertext: 'Teste de notificacao de artigos',
        heading: 'Teste de Notificacao',
        message: 'Este e um teste de notificacao de artigos.',
        pageTitle: 'Pagina de Exemplo',
        pageUrl: `${WIKI.config.host}/`,
        actionText: 'Abrir Wiki'
      }
    })
  },

  async getEligibleRecipients (page) {
    const users = await WIKI.models.users.query()
      .where('isActive', true)
      .where('id', '>', 2)
      .select('id', 'name', 'email')
      .withGraphFetched('groups')
      .modifyGraph('groups', builder => {
        builder.select('groups.id', 'permissions')
      })

    if (users.length < 1) {
      return []
    }

    const prefsRows = await WIKI.models.pageNotificationUserPrefs.query().whereIn('userId', users.map(u => u.id))
    const prefsByUser = _.keyBy(prefsRows, 'userId')

    return users
      .map(u => {
        const groups = _.get(u, 'groups', [])
        const permissions = _.uniq(_.flatten(groups.map(g => g.permissions || [])))
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          permissions,
          groups: groups.map(g => g.id),
          prefs: {
            inAppEnabled: _.get(prefsByUser, [u.id, 'inAppEnabled'], true),
            emailEnabled: _.get(prefsByUser, [u.id, 'emailEnabled'], true),
            discordEnabled: _.get(prefsByUser, [u.id, 'discordEnabled'], true)
          }
        }
      })
      .filter(u => WIKI.auth.checkAccess(u, ['read:pages'], { locale: page.localeCode, path: page.path }))
  },

  async dispatchInApp (eventId, recipients) {
    if (recipients.length < 1) {
      return
    }
    const now = new Date().toISOString()
    for (const user of recipients) {
      try {
        await WIKI.models.pageNotificationInbox.query().insert({
          userId: user.id,
          eventId,
          isRead: false,
          createdAt: now
        })
      } catch (err) {
        if (!this.isUniqueError(err)) {
          throw err
        }
      }
    }
  },

  async dispatchEmail (event, recipients) {
    if (recipients.length < 1) {
      return
    }
    const pageUrl = `${WIKI.config.host}/${event.localeCode}/${event.path}`
    const actionText = event.eventType === 'created' ? 'Ver novo artigo' : 'Ver artigo atualizado'
    const heading = event.eventType === 'created' ? 'Novo artigo publicado' : 'Artigo atualizado'

    for (const user of recipients) {
      if (!user.email || user.email.length < 4) {
        continue
      }
      try {
        await WIKI.mail.send({
          template: 'page-notification',
          to: user.email,
          subject: heading,
          text: `${heading}: ${event.title} (${pageUrl})`,
          data: {
            preheadertext: `${heading}: ${event.title}`,
            heading,
            message: `${event.actorName || 'Alguem'} ${event.eventType === 'created' ? 'publicou' : 'atualizou'} um artigo.`,
            pageTitle: event.title,
            pageUrl,
            actionText
          }
        })
      } catch (err) {
        WIKI.logger.warn(`Notification email failed for ${user.email}: ${err.message}`)
      }
    }
  },

  async dispatchDiscord (config, event) {
    if (_.isEmpty(config.discordWebhookUrl)) {
      return
    }

    await request({
      method: 'POST',
      uri: config.discordWebhookUrl,
      json: true,
      body: this.buildDiscordPayload(event)
    })
  },

  buildDiscordPayload (event, { isTest = false } = {}) {
    const isCreated = event.eventType === 'created'
    const eventIcon = isCreated ? '🆕' : '🔄'
    const eventLabel = isCreated ? 'NOVO ARTIGO CRIADO' : 'ARTIGO ATUALIZADO'
    const borderColor = isCreated ? 0x57F287 : 0xFEE75C
    const pageUrl = `${WIKI.config.host}/${event.localeCode}/${event.path}`
    const when = this.formatPtDate(event.pageDate || new Date().toISOString())
    const safeTitle = _.truncate(event.title || 'Sem título', { length: 180 })
    const safePath = _.truncate(event.path || '/', { length: 220 })
    const footerSuffix = isTest ? 'Teste manual' : `${isCreated ? 'Criado' : 'Atualizado'} automaticamente`
    const pageId = _.get(event, 'pageId', _.get(event, 'id', '-'))

    return {
      username: 'Wiki Interna',
      embeds: [
        {
          color: borderColor,
          title: `${eventIcon} ${safeTitle}`,
          description: [
            `**${eventLabel}**`,
            'O conteúdo foi modificado. Veja os detalhes:'
          ].join('\n'),
          fields: [
            {
              name: '📁 Caminho',
              value: `\`${safePath}\``,
              inline: false
            },
            {
              name: '👤 Quem fez',
              value: event.actorName || 'Sistema',
              inline: true
            },
            {
              name: '🕒 Quando',
              value: when,
              inline: true
            },
            {
              name: '🔗 Acesso Rápido',
              value: `[Clique aqui para abrir o artigo](${pageUrl})`,
              inline: false
            }
          ],
          footer: {
            text: `ID: ${pageId} • Wiki TBDC • ${footerSuffix}`
          },
          timestamp: event.pageDate || new Date().toISOString()
        }
      ]
    }
  },

  formatPtDate (isoDate) {
    try {
      return new Date(isoDate).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo'
      })
    } catch (err) {
      return isoDate
    }
  },

  async insertEventIfNew (payload) {
    try {
      return await WIKI.models.pageNotificationEvents.query().insertAndFetch(payload)
    } catch (err) {
      if (this.isUniqueError(err)) {
        return null
      }
      throw err
    }
  },

  isUniqueError (err) {
    const msg = _.toLower(_.get(err, 'message', ''))
    return _.includes(['23505', 'er_dup_entry', 'sqlite_constraint', '2627', '2601'], _.toLower(_.get(err, 'code', ''))) ||
      msg.includes('unique constraint') ||
      msg.includes('duplicate entry')
  }
}
