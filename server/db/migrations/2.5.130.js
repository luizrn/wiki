exports.up = async knex => {
  await knex.schema.alterTable('pages', table => {
    table.index(['isPublished', 'localeCode'], 'pages_search_pub_locale_idx')
    table.index(['localeCode', 'path'], 'pages_search_locale_path_idx')
  })

  await knex.schema.alterTable('pageTags', table => {
    table.index(['pageId'], 'pagetags_pageid_idx')
  })
}

exports.down = async knex => {
  await knex.schema.alterTable('pageTags', table => {
    table.dropIndex(['pageId'], 'pagetags_pageid_idx')
  })

  await knex.schema.alterTable('pages', table => {
    table.dropIndex(['localeCode', 'path'], 'pages_search_locale_path_idx')
    table.dropIndex(['isPublished', 'localeCode'], 'pages_search_pub_locale_idx')
  })
}
