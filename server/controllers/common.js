const express = require('express')
const router = express.Router()
const pageHelper = require('../helpers/page')
const _ = require('lodash')
const CleanCSS = require('clean-css')
const moment = require('moment')
const qs = require('querystring')
const articleExport = require('../helpers/article-export')
const request = require('request-promise')

/* global WIKI */

const tmplCreateRegex = /^[0-9]+(,[0-9]+)?$/
const UPTIME_KUMA_SETTINGS_KEY = 'uptimeKuma'
const UPTIME_KUMA_BASE_URL_DEFAULT = _.trim(process.env.UPTIME_KUMA_BASE_URL || 'https://uptime.tbdc.com.br')
const UPTIME_KUMA_STATUS_SLUG_DEFAULT = _.trim(process.env.UPTIME_KUMA_STATUS_SLUG || '6455fergthukkiiolrttwqwszc5w55g4jk4kkop8j88hf')
const UPTIME_SUMMARY_TTL_MS = 15000
const uptimeSummaryCache = {
  ts: 0,
  data: null
}

async function getCustomPageSidebar(req) {
  const localeCandidates = _.uniq([
    _.get(req, 'user.localeCode'),
    _.get(req, 'i18n.language'),
    _.get(WIKI, 'config.lang.code'),
    _.get(WIKI, 'config.lang')
  ].filter(lc => _.isString(lc) && !_.isEmpty(_.trim(lc))).map(lc => _.trim(lc)))

  if (!localeCandidates.includes('en')) {
    localeCandidates.push('en')
  }

  let navTree = []
  let selectedLocale = localeCandidates[0] || 'en'

  for (const lc of localeCandidates) {
    try {
      navTree = await WIKI.models.navigation.getTree({
        cache: true,
        locale: lc,
        groups: _.get(req, 'user.groups', [])
      })
      selectedLocale = lc
      break
    } catch (err) {
      // Keep trying with locale fallback.
    }
  }

  let sdi = 1
  const sidebar = (navTree || []).map(n => ({
    i: `sdi-${sdi++}`,
    k: n.kind,
    l: n.label,
    c: n.icon,
    y: n.targetType,
    t: n.target
  }))

  return {
    sidebar,
    navMode: _.get(WIKI, 'config.nav.mode', 'MIXED'),
    locale: selectedLocale
  }
}

async function getUptimeKumaConfig() {
  const row = await WIKI.models.settings.query().findById(UPTIME_KUMA_SETTINGS_KEY)
  const raw = _.get(row, 'value', {})
  const conf = _.has(raw, 'v') ? raw.v : raw
  const baseUrl = _.trim(conf.baseUrl || UPTIME_KUMA_BASE_URL_DEFAULT).replace(/\/+$/, '')
  const statusSlug = _.trim(conf.statusSlug || UPTIME_KUMA_STATUS_SLUG_DEFAULT)
  return {
    baseUrl,
    statusSlug,
    statusPageUrl: `${baseUrl}/status/${statusSlug}`
  }
}

function deriveUptimeOverallStatus({
  total,
  up,
  down,
  pending,
  maintenance
}) {
  if (total < 1) return 'Unknown'
  if (down === 0 && pending === 0 && maintenance === 0) return 'Operational'
  if (down === total) return 'Major Outage'
  if (down > 0) return 'Partially Degraded Service'
  if (maintenance === total) return 'Under Maintenance'
  if (pending > 0 || maintenance > 0) return 'Degraded Performance'
  return 'Unknown'
}

async function getUptimeSummary(uptimeConf) {
  const now = Date.now()
  if (uptimeSummaryCache.data && (now - uptimeSummaryCache.ts) < UPTIME_SUMMARY_TTL_MS) {
    return uptimeSummaryCache.data
  }

  const baseUrl = _.trim(_.get(uptimeConf, 'baseUrl', UPTIME_KUMA_BASE_URL_DEFAULT)).replace(/\/+$/, '')
  const statusSlug = _.trim(_.get(uptimeConf, 'statusSlug', UPTIME_KUMA_STATUS_SLUG_DEFAULT))
  const statusPageUrl = `${baseUrl}/status/${statusSlug}`

  const [statusPageData, heartbeatData] = await Promise.all([
    request({
      method: 'GET',
      uri: `${baseUrl}/api/status-page/${statusSlug}`,
      json: true,
      timeout: 10000
    }),
    request({
      method: 'GET',
      uri: `${baseUrl}/api/status-page/heartbeat/${statusSlug}`,
      json: true,
      timeout: 10000
    })
  ])

  const heartbeatList = _.get(heartbeatData, 'heartbeatList', {})
  let up = 0
  let down = 0
  let pending = 0
  let maintenance = 0
  let unknown = 0
  let total = 0

  _.forEach(heartbeatList, samples => {
    if (!_.isArray(samples) || samples.length < 1) return
    const lastSample = _.last(samples)
    if (!lastSample) return
    total++
    switch (_.toSafeInteger(lastSample.status)) {
      case 1:
        up++
        break
      case 0:
        down++
        break
      case 2:
        pending++
        break
      case 3:
        maintenance++
        break
      default:
        unknown++
        break
    }
  })

  const incident = _.get(statusPageData, 'incident')
  const incidentTitle = _.trim(_.get(incident, 'title', ''))
  const incidentContent = _.trim(_.get(incident, 'content', ''))
  const incidentActive = !!incident && (!_.isEmpty(incidentTitle) || !_.isEmpty(incidentContent))

  const computedOverall = deriveUptimeOverallStatus({ total, up, down, pending, maintenance })
  const overall = incidentActive ? 'Partially Degraded Service' : computedOverall

  const data = {
    ok: true,
    overall,
    total,
    up,
    down,
    pending,
    maintenance,
    unknown,
    incidentActive,
    incidentTitle,
    baseUrl,
    statusSlug,
    statusPageUrl,
    updatedAt: new Date().toISOString()
  }

  uptimeSummaryCache.ts = now
  uptimeSummaryCache.data = data
  return data
}

/**
 * Robots.txt
 */
router.get('/robots.txt', (req, res, next) => {
  res.type('text/plain')
  if (_.includes(WIKI.config.seo.robots, 'noindex')) {
    res.send('User-agent: *\nDisallow: /')
  } else {
    res.status(200).end()
  }
})

/**
 * Health Endpoint
 */
router.get('/healthz', (req, res, next) => {
  if (WIKI.models.knex.client.pool.numFree() < 1 && WIKI.models.knex.client.pool.numUsed() < 1) {
    res.status(503).json({ ok: false }).end()
  } else {
    res.status(200).json({ ok: true }).end()
  }
})

/**
 * Administration
 */
router.get(['/a', '/a/*'], (req, res, next) => {
  if (!WIKI.auth.checkAccess(req.user, [
    'manage:system',
    'write:users',
    'manage:users',
    'write:groups',
    'manage:groups',
    'manage:navigation',
    'manage:theme',
    'manage:api'
  ])) {
    _.set(res.locals, 'pageMeta.title', 'Unauthorized')
    return res.status(403).render('unauthorized', { action: 'view' })
  }

  _.set(res.locals, 'pageMeta.title', 'Admin')
  res.render('admin')
})

/**
 * Download Page / Version
 */
router.get(['/d', '/d/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })

  const versionId = (req.query.v) ? _.toSafeInteger(req.query.v) : 0

  const page = await WIKI.models.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })

  pageArgs.tags = _.get(page, 'tags', [])

  if (versionId > 0) {
    if (!WIKI.auth.checkAccess(req.user, ['read:history'], pageArgs)) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.status(403).render('unauthorized', { action: 'downloadVersion' })
    }
  } else {
    if (!WIKI.auth.checkAccess(req.user, ['read:source'], pageArgs)) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.status(403).render('unauthorized', { action: 'download' })
    }
  }

  if (page) {
    const fileName = _.last(page.path.split('/')) + '.' + pageHelper.getFileExtension(page.contentType)
    res.attachment(fileName)
    if (versionId > 0) {
      const pageVersion = await WIKI.models.pageHistory.getVersion({ pageId: page.id, versionId })
      res.send(pageHelper.injectPageMetadata(pageVersion))
    } else {
      res.send(pageHelper.injectPageMetadata(page))
    }
  } else {
    res.status(404).end()
  }
})

/**
 * Create/Edit document
 */
router.get(['/e', '/e/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })

  if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
    return res.redirect(`/e/${pageArgs.locale}/${pageArgs.path}`)
  }

  req.i18n.changeLanguage(pageArgs.locale)

  // -> Set Editor Lang
  _.set(res, 'locals.siteConfig.lang', pageArgs.locale)
  _.set(res, 'locals.siteConfig.rtl', req.i18n.dir() === 'rtl')

  // -> Check for reserved path
  if (pageHelper.isReservedPath(pageArgs.path)) {
    return next(new Error('Cannot create this page because it starts with a system reserved path.'))
  }

  // -> Get page data from DB
  let page = await WIKI.models.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })

  pageArgs.tags = _.get(page, 'tags', [])

  // -> Effective Permissions
  const effectivePermissions = WIKI.auth.getEffectivePermissions(req, pageArgs)

  const injectCode = {
    css: WIKI.config.theming.injectCSS,
    head: WIKI.config.theming.injectHead,
    body: WIKI.config.theming.injectBody
  }

  if (page) {
    // -> EDIT MODE
    if (!(effectivePermissions.pages.write || effectivePermissions.pages.manage)) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.status(403).render('unauthorized', { action: 'edit' })
    }

    // -> Get page tags
    await page.$relatedQuery('tags')
    page.tags = _.map(page.tags, 'tag')

    // Handle missing extra field
    page.extra = page.extra || { css: '', js: '' }

    // -> Beautify Script CSS
    if (!_.isEmpty(page.extra.css)) {
      page.extra.css = new CleanCSS({ format: 'beautify' }).minify(page.extra.css).styles
    }

    _.set(res.locals, 'pageMeta.title', `Edit ${page.title}`)
    _.set(res.locals, 'pageMeta.description', page.description)
    page.mode = 'update'
    page.isPublished = (page.isPublished === true || page.isPublished === 1) ? 'true' : 'false'
    page.content = Buffer.from(page.content).toString('base64')
  } else {
    // -> CREATE MODE
    if (!effectivePermissions.pages.write) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.status(403).render('unauthorized', { action: 'create' })
    }

    _.set(res.locals, 'pageMeta.title', `New Page`)
    page = {
      path: pageArgs.path,
      localeCode: pageArgs.locale,
      editorKey: null,
      mode: 'create',
      content: null,
      title: null,
      description: null,
      updatedAt: new Date().toISOString(),
      extra: {
        css: '',
        js: ''
      }
    }

    // -> From Template
    if (req.query.from && tmplCreateRegex.test(req.query.from)) {
      let tmplPageId = 0
      let tmplVersionId = 0
      if (req.query.from.indexOf(',')) {
        const q = req.query.from.split(',')
        tmplPageId = _.toSafeInteger(q[0])
        tmplVersionId = _.toSafeInteger(q[1])
      } else {
        tmplPageId = _.toSafeInteger(req.query.from)
      }

      if (tmplVersionId > 0) {
        // -> From Page Version
        const pageVersion = await WIKI.models.pageHistory.getVersion({ pageId: tmplPageId, versionId: tmplVersionId })
        if (!pageVersion) {
          _.set(res.locals, 'pageMeta.title', 'Page Not Found')
          return res.status(404).render('notfound', { action: 'template' })
        }
        if (!WIKI.auth.checkAccess(req.user, ['read:history'], { path: pageVersion.path, locale: pageVersion.locale })) {
          _.set(res.locals, 'pageMeta.title', 'Unauthorized')
          return res.status(403).render('unauthorized', { action: 'sourceVersion' })
        }
        page.content = Buffer.from(pageVersion.content).toString('base64')
        page.editorKey = pageVersion.editor
        page.title = pageVersion.title
        page.description = pageVersion.description
      } else {
        // -> From Page Live
        const pageOriginal = await WIKI.models.pages.query().findById(tmplPageId)
        if (!pageOriginal) {
          _.set(res.locals, 'pageMeta.title', 'Page Not Found')
          return res.status(404).render('notfound', { action: 'template' })
        }
        if (!WIKI.auth.checkAccess(req.user, ['read:source'], { path: pageOriginal.path, locale: pageOriginal.locale })) {
          _.set(res.locals, 'pageMeta.title', 'Unauthorized')
          return res.status(403).render('unauthorized', { action: 'source' })
        }
        page.content = Buffer.from(pageOriginal.content).toString('base64')
        page.editorKey = pageOriginal.editorKey
        page.title = pageOriginal.title
        page.description = pageOriginal.description
      }
    }
  }

  res.render('editor', { page, injectCode, effectivePermissions })
})

/**
 * History
 */
router.get(['/h', '/h/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })

  if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
    return res.redirect(`/h/${pageArgs.locale}/${pageArgs.path}`)
  }

  req.i18n.changeLanguage(pageArgs.locale)

  _.set(res, 'locals.siteConfig.lang', pageArgs.locale)
  _.set(res, 'locals.siteConfig.rtl', req.i18n.dir() === 'rtl')

  const page = await WIKI.models.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })

  if (!page) {
    _.set(res.locals, 'pageMeta.title', 'Page Not Found')
    return res.status(404).render('notfound', { action: 'history' })
  }

  pageArgs.tags = _.get(page, 'tags', [])

  const effectivePermissions = WIKI.auth.getEffectivePermissions(req, pageArgs)

  if (!effectivePermissions.history.read) {
    _.set(res.locals, 'pageMeta.title', 'Unauthorized')
    return res.render('unauthorized', { action: 'history' })
  }

  if (page) {
    _.set(res.locals, 'pageMeta.title', page.title)
    _.set(res.locals, 'pageMeta.description', page.description)

    res.render('history', { page, effectivePermissions })
  } else {
    res.redirect(`/${pageArgs.path}`)
  }
})

/**
 * Page ID redirection
 */
router.get(['/i', '/i/:id'], async (req, res, next) => {
  const pageId = _.toSafeInteger(req.params.id)
  if (pageId <= 0) {
    return res.redirect('/')
  }

  const page = await WIKI.models.pages.query().column(['path', 'localeCode', 'isPrivate', 'privateNS']).findById(pageId)
  if (!page) {
    _.set(res.locals, 'pageMeta.title', 'Page Not Found')
    return res.status(404).render('notfound', { action: 'view' })
  }

  if (!WIKI.auth.checkAccess(req.user, ['read:pages'], {
    locale: page.localeCode,
    path: page.path,
    private: page.isPrivate,
    privateNS: page.privateNS,
    explicitLocale: false,
    tags: page.tags
  })) {
    _.set(res.locals, 'pageMeta.title', 'Unauthorized')
    return res.status(403).render('unauthorized', { action: 'view' })
  }

  if (WIKI.config.lang.namespacing) {
    return res.redirect(`/${page.localeCode}/${page.path}`)
  } else {
    return res.redirect(`/${page.path}`)
  }
})

/**
 * Profile
 */
router.get(['/p', '/p/*'], (req, res, next) => {
  if (!req.user || req.user.id < 1 || req.user.id === 2) {
    return res.status(403).render('unauthorized', { action: 'view' })
  }

  _.set(res.locals, 'pageMeta.title', 'User Profile')
  res.render('profile')
})

/**
 * Boards
 */
router.get(['/boards', '/boards/*'], async (req, res, next) => {
  if (!req.user || req.user.id < 1 || req.user.id === 2) {
    return res.status(403).render('unauthorized', { action: 'view' })
  }
  try {
    const sidebarData = await getCustomPageSidebar(req)
    _.set(res.locals, 'pageMeta.title', 'Boards')
    res.render('boards', sidebarData)
  } catch (err) {
    next(err)
  }
})

/**
 * Dashboard
 */
router.get(['/dashboard', '/dashboard/*'], async (req, res, next) => {
  if (!req.user || req.user.id < 1 || req.user.id === 2) {
    return res.status(403).render('unauthorized', { action: 'view' })
  }
  try {
    const sidebarData = await getCustomPageSidebar(req)
    _.set(res.locals, 'pageMeta.title', 'Dashboard')
    res.render('dashboard', sidebarData)
  } catch (err) {
    next(err)
  }
})

/**
 * Locale-prefixed custom pages (canonical redirect)
 */
router.get('/:locale/:section(boards|dashboard|tbdc-companies|status)', (req, res) => {
  res.redirect(`/${req.params.section}`)
})

router.get('/:locale/:section(boards|dashboard|tbdc-companies|status)/*', (req, res) => {
  const suffix = _.trim(_.get(req.params, '0', ''), '/')
  return _.isEmpty(suffix) ? res.redirect(`/${req.params.section}`) : res.redirect(`/${req.params.section}/${suffix}`)
})

/**
 * Updates (Novidades)
 */
router.get('/novidades/data', async (req, res) => {
  try {
    const categories = await WIKI.models.knex('tbdc_update_categories')
      .select('id', 'name', 'color', 'icon', 'showOnPublicPage', 'order')
      .where('showOnPublicPage', true)
      .orderBy('order', 'ASC')

    const updateRows = await WIKI.models.knex('tbdc_updates as u')
      .leftJoin('tbdc_update_categories as c', 'c.id', 'u.categoryId')
      .select(
        'u.id',
        'u.title',
        'u.content',
        'u.summary',
        'u.categoryId',
        'u.publishedAt',
        'c.id as category_id',
        'c.name as category_name',
        'c.color as category_color',
        'c.icon as category_icon',
        'c.showOnPublicPage as category_showOnPublicPage'
      )
      .where('u.isPublished', true)
      .where(builder => {
        builder.whereNull('u.categoryId').orWhere('c.showOnPublicPage', true)
      })
      .orderBy('u.publishedAt', 'DESC')
      .orderBy('u.createdAt', 'DESC')
      .limit(50)

    const updates = updateRows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      summary: row.summary,
      categoryId: row.categoryId,
      publishedAt: row.publishedAt,
      category: row.category_id ? {
        id: row.category_id,
        name: row.category_name,
        color: row.category_color,
        icon: row.category_icon,
        showOnPublicPage: row.category_showOnPublicPage
      } : null
    }))

    const configRows = await WIKI.models.knex('tbdc_update_config').select('key', 'value')
    const sidebarLinksRaw = _.get(_.find(configRows, { key: 'sidebarLinks' }), 'value', '[]')
    let sidebarLinks = []
    try {
      sidebarLinks = JSON.parse(sidebarLinksRaw || '[]')
    } catch (err) {
      sidebarLinks = []
    }

    res.status(200).json({
      ok: true,
      updates,
      categories,
      sidebarLinks
    })
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err.message || 'Falha ao carregar novidades públicas.'
    })
  }
})

router.get(['/novidades', '/novidades/*'], (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'Novidades')
  res.render('tbdc-updates-public')
})

/**
 * TBDC Companies
 */
router.get(['/tbdc-companies', '/tbdc-companies/*'], async (req, res, next) => {
  if (!req.user || req.user.id < 1 || req.user.id === 2) {
    _.set(res.locals, 'pageMeta.title', 'Unauthorized')
    return res.status(403).render('unauthorized', { action: 'view' })
  }
  try {
    const sidebarData = await getCustomPageSidebar(req)
    _.set(res.locals, 'pageMeta.title', 'Permissoes TBDC')
    res.render('tbdc-companies', sidebarData)
  } catch (err) {
    next(err)
  }
})

router.get('/tbdc-master', (req, res, next) => {
  res.redirect('/a/tbdc-master')
})

/**
 * Status Page
 */
router.get('/status/summary', async (req, res) => {
  try {
    const uptimeConf = await getUptimeKumaConfig()
    const summary = await getUptimeSummary(uptimeConf)
    res.status(200).json(summary)
  } catch (err) {
    res.status(502).json({
      ok: false,
      message: err.message || 'Falha ao consultar status do Uptime Kuma.'
    })
  }
})

/**
 * Status Page
 */
router.get(['/status', '/status/*'], (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'Status')
  res.render('status')
})

/**
 * Source
 */
router.get(['/s', '/s/*'], async (req, res, next) => {
  const pageArgs = pageHelper.parsePath(req.path, { stripExt: true })
  const versionId = (req.query.v) ? _.toSafeInteger(req.query.v) : 0

  const page = await WIKI.models.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: req.user.id,
    isPrivate: false
  })

  pageArgs.tags = _.get(page, 'tags', [])

  if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
    return res.redirect(`/s/${pageArgs.locale}/${pageArgs.path}`)
  }

  // -> Effective Permissions
  const effectivePermissions = WIKI.auth.getEffectivePermissions(req, pageArgs)

  _.set(res, 'locals.siteConfig.lang', pageArgs.locale)
  _.set(res, 'locals.siteConfig.rtl', req.i18n.dir() === 'rtl')

  if (versionId > 0) {
    if (!effectivePermissions.history.read) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.status(403).render('unauthorized', { action: 'sourceVersion' })
    }
  } else {
    if (!effectivePermissions.source.read) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.status(403).render('unauthorized', { action: 'source' })
    }
  }

  if (page) {
    if (versionId > 0) {
      const pageVersion = await WIKI.models.pageHistory.getVersion({ pageId: page.id, versionId })
      _.set(res.locals, 'pageMeta.title', pageVersion.title)
      _.set(res.locals, 'pageMeta.description', pageVersion.description)
      res.render('source', {
        page: {
          ...page,
          ...pageVersion
        },
        effectivePermissions
      })
    } else {
      _.set(res.locals, 'pageMeta.title', page.title)
      _.set(res.locals, 'pageMeta.description', page.description)

      res.render('source', { page, effectivePermissions })
    }
  } else {
    res.redirect(`/${pageArgs.path}`)
  }
})

/**
 * Tags
 */
router.get(['/t', '/t/*'], (req, res, next) => {
  _.set(res.locals, 'pageMeta.title', 'Tags')
  res.render('tags')
})

/**
 * Export article on demand (no file storage)
 */
router.get('/x/:format/:locale/*', async (req, res, next) => {
  try {
    const format = _.toLower(req.params.format || '')
    const locale = _.trim(req.params.locale || '')
    const pagePath = _.trim(_.get(req.params, '0', '') || '')
    if (!format || !locale || !pagePath) {
      return res.status(400).json({ ok: false, message: 'Invalid export path.' })
    }

    const page = await WIKI.models.pages.getPageFromDb({
      path: pagePath,
      locale,
      userId: req.user.id,
      isPrivate: false
    })
    if (!page) {
      _.set(res.locals, 'pageMeta.title', 'Page Not Found')
      return res.status(404).render('notfound', { action: 'view' })
    }

    const pageArgs = {
      path: page.path,
      locale: page.localeCode,
      tags: _.get(page, 'tags', [])
    }
    const effectivePermissions = WIKI.auth.getEffectivePermissions(req, pageArgs)
    if (!effectivePermissions.pages.read) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.status(403).render('unauthorized', { action: 'view' })
    }

    let pageIsPublished = page.isPublished
    if (pageIsPublished && !_.isEmpty(page.publishStartDate)) {
      pageIsPublished = moment(page.publishStartDate).isSameOrBefore()
    }
    if (pageIsPublished && !_.isEmpty(page.publishEndDate)) {
      pageIsPublished = moment(page.publishEndDate).isSameOrAfter()
    }
    if (!pageIsPublished && !effectivePermissions.pages.write) {
      _.set(res.locals, 'pageMeta.title', 'Unauthorized')
      return res.status(403).render('unauthorized', { action: 'view' })
    }

    const file = await articleExport.generate(format, page)
    res.setHeader('Content-Type', file.mime)
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(file.buffer)
  } catch (err) {
    next(err)
  }
})

/**
 * Public Access Link
 */
router.get('/pub/:token', async (req, res, next) => {
  try {
    const link = await WIKI.models.pagePublicLinks.query()
      .where('token', req.params.token)
      .where('status', 'APPROVED')
      .first()

    if (!link) {
      _.set(res.locals, 'pageMeta.title', 'Link Not Found or Expired')
      return res.status(404).render('notfound', { action: 'view' })
    }

    // Increment views
    await WIKI.models.pagePublicLinks.query().patch({
      views: link.views + 1
    }).findById(link.id)

    // Get Page
    const page = await WIKI.models.pages.getPage({
      id: link.pageId,
      userId: req.user.id,
      isPrivate: false
    })

    if (!page) {
      _.set(res.locals, 'pageMeta.title', 'Page Not Found')
      return res.status(404).render('notfound', { action: 'view' })
    }

    _.set(res.locals, 'pageMeta.title', page.title)
    _.set(res.locals, 'pageMeta.description', page.description)
    _.set(res.locals, 'pageMeta.robots', 'noindex, nofollow')

    // -> Build sidebar navigation (empty for public links to keep it simple and restricted)
    const sidebar = []

    // -> Build theme code injection
    const injectCode = {
      css: WIKI.config.theming.injectCSS,
      head: WIKI.config.theming.injectHead,
      body: WIKI.config.theming.injectBody
    }

    // Handle missing extra field
    page.extra = page.extra || { css: '', js: '' }

    if (!_.isEmpty(page.extra.css)) {
      injectCode.css = `${injectCode.css}\n${page.extra.css}`
    }

    if (!_.isEmpty(page.extra.js)) {
      injectCode.body = `${injectCode.body}\n${page.extra.js}`
    }

    // -> Convert page TOC
    if (!_.isString(page.toc)) {
      page.toc = JSON.stringify(page.toc)
    }

    // -> Render view
    res.render('page', {
      page,
      sidebar,
      injectCode,
      comments: { codeTemplate: '', head: '', body: '', main: '' },
      effectivePermissions: {
        pages: { read: true, write: false, manage: false },
        history: { read: false },
        source: { read: false }
      },
      pageFilename: ''
    })
  } catch (err) {
    next(err)
  }
})

/**
 * User Avatar
 */
router.get('/_userav/:uid', async (req, res, next) => {
  if (!WIKI.auth.checkAccess(req.user, ['read:pages'])) {
    return res.sendStatus(403)
  }
  const av = await WIKI.models.users.getUserAvatarData(req.params.uid)
  if (av) {
    res.set('Content-Type', 'image/jpeg')
    res.send(av)
  }

  return res.sendStatus(404)
})

/**
 * View document / asset
 */
router.get('/*', async (req, res, next) => {
  const stripExt = _.some(WIKI.config.pageExtensions, ext => _.endsWith(req.path, `.${ext}`))
  const pageArgs = pageHelper.parsePath(req.path, { stripExt })
  const isPage = (stripExt || pageArgs.path.indexOf('.') === -1)

  if (isPage) {
    if (WIKI.config.lang.namespacing && !pageArgs.explicitLocale) {
      const query = !_.isEmpty(req.query) ? `?${qs.stringify(req.query)}` : ''
      return res.redirect(`/${pageArgs.locale}/${pageArgs.path}${query}`)
    }

    req.i18n.changeLanguage(pageArgs.locale)

    try {
      // -> Get Page from cache
      const page = await WIKI.models.pages.getPage({
        path: pageArgs.path,
        locale: pageArgs.locale,
        userId: req.user.id,
        isPrivate: false
      })
      pageArgs.tags = _.get(page, 'tags', [])

      // -> Effective Permissions
      const effectivePermissions = WIKI.auth.getEffectivePermissions(req, pageArgs)

      // -> Check User Access
      if (!effectivePermissions.pages.read) {
        if (req.user.id === 2) {
          res.cookie('loginRedirect', req.path, {
            maxAge: 15 * 60 * 1000
          })
        }
        if (pageArgs.path === 'home' && req.user.id === 2) {
          return res.redirect('/login')
        }
        _.set(res.locals, 'pageMeta.title', 'Unauthorized')
        return res.status(403).render('unauthorized', {
          action: 'view'
        })
      }

      _.set(res, 'locals.siteConfig.lang', pageArgs.locale)
      _.set(res, 'locals.siteConfig.rtl', req.i18n.dir() === 'rtl')

      if (page) {
        _.set(res.locals, 'pageMeta.title', page.title)
        _.set(res.locals, 'pageMeta.description', page.description)

        // -> Check Publishing State
        let pageIsPublished = page.isPublished
        if (pageIsPublished && !_.isEmpty(page.publishStartDate)) {
          pageIsPublished = moment(page.publishStartDate).isSameOrBefore()
        }
        if (pageIsPublished && !_.isEmpty(page.publishEndDate)) {
          pageIsPublished = moment(page.publishEndDate).isSameOrAfter()
        }
        if (!pageIsPublished && !effectivePermissions.pages.write) {
          _.set(res.locals, 'pageMeta.title', 'Unauthorized')
          return res.status(403).render('unauthorized', {
            action: 'view'
          })
        }

        // -> Build sidebar navigation
        let sdi = 1
        const sidebar = (await WIKI.models.navigation.getTree({ cache: true, locale: pageArgs.locale, groups: req.user.groups })).map(n => ({
          i: `sdi-${sdi++}`,
          k: n.kind,
          l: n.label,
          c: n.icon,
          y: n.targetType,
          t: n.target
        }))

        // -> Build theme code injection
        const injectCode = {
          css: WIKI.config.theming.injectCSS,
          head: WIKI.config.theming.injectHead,
          body: WIKI.config.theming.injectBody
        }

        // Handle missing extra field
        page.extra = page.extra || { css: '', js: '' }

        if (!_.isEmpty(page.extra.css)) {
          injectCode.css = `${injectCode.css}\n${page.extra.css}`
        }

        if (!_.isEmpty(page.extra.js)) {
          injectCode.body = `${injectCode.body}\n${page.extra.js}`
        }

        if (req.query.legacy || (req.get('user-agent') && req.get('user-agent').indexOf('Trident') >= 0)) {
          // -> Convert page TOC
          if (_.isString(page.toc)) {
            page.toc = JSON.parse(page.toc)
          }

          // -> Render legacy view
          res.render('legacy/page', {
            page,
            sidebar,
            injectCode,
            isAuthenticated: req.user && req.user.id !== 2
          })
        } else {
          // -> Convert page TOC
          if (!_.isString(page.toc)) {
            page.toc = JSON.stringify(page.toc)
          }

          // -> Inject comments variables
          const commentTmpl = {
            codeTemplate: WIKI.data.commentProvider.codeTemplate,
            head: WIKI.data.commentProvider.head,
            body: WIKI.data.commentProvider.body,
            main: WIKI.data.commentProvider.main
          }
          if (WIKI.config.features.featurePageComments && WIKI.data.commentProvider.codeTemplate) {
            [
              { key: 'pageUrl', value: `${WIKI.config.host}/i/${page.id}` },
              { key: 'pageId', value: page.id }
            ].forEach((cfg) => {
              commentTmpl.head = _.replace(commentTmpl.head, new RegExp(`{{${cfg.key}}}`, 'g'), cfg.value)
              commentTmpl.body = _.replace(commentTmpl.body, new RegExp(`{{${cfg.key}}}`, 'g'), cfg.value)
              commentTmpl.main = _.replace(commentTmpl.main, new RegExp(`{{${cfg.key}}}`, 'g'), cfg.value)
            })
          }

          // -> Page Filename (for edit on external repo button)
          let pageFilename = WIKI.config.lang.namespacing ? `${pageArgs.locale}/${page.path}` : page.path
          pageFilename += page.contentType === 'markdown' ? '.md' : '.html'

          // -> Track page visit for dashboard metrics
          WIKI.models.pageVisits.query().insert({
            pageId: page.id,
            userId: (req.user && req.user.id > 2) ? req.user.id : null,
            localeCode: page.localeCode,
            path: page.path,
            createdAt: new Date().toISOString()
          }).catch(() => {})

          // -> Render view
          res.render('page', {
            page,
            sidebar,
            injectCode,
            comments: commentTmpl,
            effectivePermissions,
            pageFilename
          })
        }
      } else if (pageArgs.path === 'home') {
        if (req.user && req.user.id > 2) {
          _.set(res.locals, 'pageMeta.title', 'Dashboard')
          const sidebarData = await getCustomPageSidebar(req)
          res.render('dashboard', sidebarData)
        } else {
          _.set(res.locals, 'pageMeta.title', 'Welcome')
          res.render('welcome', { locale: pageArgs.locale })
        }
      } else {
        _.set(res.locals, 'pageMeta.title', 'Page Not Found')
        if (effectivePermissions.pages.write) {
          res.status(404).render('new', { path: pageArgs.path, locale: pageArgs.locale })
        } else {
          res.status(404).render('notfound', { action: 'view' })
        }
      }
    } catch (err) {
      next(err)
    }
  } else {
    if (!WIKI.auth.checkAccess(req.user, ['read:assets'], pageArgs)) {
      return res.sendStatus(403)
    }

    await WIKI.models.assets.getAsset(pageArgs.path, res)
  }
})

module.exports = router
