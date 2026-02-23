exports.up = async knex => {
  // 1. TBDC Staff (CSs and Implantadores)
  await knex.schema.createTable('tbdc_staff', table => {
    table.increments('id').primary()
    table.string('name').notNullable()
    table.string('email').unique().notNullable()
    table.string('role').notNullable() // CS, IMPLANTADOR
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()
  })

  // 2. TBDC Companies
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

  // 3. TBDC Products
  await knex.schema.createTable('tbdc_products', table => {
    table.increments('id').primary()
    table.string('name').unique().notNullable()
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()
  })

  // 4. TBDC Modules
  await knex.schema.createTable('tbdc_modules', table => {
    table.increments('id').primary()
    table.string('name').notNullable()
    table.integer('productId').unsigned().references('id').inTable('tbdc_products').onDelete('CASCADE')
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()
  })

  // 5. TBDC Permissions / Rules
  return knex.schema.createTable('tbdc_permissions', table => {
    table.increments('id').primary()
    table.integer('companyId').unsigned().notNullable().references('id').inTable('tbdc_companies').onDelete('CASCADE')
    table.integer('moduleId').unsigned().notNullable().references('id').inTable('tbdc_modules').onDelete('CASCADE')
    table.string('ruleName').notNullable() // e.g. "Cadastrar usuários"
    table.string('level').notNullable() // GREEN, BLUE, PURPLE, YELLOW, ORANGE, RED, BLACK
    table.text('description')
    table.boolean('isActive').defaultTo(true)
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()

    table.index(['companyId'], 'tbdc_perm_company_idx')
    table.index(['moduleId'], 'tbdc_perm_module_idx')
  })
}

exports.down = async knex => {
  await knex.schema.dropTableIfExists('tbdc_permissions')
  await knex.schema.dropTableIfExists('tbdc_modules')
  await knex.schema.dropTableIfExists('tbdc_products')
  await knex.schema.dropTableIfExists('tbdc_companies')
  return knex.schema.dropTableIfExists('tbdc_staff')
}
