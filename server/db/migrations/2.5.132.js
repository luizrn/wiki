exports.up = async knex => {
  // Restore chatEnabled to users table (accidentally removed in previous migration)
  const hasChatEnabled = await knex.schema.hasColumn('users', 'chatEnabled')
  if (!hasChatEnabled) {
    await knex.schema.alterTable('users', table => {
      table.boolean('chatEnabled').defaultTo(true)
    })
  }

  // Create page_public_links table
  return knex.schema.createTable('page_public_links', table => {
    table.increments('id').primary()
    table.integer('pageId').unsigned().notNullable().references('id').inTable('pages').onDelete('CASCADE')
    table.string('token').unique().notNullable()
    table.string('status').notNullable().defaultTo('PENDING') // PENDING, APPROVED, REJECTED, EXPIRED
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

exports.down = async knex => {
  return knex.schema.dropTableIfExists('page_public_links')
}
