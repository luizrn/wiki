exports.up = async knex => {
  const hasChatEnabled = await knex.schema.hasColumn('users', 'chatEnabled')
  if (!hasChatEnabled) {
    await knex.schema.alterTable('users', table => {
      table.boolean('chatEnabled').defaultTo(true)
    })
  }

  const hasPublicLinks = await knex.schema.hasTable('page_public_links')
  if (!hasPublicLinks) {
    await knex.schema.createTable('page_public_links', table => {
      table.increments('id').primary()
      table.integer('pageId').unsigned().notNullable().references('id').inTable('pages').onDelete('CASCADE')
      table.string('token').unique().notNullable()
      table.string('status').notNullable().defaultTo('PENDING')
      table.integer('views').notNullable().defaultTo(0)
      table.integer('createdById').unsigned().references('id').inTable('users')
      table.integer('approvedById').unsigned().references('id').inTable('users')
      table.string('expiresAt')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
      table.index(['pageId'], 'pagepubliclinks_page_idx')
      table.index(['token'], 'pagepubliclinks_token_idx')
    })
  }
}

exports.down = async knex => {
  const hasPublicLinks = await knex.schema.hasTable('page_public_links')
  if (hasPublicLinks) {
    await knex.schema.dropTableIfExists('page_public_links')
  }

  const hasChatEnabled = await knex.schema.hasColumn('users', 'chatEnabled')
  if (hasChatEnabled) {
    await knex.schema.alterTable('users', table => {
      table.dropColumn('chatEnabled')
    })
  }
}
