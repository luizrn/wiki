const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

const ACCESS_LEVEL_WEIGHT = {
  view: 1,
  edit: 2,
  admin: 3
}

function nowISO() {
  return new Date().toISOString()
}

function isAdminUser(user) {
  const permissions = _.get(user, 'permissions', [])
  return _.intersection(permissions, [
    'manage:system',
    'manage:groups',
    'write:groups',
    'manage:users'
  ]).length > 0
}

async function getUserGroupIds(user) {
  if (!user || user.id < 1) {
    return []
  }
  if (_.isArray(user.groups) && user.groups.length > 0) {
    return _.uniq(user.groups.map(g => _.isObject(g) ? g.id : g).filter(v => Number.isInteger(v)))
  }
  const rows = await WIKI.models.knex('userGroups').select('groupId').where('userId', user.id)
  return _.uniq(rows.map(r => r.groupId))
}

function parseJSON(value, fallback) {
  if (_.isNil(value)) return fallback
  if (_.isArray(value) || _.isObject(value)) return value
  if (!_.isString(value) || value.length < 1) return fallback
  try {
    return JSON.parse(value)
  } catch (err) {
    return fallback
  }
}

function safeArray(value) {
  const arr = parseJSON(value, [])
  return _.isArray(arr) ? arr : []
}

function safeObject(value) {
  const obj = parseJSON(value, {})
  return _.isObject(obj) && !_.isArray(obj) ? obj : {}
}

function sanitizeAccessLevel(level) {
  const normalized = _.toLower(_.trim(level || 'edit'))
  return ACCESS_LEVEL_WEIGHT[normalized] ? normalized : 'edit'
}

async function getBoardById(id) {
  return WIKI.models.knex('boards').where('id', id).first()
}

async function getBoardAccessLevel(boardId, user) {
  if (!user || user.id < 1) return null
  if (isAdminUser(user)) return 'admin'

  const board = await getBoardById(boardId)
  if (!board) return null
  if (board.createdById === user.id) return 'admin'
  if (board.isPublic) return 'view'

  const groupIds = await getUserGroupIds(user)
  if (groupIds.length < 1) return null

  const rows = await WIKI.models.knex('boardGroups')
    .where('boardId', boardId)
    .whereIn('groupId', groupIds)
    .select('accessLevel')

  if (rows.length < 1) return null
  let bestWeight = 0
  let best = null
  for (const row of rows) {
    const lvl = sanitizeAccessLevel(row.accessLevel)
    const w = ACCESS_LEVEL_WEIGHT[lvl]
    if (w > bestWeight) {
      bestWeight = w
      best = lvl
    }
  }
  return best
}

async function assertBoardAccess(boardId, user, requiredLevel = 'view') {
  const currentLevel = await getBoardAccessLevel(boardId, user)
  const ok = ACCESS_LEVEL_WEIGHT[currentLevel] >= ACCESS_LEVEL_WEIGHT[requiredLevel]
  if (!ok) {
    throw new Error('Você não tem permissão para acessar este board.')
  }
}

async function normalizeStagePositions(trx, boardId) {
  const stages = await trx('boardStages')
    .where('boardId', boardId)
    .orderBy('position', 'asc')
    .orderBy('id', 'asc')
    .select('id')
  for (let i = 0; i < stages.length; i++) {
    await trx('boardStages').where('id', stages[i].id).update({ position: i, updatedAt: nowISO() })
  }
}

async function normalizeCardPositions(trx, stageId) {
  const cards = await trx('boardCards')
    .where('stageId', stageId)
    .orderBy('position', 'asc')
    .orderBy('id', 'asc')
    .select('id')
  for (let i = 0; i < cards.length; i++) {
    await trx('boardCards').where('id', cards[i].id).update({ position: i, updatedAt: nowISO() })
  }
}

async function getBoardGroups(boardId) {
  const rows = await WIKI.models.knex('boardGroups')
    .leftJoin('groups', 'groups.id', 'boardGroups.groupId')
    .where('boardGroups.boardId', boardId)
    .select('boardGroups.groupId', 'boardGroups.accessLevel', 'groups.name as groupName')

  return rows.map(r => ({
    groupId: r.groupId,
    groupName: r.groupName || `Grupo ${r.groupId}`,
    accessLevel: sanitizeAccessLevel(r.accessLevel)
  }))
}

async function getBoardTeams(boardId) {
  const teams = await WIKI.models.knex('boardTeams')
    .leftJoin('boardTeamBoards', 'boardTeamBoards.teamId', 'boardTeams.id')
    .where('boardTeamBoards.boardId', boardId)
    .select('boardTeams.id', 'boardTeams.name', 'boardTeams.description', 'boardTeams.color', 'boardTeams.isArchived')
    .orderBy('boardTeams.name', 'asc')

  if (teams.length < 1) return []

  const teamIds = teams.map(t => t.id)
  const members = await WIKI.models.knex('boardTeamUsers')
    .leftJoin('users', 'users.id', 'boardTeamUsers.userId')
    .whereIn('boardTeamUsers.teamId', teamIds)
    .select('boardTeamUsers.teamId', 'users.id', 'users.name', 'users.email', 'users.pictureUrl')

  const boardLinks = await WIKI.models.knex('boardTeamBoards')
    .whereIn('teamId', teamIds)
    .select('teamId', 'boardId')

  const membersByTeam = _.groupBy(members, 'teamId')
  const boardsByTeam = _.groupBy(boardLinks, 'teamId')

  return teams.map(team => ({
    id: team.id,
    name: team.name,
    description: team.description,
    color: team.color,
    isArchived: !!team.isArchived,
    members: (membersByTeam[team.id] || []).filter(m => m.id).map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      pictureUrl: m.pictureUrl
    })),
    boardIds: (boardsByTeam[team.id] || []).map(r => r.boardId)
  }))
}

async function getBoardStagesWithCards(boardId) {
  const stages = await WIKI.models.knex('boardStages')
    .where('boardId', boardId)
    .orderBy('position', 'asc')
    .orderBy('id', 'asc')

  const cards = await WIKI.models.knex('boardCards')
    .leftJoin('users as assignee', 'assignee.id', 'boardCards.assigneeId')
    .where('boardCards.boardId', boardId)
    .orderBy('boardCards.position', 'asc')
    .orderBy('boardCards.id', 'asc')
    .select(
      'boardCards.*',
      'assignee.name as assigneeName'
    )

  const cardsByStage = _.groupBy(cards, 'stageId')

  return stages.map(stage => ({
    id: stage.id,
    boardId: stage.boardId,
    title: stage.title,
    color: stage.color,
    position: stage.position,
    wipLimit: stage.wipLimit,
    isDone: !!stage.isDone,
    cards: (cardsByStage[stage.id] || []).map(card => ({
      id: card.id,
      boardId: card.boardId,
      stageId: card.stageId,
      title: card.title,
      description: card.description,
      position: card.position,
      priority: card.priority,
      status: card.status,
      startDate: card.startDate,
      dueDate: card.dueDate,
      completedAt: card.completedAt,
      assigneeId: card.assigneeId,
      assigneeName: card.assigneeName,
      reporterId: card.reporterId,
      estimatePoints: card.estimatePoints,
      coverColor: card.coverColor,
      isArchived: !!card.isArchived,
      labels: safeArray(card.labels),
      checklist: safeArray(card.checklist),
      attachments: safeArray(card.attachments),
      watchers: safeArray(card.watchers).map(v => _.toSafeInteger(v)).filter(v => v > 0),
      customFields: JSON.stringify(safeObject(card.customFields)),
      createdAt: card.createdAt,
      updatedAt: card.updatedAt
    }))
  }))
}

async function buildBoardDetail(boardId) {
  const board = await getBoardById(boardId)
  if (!board) return null
  const [groups, teams, stages] = await Promise.all([
    getBoardGroups(boardId),
    getBoardTeams(boardId),
    getBoardStagesWithCards(boardId)
  ])
  return {
    id: board.id,
    title: board.title,
    description: board.description,
    color: board.color,
    icon: board.icon,
    isArchived: !!board.isArchived,
    isPublic: !!board.isPublic,
    settings: JSON.stringify(safeObject(board.settings)),
    createdById: board.createdById,
    groups,
    teams,
    stages
  }
}

async function getAllowedGroups(user) {
  if (isAdminUser(user)) {
    return WIKI.models.groups.query().select('id', 'name').orderBy('name', 'asc')
  }
  const groupIds = await getUserGroupIds(user)
  if (groupIds.length < 1) return []
  return WIKI.models.groups.query().select('id', 'name').whereIn('id', groupIds).orderBy('name', 'asc')
}

async function assertGroupsAllowed(user, groupsPayload) {
  if (isAdminUser(user)) return
  const groupIds = await getUserGroupIds(user)
  const requestedIds = _.uniq(groupsPayload.map(g => g.groupId))
  const hasForbidden = _.some(requestedIds, id => !groupIds.includes(id))
  if (hasForbidden) {
    throw new Error('Você só pode usar grupos aos quais pertence.')
  }
}

module.exports = {
  Query: {
    boards: () => ({})
  },
  Mutation: {
    boards: () => ({})
  },
  BoardQuery: {
    async list(obj, args, context) {
      const user = _.get(context, 'req.user')
      const includeArchived = args.includeArchived === true
      const isAdmin = isAdminUser(user)
      const groupIds = await getUserGroupIds(user)

      const query = WIKI.models.knex('boards')
        .select('boards.*')
        .countDistinct({ stagesCount: 'boardStages.id' })
        .countDistinct({ cardsCount: 'boardCards.id' })
        .leftJoin('boardStages', 'boardStages.boardId', 'boards.id')
        .leftJoin('boardCards', 'boardCards.boardId', 'boards.id')
        .groupBy('boards.id')
        .orderBy('boards.updatedAt', 'desc')

      if (!includeArchived) {
        query.where('boards.isArchived', false)
      }

      if (!isAdmin) {
        query.where(builder => {
          builder.where('boards.createdById', user.id)
            .orWhere('boards.isPublic', true)
            .orWhereExists(function () {
              this.select(WIKI.models.knex.raw('1'))
                .from('boardGroups')
                .whereRaw('boardGroups.boardId = boards.id')
                .whereIn('boardGroups.groupId', groupIds.length > 0 ? groupIds : [-1])
            })
        })
      }

      const rows = await query
      return rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        color: r.color,
        icon: r.icon,
        isArchived: !!r.isArchived,
        isPublic: !!r.isPublic,
        createdById: r.createdById,
        stagesCount: _.toSafeInteger(r.stagesCount),
        cardsCount: _.toSafeInteger(r.cardsCount)
      }))
    },
    async board(obj, args, context) {
      await assertBoardAccess(args.id, context.req.user, 'view')
      return buildBoardDetail(args.id)
    },
    async groups(obj, args, context) {
      const groups = await getAllowedGroups(context.req.user)
      return groups.map(g => ({ id: g.id, name: g.name }))
    },
    async users(obj, args, context) {
      await assertBoardAccess(args.boardId, context.req.user, 'view')
      if (isAdminUser(context.req.user)) {
        return WIKI.models.users.query()
          .select('id', 'name', 'email', 'pictureUrl')
          .where({ isActive: true, isSystem: false })
          .orderBy('name', 'asc')
      }

      const boardGroupRows = await WIKI.models.knex('boardGroups')
        .where('boardId', args.boardId)
        .select('groupId')

      const groupIds = _.uniq(boardGroupRows.map(r => r.groupId))
      if (groupIds.length < 1) {
        return WIKI.models.users.query()
          .select('id', 'name', 'email', 'pictureUrl')
          .where('id', context.req.user.id)
      }

      const users = await WIKI.models.knex('users')
        .join('userGroups', 'userGroups.userId', 'users.id')
        .whereIn('userGroups.groupId', groupIds)
        .where({ 'users.isActive': true, 'users.isSystem': false })
        .select('users.id', 'users.name', 'users.email', 'users.pictureUrl')
        .distinct('users.id', 'users.name', 'users.email', 'users.pictureUrl')
        .orderBy('users.name', 'asc')

      return users
    },
    async teams(obj, args, context) {
      const user = context.req.user
      const query = WIKI.models.knex('boardTeams')
        .select('boardTeams.*')
        .orderBy('boardTeams.name', 'asc')

      if (!isAdminUser(user)) {
        query.whereExists(function () {
          this.select(WIKI.models.knex.raw('1'))
            .from('boardTeamUsers')
            .whereRaw('boardTeamUsers.teamId = boardTeams.id')
            .where('boardTeamUsers.userId', user.id)
        })
      }

      const teams = await query
      const teamIds = teams.map(t => t.id)
      if (teamIds.length < 1) return []

      const members = await WIKI.models.knex('boardTeamUsers')
        .leftJoin('users', 'users.id', 'boardTeamUsers.userId')
        .whereIn('boardTeamUsers.teamId', teamIds)
        .select('boardTeamUsers.teamId', 'users.id', 'users.name', 'users.email', 'users.pictureUrl')

      const links = await WIKI.models.knex('boardTeamBoards')
        .whereIn('teamId', teamIds)
        .select('teamId', 'boardId')

      const membersByTeam = _.groupBy(members, 'teamId')
      const boardsByTeam = _.groupBy(links, 'teamId')
      return teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        color: team.color,
        isArchived: !!team.isArchived,
        members: (membersByTeam[team.id] || []).filter(m => m.id).map(m => ({
          id: m.id,
          name: m.name,
          email: m.email,
          pictureUrl: m.pictureUrl
        })),
        boardIds: (boardsByTeam[team.id] || []).map(x => x.boardId)
      }))
    }
  },
  BoardMutation: {
    async createBoard(obj, args, context) {
      const user = context.req.user
      const title = _.trim(args.title)
      if (!title) throw new Error('Título do board é obrigatório.')

      const allowedGroups = await getAllowedGroups(user)
      const allowedGroupIds = allowedGroups.map(g => g.id)
      const requestedGroupIds = _.uniq((args.groupIds || []).map(v => _.toSafeInteger(v)).filter(v => v > 0))
      const validRequested = requestedGroupIds.filter(id => allowedGroupIds.includes(id))

      const isPublic = args.isPublic === true
      if (!isPublic && validRequested.length < 1) {
        throw new Error('Defina ao menos 1 grupo com acesso ou marque o board como público.')
      }

      const ts = nowISO()
      const inserted = await WIKI.models.knex('boards').insert({
        title,
        description: args.description || '',
        color: args.color || '#1976d2',
        icon: args.icon || 'mdi-view-kanban',
        isArchived: false,
        isPublic,
        settings: {},
        createdById: user.id,
        createdAt: ts,
        updatedAt: ts
      })
      const boardId = _.isArray(inserted) ? inserted[0] : inserted

      if (validRequested.length > 0) {
        for (const gid of validRequested) {
          await WIKI.models.knex('boardGroups').insert({
            boardId,
            groupId: gid,
            accessLevel: 'edit'
          })
        }
      }

      await WIKI.models.knex('boardStages').insert([
        { boardId, title: 'Backlog', color: '#78909c', position: 0, wipLimit: null, isDone: false, createdAt: ts, updatedAt: ts },
        { boardId, title: 'Em andamento', color: '#42a5f5', position: 1, wipLimit: null, isDone: false, createdAt: ts, updatedAt: ts },
        { boardId, title: 'Concluído', color: '#66bb6a', position: 2, wipLimit: null, isDone: true, createdAt: ts, updatedAt: ts }
      ])

      return buildBoardDetail(boardId)
    },
    async updateBoard(obj, args, context) {
      await assertBoardAccess(args.id, context.req.user, 'admin')
      const patch = {}
      ;['title', 'description', 'color', 'icon', 'isArchived', 'isPublic'].forEach(key => {
        if (!_.isUndefined(args[key])) {
          patch[key] = args[key]
        }
      })
      if (!_.isUndefined(args.settings)) {
        patch.settings = safeObject(args.settings)
      }
      patch.updatedAt = nowISO()
      await WIKI.models.knex('boards').where('id', args.id).update(patch)
      return buildBoardDetail(args.id)
    },
    async deleteBoard(obj, args, context) {
      try {
        await assertBoardAccess(args.id, context.req.user, 'admin')
        await WIKI.models.knex('boards').where('id', args.id).del()
        return { responseResult: graphHelper.generateSuccess('Board removido com sucesso.') }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async saveBoardGroups(obj, args, context) {
      await assertBoardAccess(args.boardId, context.req.user, 'admin')
      const groupsPayload = _.uniqBy((args.groups || []).map(g => ({
        groupId: _.toSafeInteger(g.groupId),
        accessLevel: sanitizeAccessLevel(g.accessLevel)
      })).filter(g => g.groupId > 0), 'groupId')

      await assertGroupsAllowed(context.req.user, groupsPayload)

      await WIKI.models.knex.transaction(async trx => {
        await trx('boardGroups').where('boardId', args.boardId).del()
        for (const row of groupsPayload) {
          await trx('boardGroups').insert({
            boardId: args.boardId,
            groupId: row.groupId,
            accessLevel: row.accessLevel
          })
        }
        await trx('boards').where('id', args.boardId).update({ updatedAt: nowISO() })
      })
      return buildBoardDetail(args.boardId)
    },
    async createStage(obj, args, context) {
      await assertBoardAccess(args.boardId, context.req.user, 'edit')
      const maxPosRow = await WIKI.models.knex('boardStages')
        .where('boardId', args.boardId)
        .max({ maxPos: 'position' })
        .first()
      const position = _.isNil(maxPosRow.maxPos) ? 0 : _.toSafeInteger(maxPosRow.maxPos) + 1
      const ts = nowISO()
      const inserted = await WIKI.models.knex('boardStages').insert({
        boardId: args.boardId,
        title: _.trim(args.title),
        color: args.color || '#90a4ae',
        position,
        wipLimit: _.isNil(args.wipLimit) ? null : args.wipLimit,
        isDone: args.isDone === true,
        createdAt: ts,
        updatedAt: ts
      })
      const id = _.isArray(inserted) ? inserted[0] : inserted
      return WIKI.models.knex('boardStages').where('id', id).first().then(s => ({ ...s, cards: [] }))
    },
    async updateStage(obj, args, context) {
      const stage = await WIKI.models.knex('boardStages').where('id', args.id).first()
      if (!stage) throw new Error('Etapa não encontrada.')
      await assertBoardAccess(stage.boardId, context.req.user, 'edit')
      const patch = { updatedAt: nowISO() }
      ;['title', 'color', 'wipLimit', 'isDone'].forEach(k => {
        if (!_.isUndefined(args[k])) patch[k] = args[k]
      })
      await WIKI.models.knex('boardStages').where('id', args.id).update(patch)
      const updated = await WIKI.models.knex('boardStages').where('id', args.id).first()
      return { ...updated, cards: [] }
    },
    async moveStage(obj, args, context) {
      const stage = await WIKI.models.knex('boardStages').where('id', args.stageId).first()
      if (!stage || stage.boardId !== args.boardId) {
        throw new Error('Etapa inválida.')
      }
      await assertBoardAccess(args.boardId, context.req.user, 'edit')
      await WIKI.models.knex.transaction(async trx => {
        const stages = await trx('boardStages')
          .where('boardId', args.boardId)
          .orderBy('position', 'asc')
          .orderBy('id', 'asc')
          .select('id')

        const ids = stages.map(s => s.id).filter(id => id !== args.stageId)
        const targetPos = Math.max(0, Math.min(args.targetPosition, ids.length))
        ids.splice(targetPos, 0, args.stageId)
        for (let i = 0; i < ids.length; i++) {
          await trx('boardStages').where('id', ids[i]).update({ position: i, updatedAt: nowISO() })
        }
      })
      return getBoardStagesWithCards(args.boardId)
    },
    async deleteStage(obj, args, context) {
      try {
        const stage = await WIKI.models.knex('boardStages').where('id', args.id).first()
        if (!stage) throw new Error('Etapa não encontrada.')
        await assertBoardAccess(stage.boardId, context.req.user, 'edit')
        await WIKI.models.knex.transaction(async trx => {
          await trx('boardStages').where('id', args.id).del()
          await normalizeStagePositions(trx, stage.boardId)
        })
        return { responseResult: graphHelper.generateSuccess('Etapa removida com sucesso.') }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async createCard(obj, args, context) {
      await assertBoardAccess(args.boardId, context.req.user, 'edit')
      const stage = await WIKI.models.knex('boardStages').where({ id: args.stageId, boardId: args.boardId }).first()
      if (!stage) throw new Error('Etapa inválida.')

      const maxPosRow = await WIKI.models.knex('boardCards')
        .where({ boardId: args.boardId, stageId: args.stageId })
        .max({ maxPos: 'position' })
        .first()
      const position = _.isNil(maxPosRow.maxPos) ? 0 : _.toSafeInteger(maxPosRow.maxPos) + 1
      const ts = nowISO()
      const inserted = await WIKI.models.knex('boardCards').insert({
        boardId: args.boardId,
        stageId: args.stageId,
        title: _.trim(args.title),
        description: args.description || '',
        position,
        priority: args.priority || 'medium',
        status: args.status || 'open',
        startDate: args.startDate || null,
        dueDate: args.dueDate || null,
        completedAt: null,
        assigneeId: args.assigneeId || null,
        reporterId: context.req.user.id,
        estimatePoints: _.isNil(args.estimatePoints) ? null : args.estimatePoints,
        coverColor: args.coverColor || null,
        isArchived: false,
        labels: args.labels || [],
        checklist: args.checklist || [],
        attachments: args.attachments || [],
        watchers: args.watchers || [],
        customFields: safeObject(args.customFields || '{}'),
        createdAt: ts,
        updatedAt: ts
      })
      const id = _.isArray(inserted) ? inserted[0] : inserted
      const row = await WIKI.models.knex('boardCards').leftJoin('users as assignee', 'assignee.id', 'boardCards.assigneeId')
        .where('boardCards.id', id)
        .select('boardCards.*', 'assignee.name as assigneeName')
        .first()

      return {
        ...row,
        isArchived: !!row.isArchived,
        labels: safeArray(row.labels),
        checklist: safeArray(row.checklist),
        attachments: safeArray(row.attachments),
        watchers: safeArray(row.watchers),
        customFields: JSON.stringify(safeObject(row.customFields))
      }
    },
    async updateCard(obj, args, context) {
      const card = await WIKI.models.knex('boardCards').where('id', args.id).first()
      if (!card) throw new Error('Card não encontrado.')
      await assertBoardAccess(card.boardId, context.req.user, 'edit')

      const patch = { updatedAt: nowISO() }
      ;[
        'title', 'description', 'priority', 'status', 'startDate', 'dueDate',
        'completedAt', 'assigneeId', 'estimatePoints', 'coverColor', 'isArchived'
      ].forEach(k => {
        if (!_.isUndefined(args[k])) patch[k] = args[k]
      })
      if (!_.isUndefined(args.labels)) patch.labels = args.labels
      if (!_.isUndefined(args.checklist)) patch.checklist = args.checklist
      if (!_.isUndefined(args.attachments)) patch.attachments = args.attachments
      if (!_.isUndefined(args.watchers)) patch.watchers = args.watchers
      if (!_.isUndefined(args.customFields)) patch.customFields = safeObject(args.customFields || '{}')

      await WIKI.models.knex('boardCards').where('id', args.id).update(patch)

      const row = await WIKI.models.knex('boardCards')
        .leftJoin('users as assignee', 'assignee.id', 'boardCards.assigneeId')
        .where('boardCards.id', args.id)
        .select('boardCards.*', 'assignee.name as assigneeName')
        .first()

      return {
        ...row,
        isArchived: !!row.isArchived,
        labels: safeArray(row.labels),
        checklist: safeArray(row.checklist),
        attachments: safeArray(row.attachments),
        watchers: safeArray(row.watchers),
        customFields: JSON.stringify(safeObject(row.customFields))
      }
    },
    async moveCard(obj, args, context) {
      const card = await WIKI.models.knex('boardCards').where('id', args.cardId).first()
      if (!card) throw new Error('Card não encontrado.')
      const targetStage = await WIKI.models.knex('boardStages').where('id', args.targetStageId).first()
      if (!targetStage || targetStage.boardId !== card.boardId) throw new Error('Etapa de destino inválida.')
      await assertBoardAccess(card.boardId, context.req.user, 'edit')

      await WIKI.models.knex.transaction(async trx => {
        await trx('boardCards').where('id', args.cardId).update({
          stageId: args.targetStageId,
          position: args.targetPosition,
          updatedAt: nowISO()
        })
        await normalizeCardPositions(trx, card.stageId)
        await normalizeCardPositions(trx, args.targetStageId)
      })

      const row = await WIKI.models.knex('boardCards')
        .leftJoin('users as assignee', 'assignee.id', 'boardCards.assigneeId')
        .where('boardCards.id', args.cardId)
        .select('boardCards.*', 'assignee.name as assigneeName')
        .first()

      return {
        ...row,
        isArchived: !!row.isArchived,
        labels: safeArray(row.labels),
        checklist: safeArray(row.checklist),
        attachments: safeArray(row.attachments),
        watchers: safeArray(row.watchers),
        customFields: JSON.stringify(safeObject(row.customFields))
      }
    },
    async deleteCard(obj, args, context) {
      try {
        const card = await WIKI.models.knex('boardCards').where('id', args.id).first()
        if (!card) throw new Error('Card não encontrado.')
        await assertBoardAccess(card.boardId, context.req.user, 'edit')
        await WIKI.models.knex.transaction(async trx => {
          await trx('boardCards').where('id', args.id).del()
          await normalizeCardPositions(trx, card.stageId)
        })
        return { responseResult: graphHelper.generateSuccess('Card removido com sucesso.') }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async createTeam(obj, args, context) {
      const user = context.req.user
      const memberIds = _.uniq((args.memberIds || []).map(v => _.toSafeInteger(v)).filter(v => v > 0))
      if (!memberIds.includes(user.id)) {
        memberIds.push(user.id)
      }
      const ts = nowISO()
      const inserted = await WIKI.models.knex('boardTeams').insert({
        name: _.trim(args.name),
        description: args.description || '',
        color: args.color || '#546e7a',
        isArchived: false,
        createdById: user.id,
        createdAt: ts,
        updatedAt: ts
      })
      const teamId = _.isArray(inserted) ? inserted[0] : inserted

      for (const uid of memberIds) {
        await WIKI.models.knex('boardTeamUsers').insert({
          teamId,
          userId: uid,
          role: uid === user.id ? 'owner' : 'member'
        })
      }

      const teams = await module.exports.BoardQuery.teams(obj, args, context)
      return _.find(teams, ['id', teamId])
    },
    async updateTeam(obj, args, context) {
      const team = await WIKI.models.knex('boardTeams').where('id', args.id).first()
      if (!team) throw new Error('Time não encontrado.')
      const isAdmin = isAdminUser(context.req.user)
      if (!isAdmin && team.createdById !== context.req.user.id) {
        const relation = await WIKI.models.knex('boardTeamUsers').where({ teamId: args.id, userId: context.req.user.id }).first()
        if (!relation || relation.role !== 'owner') {
          throw new Error('Você não tem permissão para editar este time.')
        }
      }

      const patch = { updatedAt: nowISO() }
      ;['name', 'description', 'color', 'isArchived'].forEach(k => {
        if (!_.isUndefined(args[k])) patch[k] = args[k]
      })
      await WIKI.models.knex('boardTeams').where('id', args.id).update(patch)

      if (_.isArray(args.memberIds)) {
        const memberIds = _.uniq(args.memberIds.map(v => _.toSafeInteger(v)).filter(v => v > 0))
        if (!memberIds.includes(team.createdById)) {
          memberIds.push(team.createdById)
        }
        await WIKI.models.knex.transaction(async trx => {
          await trx('boardTeamUsers').where('teamId', args.id).del()
          for (const uid of memberIds) {
            await trx('boardTeamUsers').insert({
              teamId: args.id,
              userId: uid,
              role: uid === team.createdById ? 'owner' : 'member'
            })
          }
        })
      }

      const teams = await module.exports.BoardQuery.teams(obj, args, context)
      return _.find(teams, ['id', args.id])
    },
    async deleteTeam(obj, args, context) {
      try {
        const team = await WIKI.models.knex('boardTeams').where('id', args.id).first()
        if (!team) throw new Error('Time não encontrado.')
        if (!isAdminUser(context.req.user) && team.createdById !== context.req.user.id) {
          throw new Error('Você não tem permissão para remover este time.')
        }
        await WIKI.models.knex('boardTeams').where('id', args.id).del()
        return { responseResult: graphHelper.generateSuccess('Time removido com sucesso.') }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async linkTeamBoard(obj, args, context) {
      try {
        await assertBoardAccess(args.boardId, context.req.user, 'admin')
        const exists = await WIKI.models.knex('boardTeamBoards')
          .where({ teamId: args.teamId, boardId: args.boardId })
          .first()
        if (!exists) {
          await WIKI.models.knex('boardTeamBoards').insert({ teamId: args.teamId, boardId: args.boardId })
        }
        return { responseResult: graphHelper.generateSuccess('Time vinculado ao board.') }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async unlinkTeamBoard(obj, args, context) {
      try {
        await assertBoardAccess(args.boardId, context.req.user, 'admin')
        await WIKI.models.knex('boardTeamBoards').where({ teamId: args.teamId, boardId: args.boardId }).del()
        return { responseResult: graphHelper.generateSuccess('Time desvinculado do board.') }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
