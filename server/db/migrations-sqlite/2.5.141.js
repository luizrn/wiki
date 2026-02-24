exports.up = async knex => {
  const hasTable = await knex.schema.hasTable('azureWikiSyncMap')
  if (!hasTable) {
    await knex.schema.createTable('azureWikiSyncMap', table => {
      table.increments('id').primary()
      table.integer('pageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
      table.string('organization').notNullable()
      table.string('project').notNullable()
      table.string('wiki').notNullable()
      table.text('azurePath').notNullable()
      table.string('contentHash', 64).notNullable()
      table.string('lastSyncAt').notNullable()
      table.unique(['organization', 'project', 'wiki', 'azurePath'], 'azurewikisyncmap_src_unique')
      table.index(['pageId'], 'azurewikisyncmap_page_idx')
    })
  }
}

exports.down = async knex => {
  const hasTable = await knex.schema.hasTable('azureWikiSyncMap')
  if (hasTable) {
    await knex.schema.dropTableIfExists('azureWikiSyncMap')
  }
}
