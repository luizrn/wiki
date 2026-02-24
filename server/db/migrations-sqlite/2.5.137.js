exports.up = async knex => {
  const hasPages = await knex.schema.hasTable('pages')
  if (!hasPages) {
    return
  }

  await knex.schema.table('pages', table => {
    table.index(['isPublished', 'localeCode', 'path'], 'pages_search_pub_locale_path_idx')
  })
}

exports.down = async knex => {
  const hasPages = await knex.schema.hasTable('pages')
  if (!hasPages) {
    return
  }

  await knex.schema.table('pages', table => {
    table.dropIndex(['isPublished', 'localeCode', 'path'], 'pages_search_pub_locale_path_idx')
  })
}
