exports.up = async knex => {
  const hasColumn = await knex.schema.hasColumn('tbdc_updates', 'scope')
  if (!hasColumn) {
    await knex.schema.alterTable('tbdc_updates', table => {
      table.string('scope', 32).notNullable().defaultTo('novidades')
    })
  }
  await knex('tbdc_updates').whereNull('scope').update({ scope: 'novidades' })
}

exports.down = async knex => {
  const hasColumn = await knex.schema.hasColumn('tbdc_updates', 'scope')
  if (hasColumn) {
    await knex.schema.alterTable('tbdc_updates', table => {
      table.dropColumn('scope')
    })
  }
}
