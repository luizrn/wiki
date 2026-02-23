const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

function defaultQuickLinks () {
  return [
    { label: 'Novo Artigo', icon: 'mdi-file-plus-outline', url: '/e/en/new-page', color: 'blue' },
    { label: 'Tags', icon: 'mdi-tag-multiple', url: '/t', color: 'teal' },
    { label: 'Admin', icon: 'mdi-cog-outline', url: '/a', color: 'indigo' },
    { label: 'Boards', icon: 'mdi-view-kanban', url: '/boards', color: 'deep-orange' },
    { label: 'Servicos', icon: 'mdi-briefcase-outline', url: '/dashboard#services', color: 'purple' }
  ]
}

async function getDashboardConfigRecord () {
  let cfg = await WIKI.models.dashboardHomeSettings.query().first()
  if (!cfg) {
    cfg = await WIKI.models.dashboardHomeSettings.query().insertAndFetch({
      customContent: 'Bem-vindo ao dashboard da Wiki.',
      quickLinks: defaultQuickLinks(),
      updatedById: 1
    })
  }
  return cfg
}

function canDeleteItem (item, user) {
  if (!user) return false
  if (WIKI.auth.checkAccess(user, ['manage:system'])) return true
  return user.id === item.createdById
}

module.exports = {
  Query: {
    async dashboard () { return {} },
    async serviceCatalog () { return {} }
  },
  Mutation: {
    async dashboard () { return {} },
    async serviceCatalog () { return {} }
  },
  DashboardQuery: {
    async config () {
      const cfg = await getDashboardConfigRecord()
      return {
        customContent: cfg.customContent || '',
        quickLinks: _.isArray(cfg.quickLinks) ? cfg.quickLinks : defaultQuickLinks()
      }
    },
    async overview () {
      const pagesBase = WIKI.models.pages.query()

      const [
        totalArticlesRow,
        publishedArticlesRow,
        draftArticlesRow,
        totalUsersRow,
        totalVisitsRow,
        totalServicesRow,
        totalProcessesRow
      ] = await Promise.all([
        pagesBase.clone().count('* as total').first(),
        pagesBase.clone().where('isPublished', true).count('* as total').first(),
        pagesBase.clone().where('isPublished', false).count('* as total').first(),
        WIKI.models.users.query().where('id', '>', 2).where('isActive', true).count('* as total').first(),
        WIKI.models.pageVisits.query().count('* as total').first(),
        WIKI.models.serviceCatalogItems.query().where('entryType', 'SERVICE').count('* as total').first(),
        WIKI.models.serviceCatalogItems.query().where('entryType', 'PROCESS').count('* as total').first()
      ])

      const latestArticlesRaw = await WIKI.models.pages.query()
        .select('id', 'title', 'path', { locale: 'localeCode' }, 'createdAt', 'updatedAt')
        .orderBy('updatedAt', 'desc')
        .limit(10)

      const topArticlesRows = await WIKI.models.knex('pageVisits as pv')
        .select('p.id', 'p.title', 'p.path', 'p.localeCode', 'p.createdAt', 'p.updatedAt')
        .count('pv.id as views')
        .join('pages as p', 'p.id', 'pv.pageId')
        .groupBy('p.id', 'p.title', 'p.path', 'p.localeCode', 'p.createdAt', 'p.updatedAt')
        .orderBy('views', 'desc')
        .limit(10)

      const topUsersRows = await WIKI.models.knex('pageVisits as pv')
        .select('u.id', 'u.name', 'u.email')
        .count('pv.id as visits')
        .join('users as u', 'u.id', 'pv.userId')
        .where('u.id', '>', 2)
        .groupBy('u.id', 'u.name', 'u.email')
        .orderBy('visits', 'desc')
        .limit(10)

      const localeStatsRows = await WIKI.models.pages.query()
        .select({ locale: 'localeCode' })
        .count('* as total')
        .groupBy('localeCode')
        .orderBy('total', 'desc')

      const now = new Date()
      const dayLabels = _.times(30, i => {
        const d = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000)
        return d.toISOString().slice(0, 10)
      })

      const [visitsRows, createdRows, updatedRows] = await Promise.all([
        WIKI.models.pageVisits.query()
          .where('createdAt', '>=', dayLabels[0])
          .select(WIKI.models.knex.raw('substr(createdAt, 1, 10) as d'))
          .count('* as total')
          .groupBy('d'),
        WIKI.models.pages.query()
          .where('createdAt', '>=', dayLabels[0])
          .select(WIKI.models.knex.raw('substr(createdAt, 1, 10) as d'))
          .count('* as total')
          .groupBy('d'),
        WIKI.models.pages.query()
          .where('updatedAt', '>=', dayLabels[0])
          .select(WIKI.models.knex.raw('substr(updatedAt, 1, 10) as d'))
          .count('* as total')
          .groupBy('d')
      ])

      const makeTrend = rows => {
        const map = _.keyBy(rows.map(r => ({ d: r.d, total: _.toSafeInteger(r.total) })), 'd')
        return dayLabels.map(d => ({
          label: d,
          value: _.get(map, [d, 'total'], 0)
        }))
      }

      const topViewsByPage = _.keyBy(topArticlesRows.map(r => ({ id: r.id, views: _.toSafeInteger(r.views) })), 'id')
      const latestArticles = latestArticlesRaw.map(p => ({
        ...p,
        views: _.get(topViewsByPage, [p.id, 'views'], 0)
      }))

      return {
        summary: {
          totalArticles: _.toSafeInteger(totalArticlesRow.total),
          publishedArticles: _.toSafeInteger(publishedArticlesRow.total),
          draftArticles: _.toSafeInteger(draftArticlesRow.total),
          totalUsers: _.toSafeInteger(totalUsersRow.total),
          totalServices: _.toSafeInteger(totalServicesRow.total),
          totalProcesses: _.toSafeInteger(totalProcessesRow.total),
          totalVisits: _.toSafeInteger(totalVisitsRow.total)
        },
        latestArticles,
        topArticles: topArticlesRows.map(r => ({
          id: r.id,
          title: r.title,
          path: r.path,
          locale: r.localeCode,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          views: _.toSafeInteger(r.views)
        })),
        topUsers: topUsersRows.map(u => ({
          ...u,
          visits: _.toSafeInteger(u.visits)
        })),
        localeStats: localeStatsRows.map(r => ({
          locale: r.locale,
          total: _.toSafeInteger(r.total)
        })),
        visitsLast30d: makeTrend(visitsRows),
        createdLast30d: makeTrend(createdRows),
        updatedLast30d: makeTrend(updatedRows)
      }
    }
  },
  DashboardMutation: {
    async saveConfig (obj, args, context) {
      try {
        const cfg = await getDashboardConfigRecord()
        const quickLinks = (args.quickLinks || []).map(l => ({
          label: _.trim(l.label || '').slice(0, 80),
          icon: _.trim(l.icon || 'mdi-link-variant').slice(0, 80),
          url: _.trim(l.url || '#').slice(0, 500),
          color: _.trim(l.color || 'primary').slice(0, 40)
        })).filter(l => l.label.length > 0 && l.url.length > 0)

        await WIKI.models.dashboardHomeSettings.query().patchAndFetchById(cfg.id, {
          customContent: _.trim(args.customContent || ''),
          quickLinks,
          updatedById: context.req.user.id
        })
        return {
          responseResult: graphHelper.generateSuccess('Dashboard configuration updated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  ServiceCatalogQuery: {
    async list (obj, args, context) {
      const q = WIKI.models.serviceCatalogItems.query().alias('s')
        .select(
          's.id',
          's.name',
          's.entryType',
          's.description',
          's.linkUrl',
          's.department',
          's.team',
          's.tags',
          's.createdAt',
          's.updatedAt',
          's.createdById',
          's.updatedById',
          { createdByName: 'uc.name' },
          { updatedByName: 'uu.name' }
        )
        .leftJoin('users as uc', 'uc.id', 's.createdById')
        .leftJoin('users as uu', 'uu.id', 's.updatedById')
        .orderBy('s.updatedAt', 'desc')

      if (!_.isEmpty(args.search)) {
        const s = `%${_.trim(args.search)}%`
        q.where(builder => {
          builder.where('s.name', 'like', s)
            .orWhere('s.description', 'like', s)
            .orWhere('s.department', 'like', s)
            .orWhere('s.team', 'like', s)
        })
      }
      if (!_.isEmpty(args.entryType)) {
        q.andWhere('s.entryType', _.toUpper(args.entryType))
      }
      if (!_.isEmpty(args.department)) {
        q.andWhere('s.department', args.department)
      }
      if (!_.isEmpty(args.team)) {
        q.andWhere('s.team', args.team)
      }
      if (!_.isEmpty(args.tag)) {
        if (WIKI.config.db.type === 'postgres') {
          q.andWhereRaw('s.tags::text ILIKE ?', [`%${args.tag}%`])
        } else {
          q.andWhereRaw('CAST(s.tags as CHAR) LIKE ?', [`%${args.tag}%`])
        }
      }

      const limit = Math.min(_.toSafeInteger(args.limit) || 100, 300)
      const offset = Math.max(_.toSafeInteger(args.offset) || 0, 0)
      q.limit(limit).offset(offset)

      const rows = await q
      return rows.map(r => ({
        ...r,
        tags: _.isArray(r.tags) ? r.tags : [],
        canDelete: canDeleteItem(r, context.req.user)
      }))
    },
    async facets () {
      const rows = await WIKI.models.serviceCatalogItems.query()
        .select('department', 'team', 'tags')

      return {
        departments: _.uniq(rows.map(r => _.trim(r.department || '')).filter(Boolean)).sort(),
        teams: _.uniq(rows.map(r => _.trim(r.team || '')).filter(Boolean)).sort(),
        tags: _.uniq(rows.flatMap(r => (_.isArray(r.tags) ? r.tags : [])).map(t => _.trim(t || '')).filter(Boolean)).sort()
      }
    }
  },
  ServiceCatalogMutation: {
    async create (obj, args, context) {
      try {
        const item = await WIKI.models.serviceCatalogItems.query().insertAndFetch({
          name: _.trim(args.name),
          entryType: _.toUpper(args.entryType) === 'PROCESS' ? 'PROCESS' : 'SERVICE',
          description: _.trim(args.description || ''),
          linkUrl: _.trim(args.linkUrl || ''),
          department: _.trim(args.department || ''),
          team: _.trim(args.team || ''),
          tags: (args.tags || []).map(t => _.trim(t)).filter(Boolean),
          createdById: context.req.user.id,
          updatedById: context.req.user.id
        })
        return {
          responseResult: graphHelper.generateSuccess('Item created successfully.'),
          item: {
            ...item,
            tags: _.isArray(item.tags) ? item.tags : [],
            canDelete: true
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async update (obj, args, context) {
      try {
        const existing = await WIKI.models.serviceCatalogItems.query().findById(args.id)
        if (!existing) {
          throw new Error('Item not found.')
        }

        const item = await WIKI.models.serviceCatalogItems.query().patchAndFetchById(args.id, {
          name: _.trim(args.name),
          entryType: _.toUpper(args.entryType) === 'PROCESS' ? 'PROCESS' : 'SERVICE',
          description: _.trim(args.description || ''),
          linkUrl: _.trim(args.linkUrl || ''),
          department: _.trim(args.department || ''),
          team: _.trim(args.team || ''),
          tags: (args.tags || []).map(t => _.trim(t)).filter(Boolean),
          updatedById: context.req.user.id
        })

        return {
          responseResult: graphHelper.generateSuccess('Item updated successfully.'),
          item: {
            ...item,
            tags: _.isArray(item.tags) ? item.tags : [],
            canDelete: canDeleteItem(item, context.req.user)
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async delete (obj, args, context) {
      try {
        const item = await WIKI.models.serviceCatalogItems.query().findById(args.id)
        if (!item) {
          throw new Error('Item not found.')
        }
        if (!canDeleteItem(item, context.req.user)) {
          throw new Error('Only creator or administrator can delete this item.')
        }
        await WIKI.models.serviceCatalogItems.query().deleteById(args.id)
        return {
          responseResult: graphHelper.generateSuccess('Item deleted successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
