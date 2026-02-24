exports.up = async knex => {
  const hasStaff = await knex.schema.hasTable('tbdc_staff')
  if (!hasStaff) {
    await knex.schema.createTable('tbdc_staff', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('email').unique().notNullable()
      table.string('role').notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
  }

  const hasCompanies = await knex.schema.hasTable('tbdc_companies')
  if (!hasCompanies) {
    await knex.schema.createTable('tbdc_companies', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('focalName')
      table.string('focalEmail')
      table.string('focalPhone')
      table.integer('csId').unsigned().references('id').inTable('tbdc_staff').onDelete('SET NULL')
      table.integer('implantadorId').unsigned().references('id').inTable('tbdc_staff').onDelete('SET NULL')
      table.boolean('isActive').defaultTo(true)
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
  }

  const hasProducts = await knex.schema.hasTable('tbdc_products')
  if (!hasProducts) {
    await knex.schema.createTable('tbdc_products', table => {
      table.increments('id').primary()
      table.string('name').unique().notNullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
  }

  const hasModules = await knex.schema.hasTable('tbdc_modules')
  if (!hasModules) {
    await knex.schema.createTable('tbdc_modules', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.integer('productId').unsigned().references('id').inTable('tbdc_products').onDelete('CASCADE')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
  }

  const hasPermissions = await knex.schema.hasTable('tbdc_permissions')
  if (!hasPermissions) {
    await knex.schema.createTable('tbdc_permissions', table => {
      table.increments('id').primary()
      table.integer('companyId').unsigned().notNullable().references('id').inTable('tbdc_companies').onDelete('CASCADE')
      table.integer('moduleId').unsigned().notNullable().references('id').inTable('tbdc_modules').onDelete('CASCADE')
      table.string('ruleName').notNullable()
      table.string('level').notNullable()
      table.text('description')
      table.boolean('isActive').defaultTo(true)
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
      table.index(['companyId'], 'tbdc_perm_company_idx')
      table.index(['moduleId'], 'tbdc_perm_module_idx')
    })
  }
}

exports.down = async knex => {
  await knex.schema.dropTableIfExists('tbdc_permissions')
  await knex.schema.dropTableIfExists('tbdc_modules')
  await knex.schema.dropTableIfExists('tbdc_products')
  await knex.schema.dropTableIfExists('tbdc_companies')
  await knex.schema.dropTableIfExists('tbdc_staff')
}
