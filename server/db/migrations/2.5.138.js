exports.up = async knex => {
  if (knex.client.config.client === 'mysql' || knex.client.config.client === 'mysql2') {
    await knex.raw(`
      CREATE FULLTEXT INDEX pages_search_fulltext_idx
      ON pages (title, description, content, render, path)
    `)
  }
}

exports.down = async knex => {
  if (knex.client.config.client === 'mysql' || knex.client.config.client === 'mysql2') {
    await knex.raw('DROP INDEX pages_search_fulltext_idx ON pages')
  }
}
