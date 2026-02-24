exports.up = async knex => {
  const client = knex.client.config.client
  const isMySQL = client === 'mysql' || client === 'mysql2'

  if (!isMySQL) {
    return
  }

  const hasTable = await knex.schema.hasTable('webhooks')
  if (!hasTable) {
    await knex.schema.createTable('webhooks', table => {
      table.increments('id').primary()
      table.string('title').notNullable()
      table.string('description')
      table.string('logo').defaultTo('/_assets/svg/icon-webhook.svg')
      table.string('url').notNullable()
      table.string('secret')
      table.boolean('isEnabled').defaultTo(true)
      table.json('events')
      table.json('headers')
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
    return
  }

  const hasEvents = await knex.schema.hasColumn('webhooks', 'events')
  if (!hasEvents) {
    await knex.schema.table('webhooks', table => {
      table.json('events')
    })
  }

  const hasHeaders = await knex.schema.hasColumn('webhooks', 'headers')
  if (!hasHeaders) {
    await knex.schema.table('webhooks', table => {
      table.json('headers')
    })
  }

  await knex('webhooks').whereNull('events').update({ events: '[]' })
  await knex('webhooks').whereNull('headers').update({ headers: '{}' })
}

exports.down = async () => {
  // no-op
}
