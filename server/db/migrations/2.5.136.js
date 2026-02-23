/* global WIKI */

module.exports = {
  up: async (knex) => {
    // -> Updates (Postagens)
    await knex.schema.createTable('tbdc_updates', (table) => {
      table.increments('id').primary()
      table.string('title').notNullable()
      table.text('content').notNullable()
      table.string('summary')
      table.integer('authorId').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('categoryId').unsigned()
      table.integer('moduleId').unsigned().nullable()
      table.integer('targetId').unsigned().nullable()
      table.boolean('isPublished').defaultTo(false)
      table.dateTime('publishedAt').nullable()
      table.datetime('createdAt').notNullable()
      table.datetime('updatedAt').notNullable()
    })

    // -> Categories (Produtos da TBDC)
    await knex.schema.createTable('tbdc_update_categories', (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('color').defaultTo('#004d26')
      table.string('icon').nullable()
      table.boolean('showOnPublicPage').defaultTo(true)
      table.integer('order').defaultTo(0)
    })

    // -> Targets (Para quem é o recurso?)
    await knex.schema.createTable('tbdc_update_targets', (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('icon').nullable()
    })

    // -> Votes & Satisfaction (😀😐😔)
    await knex.schema.createTable('tbdc_update_votes', (table) => {
      table.increments('id').primary()
      table.integer('updateId').unsigned().references('id').inTable('tbdc_updates').onDelete('CASCADE')
      table.integer('userId').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('rating').notNullable() // 1: Sad, 2: Neutral, 3: Happy
      table.text('comment').nullable()
      table.datetime('createdAt').notNullable()
    })

    // -> Config (Configurações do Painel)
    await knex.schema.createTable('tbdc_update_config', (table) => {
      table.string('key').primary()
      table.text('value').notNullable()
    })

    // -> Default Data
    await knex('tbdc_update_categories').insert([
      { name: 'TBDC Produtor', color: '#004d26', order: 1 },
      { name: 'TBDC Produtor App', color: '#1a73e8', order: 2 },
      { name: 'TBDC Consultoria', color: '#f29900', order: 3 },
      { name: 'TBDC Consultoria App', color: '#5c6bc0', order: 4 },
      { name: 'TBDC Geração de Demanda', color: '#d32f2f', order: 5 }
    ])

    await knex('tbdc_update_targets').insert([
      { name: 'Administradores', icon: 'mdi-shield-crown' },
      { name: 'Gestores', icon: 'mdi-account-tie' },
      { name: 'Operadores', icon: 'mdi-account-cog' }
    ])

    await knex('tbdc_update_config').insert([
      { key: 'responsibleUserId', value: '1' },
      { key: 'sidebarLinks', value: '[]' }
    ])
  },
  down: async (knex) => {
    await knex.schema.dropTableIfExists('tbdc_update_votes')
    await knex.schema.dropTableIfExists('tbdc_update_config')
    await knex.schema.dropTableIfExists('tbdc_update_targets')
    await knex.schema.dropTableIfExists('tbdc_update_categories')
    await knex.schema.dropTableIfExists('tbdc_updates')
  }
}
