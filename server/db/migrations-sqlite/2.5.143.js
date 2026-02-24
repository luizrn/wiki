exports.up = async knex => {
  const hasTable = await knex.schema.hasTable('tbdc_permission_levels')
  if (!hasTable) {
    await knex.schema.createTable('tbdc_permission_levels', table => {
      table.increments('id').primary()
      table.string('code').notNullable().unique()
      table.string('label').notNullable()
      table.string('description')
      table.string('color').notNullable().defaultTo('#607D8B')
      table.integer('order').notNullable().defaultTo(0)
      table.boolean('isActive').notNullable().defaultTo(true)
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
      table.index(['isActive', 'order'], 'tbdc_perm_levels_active_order_idx')
    })
  }

  const total = await knex('tbdc_permission_levels').count('id as total').first()
  if (Number(total.total || 0) < 1) {
    const now = new Date().toISOString()
    await knex('tbdc_permission_levels').insert([
      { code: 'GREEN', label: 'Suporte tem permissão', description: 'Suporte tem permissão', color: '#4CAF50', order: 10, isActive: true, createdAt: now, updatedAt: now },
      { code: 'BLUE', label: 'Sim, autorizado pelo focal', description: 'Sim, mas com autorização do focal', color: '#18563B', order: 20, isActive: true, createdAt: now, updatedAt: now },
      { code: 'PURPLE', label: 'Somente CS tem permissão', description: 'Somente o CS tem permissão', color: '#8E24AA', order: 30, isActive: true, createdAt: now, updatedAt: now },
      { code: 'YELLOW', label: 'Após consulta com CS', description: 'Somente após consulta com CS', color: '#7A980F', order: 40, isActive: true, createdAt: now, updatedAt: now },
      { code: 'ORANGE', label: 'Regra sobre parâmetro', description: 'Com alguma regra sobre algum parâmetro', color: '#9BC113', order: 50, isActive: true, createdAt: now, updatedAt: now },
      { code: 'RED', label: 'Não permitido', description: 'Não permitido ou não informado', color: '#F44336', order: 60, isActive: true, createdAt: now, updatedAt: now },
      { code: 'BLACK', label: 'Não utiliza', description: 'Não utiliza este produto', color: '#000000', order: 70, isActive: true, createdAt: now, updatedAt: now }
    ])
  }
}

exports.down = async () => {
  // no-op
}
