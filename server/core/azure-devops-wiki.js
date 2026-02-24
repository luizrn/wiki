const _ = require('lodash')
const crypto = require('crypto')
const request = require('request-promise')

/* global WIKI */

const SETTINGS_KEY = 'azureDevOpsWiki'

function nowISO() {
  return new Date().toISOString()
}

function slugifyPathSegment(input = '') {
  return _.trim(_.toString(input).toLowerCase())
    .replace(/[^a-z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-/]+|[-/]+$/g, '')
}

function normalizePath(path) {
  const p = _.toString(path || '/').trim()
  if (!p.startsWith('/')) return `/${p}`
  return p
}

function stripRootPrefix(path, rootPath) {
  const p = normalizePath(path)
  const r = normalizePath(rootPath)
  if (r === '/' || p === r) return ''
  if (p.startsWith(`${r}/`)) return p.slice(r.length + 1)
  return p.replace(/^\//, '')
}

function hashContent(content) {
  return crypto.createHash('sha1').update(content || '').digest('hex')
}

function parseJSONLineSummary(content = '') {
  const line = _.find((content || '').split(/\r?\n/), l => _.trim(l).length > 0) || ''
  return _.truncate(_.trim(line), { length: 240, omission: '' })
}

module.exports = {
  async getConfig() {
    const row = await WIKI.models.settings.query().findById(SETTINGS_KEY)
    const raw = _.get(row, 'value', {})
    const conf = _.has(raw, 'v') ? raw.v : raw
    return {
      enabled: !!conf.enabled,
      organization: conf.organization || '',
      pat: conf.pat || '',
      defaultProject: conf.defaultProject || '',
      defaultWiki: conf.defaultWiki || '',
      defaultLocale: conf.defaultLocale || WIKI.config.lang.code || 'en',
      targetBasePath: conf.targetBasePath || 'azure-devops',
      lastSyncAt: conf.lastSyncAt || null
    }
  },

  async saveConfig(config) {
    const current = await this.getConfig()
    const next = {
      ...current,
      ...config,
      organization: _.trim(config.organization || current.organization || ''),
      pat: _.trim(config.pat || current.pat || ''),
      defaultProject: _.trim(config.defaultProject || current.defaultProject || ''),
      defaultWiki: _.trim(config.defaultWiki || current.defaultWiki || ''),
      defaultLocale: _.trim(config.defaultLocale || current.defaultLocale || 'en'),
      targetBasePath: _.trim(config.targetBasePath || current.targetBasePath || 'azure-devops')
    }

    const payload = { v: next }
    const affected = await WIKI.models.settings.query().patch({ value: payload }).where('key', SETTINGS_KEY)
    if (affected < 1) {
      await WIKI.models.settings.query().insert({ key: SETTINGS_KEY, value: payload })
    }
    return next
  },

  async getAuthHeaders() {
    const conf = await this.getConfig()
    if (!conf.organization || !conf.pat) {
      throw new Error('Azure DevOps não está configurado (organization/pat).')
    }
    return {
      organization: conf.organization,
      headers: {
        Authorization: `Basic ${Buffer.from(`:${conf.pat}`).toString('base64')}`
      }
    }
  },

  async requestAZ(url, headers) {
    return request({
      method: 'GET',
      uri: url,
      json: true,
      headers: {
        ...headers,
        Accept: 'application/json'
      }
    })
  },

  async listProjects() {
    const { organization, headers } = await this.getAuthHeaders()
    const resp = await this.requestAZ(`https://dev.azure.com/${encodeURIComponent(organization)}/_apis/projects?api-version=7.1-preview.4`, headers)
    return _.get(resp, 'value', []).map(p => ({
      id: p.id,
      name: p.name,
      state: p.state
    }))
  },

  async listWikis(project) {
    const { organization, headers } = await this.getAuthHeaders()
    const resp = await this.requestAZ(`https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/wiki/wikis?api-version=7.1-preview.1`, headers)
    return _.get(resp, 'value', []).map(w => ({
      id: w.id,
      name: w.name,
      type: w.type,
      mappedPath: w.mappedPath || ''
    }))
  },

  async getPage(project, wikiIdentifier, pagePath) {
    const { organization, headers } = await this.getAuthHeaders()
    const pathEncoded = encodeURIComponent(normalizePath(pagePath))
    return this.requestAZ(
      `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages?path=${pathEncoded}&includeContent=true&recursionLevel=None&api-version=7.1-preview.1`,
      headers
    )
  },

  async getPageTree(project, wikiIdentifier, rootPath = '/') {
    const { organization, headers } = await this.getAuthHeaders()
    const pathEncoded = encodeURIComponent(normalizePath(rootPath))
    return this.requestAZ(
      `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages?path=${pathEncoded}&includeContent=false&recursionLevel=Full&api-version=7.1-preview.1`,
      headers
    )
  },

  flattenTree(node, out = []) {
    if (!node) return out
    if (node.path) out.push(node.path)
    for (const child of (node.subPages || [])) {
      this.flattenTree(child, out)
    }
    return out
  },

  buildWikiPath({ project, wiki, azurePath, rootPath, targetBasePath }) {
    const relative = stripRootPrefix(azurePath, rootPath)
    const root = slugifyPathSegment(targetBasePath || 'azure-devops') || 'azure-devops'
    const projectPart = slugifyPathSegment(project) || 'project'
    const wikiPart = slugifyPathSegment(wiki) || 'wiki'
    const relativeParts = relative.split('/').map(slugifyPathSegment).filter(Boolean)
    const suffix = relativeParts.length > 0 ? relativeParts.join('/') : 'home'
    return `${root}/${projectPart}/${wikiPart}/${suffix}`
  },

  async importFromAzure({
    project,
    wiki,
    rootPath = '/',
    locale,
    targetBasePath = 'azure-devops',
    incremental = true,
    user
  }) {
    const conf = await this.getConfig()
    const effectiveLocale = locale || conf.defaultLocale || WIKI.config.lang.code || 'en'
    const tree = await this.getPageTree(project, wiki, rootPath)
    const azurePaths = _.uniq(this.flattenTree(tree, []))

    let stats = { total: azurePaths.length, imported: 0, updated: 0, skipped: 0, failed: 0, items: [] }

    for (const azurePath of azurePaths) {
      try {
        const page = await this.getPage(project, wiki, azurePath)
        const markdown = _.toString(page.content || '').trim()
        const content = markdown.length > 0 ? markdown : `# ${_.last((azurePath || '/').split('/')) || 'Home'}`
        const sourceHash = hashContent(content)
        const wikiPath = this.buildWikiPath({
          project,
          wiki,
          azurePath,
          rootPath,
          targetBasePath
        })

        const mapping = await WIKI.models.knex('azureWikiSyncMap')
          .where({
            organization: conf.organization,
            project,
            wiki,
            azurePath
          })
          .first()

        if (incremental && mapping && mapping.contentHash === sourceHash) {
          stats.skipped++
          stats.items.push({ azurePath, wikiPath, action: 'skipped' })
          continue
        }

        const titleFromPath = _.last((azurePath || '/').split('/')) || 'Home'
        const title = _.trim(page.title || titleFromPath) || 'Home'
        const description = parseJSONLineSummary(content)
        const tags = _.uniq(['azure-devops', `azure-project-${slugifyPathSegment(project)}`, `azure-wiki-${slugifyPathSegment(wiki)}`])

        let existing = null
        if (mapping && mapping.pageId) {
          existing = await WIKI.models.pages.getPageFromDb(mapping.pageId)
        }
        if (!existing) {
          existing = await WIKI.models.pages.getPageFromDb({ path: wikiPath, locale: effectiveLocale })
        }

        let savedPage = null
        if (existing) {
          savedPage = await WIKI.models.pages.updatePage({
            id: existing.id,
            content,
            description,
            editor: existing.editorKey || 'markdown',
            isPrivate: existing.isPrivate === true || existing.isPrivate === 1,
            isPublished: true,
            locale: existing.localeCode || effectiveLocale,
            path: existing.path || wikiPath,
            publishEndDate: existing.publishEndDate || '',
            publishStartDate: existing.publishStartDate || '',
            scriptCss: _.get(existing, 'extra.css', ''),
            scriptJs: _.get(existing, 'extra.js', ''),
            tags,
            title,
            user
          })
          stats.updated++
          stats.items.push({ azurePath, wikiPath, action: 'updated', pageId: savedPage.id })
        } else {
          savedPage = await WIKI.models.pages.createPage({
            content,
            description,
            editor: 'markdown',
            isPrivate: false,
            isPublished: true,
            locale: effectiveLocale,
            path: wikiPath,
            publishEndDate: '',
            publishStartDate: '',
            scriptCss: '',
            scriptJs: '',
            tags,
            title,
            user
          })
          stats.imported++
          stats.items.push({ azurePath, wikiPath, action: 'imported', pageId: savedPage.id })
        }

        const lastSyncAt = nowISO()
        if (mapping) {
          await WIKI.models.knex('azureWikiSyncMap').where('id', mapping.id).update({
            pageId: savedPage.id,
            contentHash: sourceHash,
            lastSyncAt
          })
        } else {
          await WIKI.models.knex('azureWikiSyncMap').insert({
            pageId: savedPage.id,
            organization: conf.organization,
            project,
            wiki,
            azurePath,
            contentHash: sourceHash,
            lastSyncAt
          })
        }
      } catch (err) {
        stats.failed++
        stats.items.push({ azurePath, action: 'failed', error: err.message })
      }
    }

    await this.saveConfig({ lastSyncAt: nowISO() })
    return stats
  }
}
