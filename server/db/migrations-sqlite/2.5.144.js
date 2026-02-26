exports.up = async knex => {
  const hasColumn = await knex.schema.hasColumn('tbdc_companies', 'alihamento')
  if (!hasColumn) {
    await knex.schema.alterTable('tbdc_companies', table => {
      table.text('alihamento')
    })
  }
}

exports.down = async knex => {
  const hasColumn = await knex.schema.hasColumn('tbdc_companies', 'alihamento')
  if (hasColumn) {
    await knex.schema.alterTable('tbdc_companies', table => {
      table.dropColumn('alihamento')
    })
  }
}
