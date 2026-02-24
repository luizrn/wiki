exports.up = async knex => {
  const hasHomeSettings = await knex.schema.hasTable('dashboardHomeSettings')
  if (!hasHomeSettings) {
    await knex.schema.createTable('dashboardHomeSettings', table => {
      table.increments('id').primary()
      table.text('customContent')
      table.json('quickLinks')
      table.integer('updatedById').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.string('createdAt').notNullable().defaultTo(new Date().toISOString())
      table.string('updatedAt').notNullable().defaultTo(new Date().toISOString())
    })
  }

  const hasPageVisits = await knex.schema.hasTable('pageVisits')
  if (!hasPageVisits) {
    await knex.schema.createTable('pageVisits', table => {
      table.increments('id').primary()
      table.integer('pageId').unsigned().notNullable().references('id').inTable('pages').onDelete('CASCADE')
      table.integer('userId').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.string('localeCode').notNullable()
      table.string('path').notNullable()
      table.string('createdAt').notNullable().defaultTo(new Date().toISOString())
      table.index(['pageId'], 'pagevisits_page_idx')
      table.index(['userId'], 'pagevisits_user_idx')
      table.index(['createdAt'], 'pagevisits_created_idx')
    })
  }

  const hasServiceCatalog = await knex.schema.hasTable('serviceCatalogItems')
  if (!hasServiceCatalog) {
    await knex.schema.createTable('serviceCatalogItems', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('entryType').notNullable().defaultTo('SERVICE')
      table.text('description').notNullable().defaultTo('')
      table.string('linkUrl')
      table.string('department').notNullable().defaultTo('')
      table.string('team').notNullable().defaultTo('')
      table.json('tags')
      table.integer('createdById').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('updatedById').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.string('createdAt').notNullable().defaultTo(new Date().toISOString())
      table.string('updatedAt').notNullable().defaultTo(new Date().toISOString())
      table.index(['entryType'], 'servicecatalog_type_idx')
      table.index(['department'], 'servicecatalog_department_idx')
      table.index(['team'], 'servicecatalog_team_idx')
      table.index(['createdById'], 'servicecatalog_createdby_idx')
      table.index(['updatedAt'], 'servicecatalog_updated_idx')
    })
  }
}

exports.down = async knex => {
  await knex.schema.dropTableIfExists('serviceCatalogItems')
  await knex.schema.dropTableIfExists('pageVisits')
  await knex.schema.dropTableIfExists('dashboardHomeSettings')
}
