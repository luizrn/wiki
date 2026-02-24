module.exports = {
  up: async (knex) => {
    const hasUpdates = await knex.schema.hasTable('tbdc_updates')
    if (!hasUpdates) {
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
    }

    const hasCategories = await knex.schema.hasTable('tbdc_update_categories')
    if (!hasCategories) {
      await knex.schema.createTable('tbdc_update_categories', (table) => {
        table.increments('id').primary()
        table.string('name').notNullable()
        table.string('color').defaultTo('#004d26')
        table.string('icon').nullable()
        table.boolean('showOnPublicPage').defaultTo(true)
        table.integer('order').defaultTo(0)
      })
    }

    const hasTargets = await knex.schema.hasTable('tbdc_update_targets')
    if (!hasTargets) {
      await knex.schema.createTable('tbdc_update_targets', (table) => {
        table.increments('id').primary()
        table.string('name').notNullable()
        table.string('icon').nullable()
      })
    }

    const hasVotes = await knex.schema.hasTable('tbdc_update_votes')
    if (!hasVotes) {
      await knex.schema.createTable('tbdc_update_votes', (table) => {
        table.increments('id').primary()
        table.integer('updateId').unsigned().references('id').inTable('tbdc_updates').onDelete('CASCADE')
        table.integer('userId').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
        table.integer('rating').notNullable()
        table.text('comment').nullable()
        table.datetime('createdAt').notNullable()
      })
    }

    const hasConfig = await knex.schema.hasTable('tbdc_update_config')
    if (!hasConfig) {
      await knex.schema.createTable('tbdc_update_config', (table) => {
        table.string('key').primary()
        table.text('value').notNullable()
      })
    }

    const hasDefaultCategories = await knex('tbdc_update_categories').first('id')
    if (!hasDefaultCategories) {
      await knex('tbdc_update_categories').insert([
        { name: 'TBDC Produtor', color: '#004d26', order: 1 },
        { name: 'TBDC Produtor App', color: '#1a73e8', order: 2 },
        { name: 'TBDC Consultoria', color: '#f29900', order: 3 },
        { name: 'TBDC Consultoria App', color: '#5c6bc0', order: 4 },
        { name: 'TBDC Geração de Demanda', color: '#d32f2f', order: 5 }
      ])
    }

    const hasDefaultTargets = await knex('tbdc_update_targets').first('id')
    if (!hasDefaultTargets) {
      await knex('tbdc_update_targets').insert([
        { name: 'Administradores', icon: 'mdi-shield-crown' },
        { name: 'Gestores', icon: 'mdi-account-tie' },
        { name: 'Operadores', icon: 'mdi-account-cog' }
      ])
    }

    const hasResponsibleCfg = await knex('tbdc_update_config').where({ key: 'responsibleUserId' }).first('key')
    if (!hasResponsibleCfg) {
      await knex('tbdc_update_config').insert({ key: 'responsibleUserId', value: '1' })
    }

    const hasSidebarCfg = await knex('tbdc_update_config').where({ key: 'sidebarLinks' }).first('key')
    if (!hasSidebarCfg) {
      await knex('tbdc_update_config').insert({ key: 'sidebarLinks', value: '[]' })
    }
  },
  down: async (knex) => {
    await knex.schema.dropTableIfExists('tbdc_update_votes')
    await knex.schema.dropTableIfExists('tbdc_update_config')
    await knex.schema.dropTableIfExists('tbdc_update_targets')
    await knex.schema.dropTableIfExists('tbdc_update_categories')
    await knex.schema.dropTableIfExists('tbdc_updates')
  }
}
