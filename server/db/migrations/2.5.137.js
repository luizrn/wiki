exports.up = async knex => {
  await knex.schema.table('pages', table => {
    table.index(['isPublished', 'localeCode', 'path'], 'pages_search_pub_locale_path_idx')
  })

  if (knex.client.config.client === 'pg') {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS pages_search_doc_trgm_idx
      ON pages
      USING GIN (
        LOWER(
          COALESCE(title, '') || ' ' ||
          COALESCE(description, '') || ' ' ||
          COALESCE(content, '') || ' ' ||
          COALESCE(render, '') || ' ' ||
          COALESCE(path, '')
        ) gin_trgm_ops
      )
      WHERE "isPublished" = true
    `)
  }
}

exports.down = async knex => {
  if (knex.client.config.client === 'pg') {
    await knex.raw('DROP INDEX IF EXISTS pages_search_doc_trgm_idx')
  }

  await knex.schema.table('pages', table => {
    table.dropIndex(['isPublished', 'localeCode', 'path'], 'pages_search_pub_locale_path_idx')
  })
}
