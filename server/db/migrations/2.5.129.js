exports.up = function (knex) {
  const isPg = knex.client.config.client === 'pg'
  return knex.schema
    .createTable('webhooks', table => {
      table.increments('id').primary()
      table.string('title').notNullable()
      table.string('description')
      table.string('logo').defaultTo('/_assets/svg/icon-webhook.svg')
      table.string('url').notNullable()
      table.string('secret')
      table.boolean('isEnabled').defaultTo(true)
      if (isPg) {
        table.specificType('events', 'text[]')
        table.jsonb('headers')
      } else {
        table.json('events')
        table.json('headers')
      }
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
}

exports.down = function (knex) {
  return knex.schema.dropTable('webhooks')
}
