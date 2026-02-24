exports.up = async knex => {
  const hasSettings = await knex.schema.hasTable('pageNotificationSettings')
  if (!hasSettings) {
    await knex.schema.createTable('pageNotificationSettings', table => {
      table.increments('id').primary()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.boolean('channelInApp').notNullable().defaultTo(true)
      table.boolean('channelEmail').notNullable().defaultTo(false)
      table.boolean('channelDiscord').notNullable().defaultTo(false)
      table.boolean('eventPageCreated').notNullable().defaultTo(true)
      table.boolean('eventPageUpdated').notNullable().defaultTo(true)
      table.string('discordWebhookUrl')
      table.string('createdAt').notNullable().defaultTo(new Date().toISOString())
      table.string('updatedAt').notNullable().defaultTo(new Date().toISOString())
    })
  }

  const hasPrefs = await knex.schema.hasTable('pageNotificationUserPrefs')
  if (!hasPrefs) {
    await knex.schema.createTable('pageNotificationUserPrefs', table => {
      table.increments('id').primary()
      table.integer('userId').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.boolean('inAppEnabled').notNullable().defaultTo(true)
      table.boolean('emailEnabled').notNullable().defaultTo(true)
      table.boolean('discordEnabled').notNullable().defaultTo(true)
      table.string('createdAt').notNullable().defaultTo(new Date().toISOString())
      table.string('updatedAt').notNullable().defaultTo(new Date().toISOString())
      table.unique(['userId'])
      table.index(['userId'], 'pagenotifuserprefs_user_idx')
    })
  }

  const hasEvents = await knex.schema.hasTable('pageNotificationEvents')
  if (!hasEvents) {
    await knex.schema.createTable('pageNotificationEvents', table => {
      table.increments('id').primary()
      table.string('eventKey').notNullable().unique()
      table.string('eventType').notNullable()
      table.integer('pageId').unsigned().notNullable().references('id').inTable('pages').onDelete('CASCADE')
      table.string('localeCode').notNullable()
      table.string('path').notNullable()
      table.string('title').notNullable()
      table.integer('actorId').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.string('actorName')
      table.string('pageDate').notNullable()
      table.string('createdAt').notNullable().defaultTo(new Date().toISOString())
      table.index(['pageId', 'eventType'], 'pagenotifevents_page_event_idx')
      table.index(['createdAt'], 'pagenotifevents_created_idx')
    })
  }

  const hasInbox = await knex.schema.hasTable('pageNotificationInbox')
  if (!hasInbox) {
    await knex.schema.createTable('pageNotificationInbox', table => {
      table.increments('id').primary()
      table.integer('userId').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('eventId').unsigned().notNullable().references('id').inTable('pageNotificationEvents').onDelete('CASCADE')
      table.boolean('isRead').notNullable().defaultTo(false)
      table.string('readAt')
      table.string('createdAt').notNullable().defaultTo(new Date().toISOString())
      table.unique(['userId', 'eventId'])
      table.index(['userId', 'isRead'], 'pagenotifinbox_user_read_idx')
      table.index(['userId', 'createdAt'], 'pagenotifinbox_user_created_idx')
    })
  }
}

exports.down = async knex => {
  await knex.schema.dropTableIfExists('pageNotificationInbox')
  await knex.schema.dropTableIfExists('pageNotificationEvents')
  await knex.schema.dropTableIfExists('pageNotificationUserPrefs')
  await knex.schema.dropTableIfExists('pageNotificationSettings')
}
