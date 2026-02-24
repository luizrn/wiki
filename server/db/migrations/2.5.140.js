exports.up = async knex => {
  const hasLastActiveAt = await knex.schema.hasColumn('users', 'lastActiveAt')
  if (!hasLastActiveAt) {
    await knex.schema.table('users', table => {
      table.string('lastActiveAt')
      table.index(['lastActiveAt'], 'users_lastactive_idx')
    })
  }

  const hasChatMessages = await knex.schema.hasTable('chat_messages')
  if (!hasChatMessages) {
    await knex.schema.createTable('chat_messages', table => {
      table.increments('id').primary()
      table.integer('senderId').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('receiverId').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.text('message').notNullable()
      table.boolean('isRead').notNullable().defaultTo(false)
      table.string('createdAt').notNullable()

      table.index(['senderId', 'receiverId', 'createdAt'], 'chat_messages_sender_receiver_idx')
      table.index(['receiverId', 'isRead'], 'chat_messages_receiver_read_idx')
    })
  }
}

exports.down = async knex => {
  const hasChatMessages = await knex.schema.hasTable('chat_messages')
  if (hasChatMessages) {
    await knex.schema.dropTableIfExists('chat_messages')
  }

  const hasLastActiveAt = await knex.schema.hasColumn('users', 'lastActiveAt')
  if (hasLastActiveAt) {
    await knex.schema.table('users', table => {
      table.dropIndex(['lastActiveAt'], 'users_lastactive_idx')
      table.dropColumn('lastActiveAt')
    })
  }
}
