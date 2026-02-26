/* global WIKI */

const _ = require('lodash')

const MAX_SEARCH_TERMS = 8
const PG_SEARCH_DOC_EXPR = `LOWER(
  COALESCE(title, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(content, '') || ' ' ||
  COALESCE(render, '') || ' ' ||
  COALESCE(path, '')
)`

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&')
}

function splitTerms(query) {
  return Array.from(new Set(
    query
      .toLowerCase()
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length > 1)
  )).slice(0, MAX_SEARCH_TERMS)
}

function buildMysqlBooleanQuery(query) {
  const terms = splitTerms(query).map(term => `${term}*`)
  if (terms.length < 1) {
    return null
  }
  return terms.join(' ')
}

function addTermMatcher(builder, likePattern, isPostgres) {
  if (WIKI.config.db.type === 'mysql' || WIKI.config.db.type === 'mariadb') {
    const booleanQuery = buildMysqlBooleanQuery(likePattern.replace(/%/g, ' ').trim())
    if (booleanQuery) {
      builder.whereRaw(`
        MATCH (title, description, content, render, path)
        AGAINST (? IN BOOLEAN MODE)
      `, [booleanQuery])
      return
    }
  }

  if (isPostgres) {
    builder.whereRaw(`${PG_SEARCH_DOC_EXPR} LIKE ?`, [likePattern])
    return
  }
  builder.whereRaw(`LOWER(COALESCE(title, '')) LIKE ? ESCAPE '\\'`, [likePattern])
    .orWhereRaw(`LOWER(COALESCE(description, '')) LIKE ? ESCAPE '\\'`, [likePattern])
    .orWhereRaw(`LOWER(COALESCE(content, '')) LIKE ? ESCAPE '\\'`, [likePattern])
    .orWhereRaw(`LOWER(COALESCE(render, '')) LIKE ? ESCAPE '\\'`, [likePattern])
    .orWhereRaw(`LOWER(COALESCE(path, '')) LIKE ? ESCAPE '\\'`, [likePattern])
}

module.exports = {
  activate() {
    // not used
  },
  deactivate() {
    // not used
  },
  /**
   * INIT
   */
  init() {
    // not used
  },
  /**
   * QUERY
   *
   * @param {String} q Query
   * @param {Object} opts Additional options
   */
  async query(q, opts) {
    const query = (q || '').trim()
    if (query.length < 2) {
      return {
        results: [],
        suggestions: [],
        totalHits: 0
      }
    }

    const queryLower = query.toLowerCase()
    const queryLike = `%${escapeLike(queryLower)}%`
    const queryStartsWith = `${escapeLike(queryLower)}%`
    const terms = splitTerms(query)
    const termLikes = terms.map(term => `%${escapeLike(term)}%`)
    const maxHits = Number(WIKI.config.search.maxHits) || 50
    const isPostgres = WIKI.config.db.type === 'postgres'
    const isMySQLFamily = WIKI.config.db.type === 'mysql' || WIKI.config.db.type === 'mariadb'

    const scoreExpr = []
    const scoreParams = []

    scoreExpr.push(`CASE WHEN LOWER(COALESCE(title, '')) = ? THEN 120 ELSE 0 END`)
    scoreParams.push(queryLower)
    scoreExpr.push(`CASE WHEN LOWER(COALESCE(title, '')) LIKE ? ESCAPE '\\' THEN 80 ELSE 0 END`)
    scoreParams.push(queryStartsWith)
    scoreExpr.push(`CASE WHEN LOWER(COALESCE(title, '')) LIKE ? ESCAPE '\\' THEN 55 ELSE 0 END`)
    scoreParams.push(queryLike)
    scoreExpr.push(`CASE WHEN LOWER(COALESCE(description, '')) LIKE ? ESCAPE '\\' THEN 30 ELSE 0 END`)
    scoreParams.push(queryLike)
    scoreExpr.push(`CASE WHEN LOWER(COALESCE(content, '')) LIKE ? ESCAPE '\\' THEN 20 ELSE 0 END`)
    scoreParams.push(queryLike)
    scoreExpr.push(`CASE WHEN LOWER(COALESCE(render, '')) LIKE ? ESCAPE '\\' THEN 15 ELSE 0 END`)
    scoreParams.push(queryLike)
    scoreExpr.push(`CASE WHEN LOWER(COALESCE(path, '')) LIKE ? ESCAPE '\\' THEN 10 ELSE 0 END`)
    scoreParams.push(queryLike)

    for (const termLike of termLikes) {
      scoreExpr.push(`CASE WHEN LOWER(COALESCE(title, '')) LIKE ? ESCAPE '\\' THEN 16 ELSE 0 END`)
      scoreParams.push(termLike)
      scoreExpr.push(`CASE WHEN LOWER(COALESCE(description, '')) LIKE ? ESCAPE '\\' THEN 8 ELSE 0 END`)
      scoreParams.push(termLike)
      scoreExpr.push(`CASE WHEN LOWER(COALESCE(content, '')) LIKE ? ESCAPE '\\' THEN 5 ELSE 0 END`)
      scoreParams.push(termLike)
      scoreExpr.push(`CASE WHEN LOWER(COALESCE(render, '')) LIKE ? ESCAPE '\\' THEN 4 ELSE 0 END`)
      scoreParams.push(termLike)
      scoreExpr.push(`CASE WHEN LOWER(COALESCE(path, '')) LIKE ? ESCAPE '\\' THEN 3 ELSE 0 END`)
      scoreParams.push(termLike)
    }

    let results = []

    // -> Search Pages
    if (opts.filterPages !== false) {
      results = await WIKI.models.pages.query()
        .column('pages.id', 'title', 'description', 'path', 'localeCode as locale')
        .where(builder => {
          builder.where('isPublished', true)
          if (opts.locale) {
            builder.andWhere('localeCode', opts.locale)
          }
          if (opts.path) {
            builder.andWhere('path', 'like', `${opts.path}%`)
          }
          builder.andWhere(builderSub => {
            addTermMatcher(builderSub, queryLike, isPostgres)
          })
          if (!isMySQLFamily && termLikes.length > 1) {
            for (const termLike of termLikes) {
              builder.andWhere(builderSub => {
                addTermMatcher(builderSub, termLike, isPostgres)
              })
            }
          }
        })
        .orderByRaw(`(${scoreExpr.join(' + ')}) DESC`, scoreParams)
        .orderBy('title', 'asc')
        .limit(maxHits)
    }

    // -> Search TBDC Company Permissions
    const shouldSearchCompanyPermissions = (
      opts.filterCompanyPermissions === true ||
      (typeof opts.filterCompanyPermissions === 'undefined' && opts.filterPermissions !== false)
    )
    if (shouldSearchCompanyPermissions) {
      const tbdcResults = await WIKI.models.knex('tbdc_permissions')
        .join('tbdc_companies', 'tbdc_permissions.companyId', 'tbdc_companies.id')
        .join('tbdc_modules', 'tbdc_permissions.moduleId', 'tbdc_modules.id')
        .select(
          'tbdc_permissions.id as permissionId',
          'tbdc_permissions.ruleName as ruleName',
          'tbdc_permissions.description as ruleDescription',
          'tbdc_companies.id as companyId',
          'tbdc_companies.name as companyName',
          'tbdc_modules.name as moduleName'
        )
        .where(builder => {
          builder.where('tbdc_permissions.isActive', true)
          builder.andWhere(builderSub => {
            builderSub.where('tbdc_companies.name', 'LIKE', queryLike)
              .orWhere('tbdc_modules.name', 'LIKE', queryLike)
              .orWhere('tbdc_permissions.ruleName', 'LIKE', queryLike)
              .orWhere('tbdc_permissions.description', 'LIKE', queryLike)
          })
        })
        .limit(maxHits)

      const companyGroups = _.groupBy(tbdcResults, 'companyId')
      const companyItems = _.map(companyGroups, (rows, companyId) => {
        const first = rows[0] || {}
        const modules = _.uniq(rows.map(r => r.moduleName).filter(Boolean))
        const rules = _.uniq(rows.map(r => r.ruleName).filter(Boolean))
        const snippets = _.uniq(rows.map(r => r.ruleDescription).filter(Boolean))
        return {
          id: `tbdc-company-${companyId}`,
          title: first.companyName || 'Permissões de Empresa',
          description: _.truncate(
            `Módulos: ${modules.join(', ')} | Regras: ${rules.join(', ')}${snippets.length > 0 ? ` | ${snippets[0]}` : ''}`,
            { length: 180, omission: '...' }
          ),
          path: `tbdc-companies/${companyId}/details`,
          locale: 'pt-br'
        }
      })

      results = _.concat(results, companyItems)
    }

    // -> Search TBDC Updates
    if (opts.filterUpdates === true) {
      const updateResults = await WIKI.models.knex('tbdc_updates')
        .join('tbdc_update_categories', 'tbdc_updates.categoryId', 'tbdc_update_categories.id')
        .select(
          'tbdc_updates.id as updateId',
          'tbdc_updates.title as updateTitle',
          'tbdc_updates.content as updateContent',
          'tbdc_updates.summary as updateSummary',
          'tbdc_update_categories.name as categoryName'
        )
        .where(builder => {
          builder.where('tbdc_updates.isPublished', true)
          builder.andWhere(builderSub => {
            builderSub.where('tbdc_updates.title', 'LIKE', queryLike)
              .orWhere('tbdc_updates.content', 'LIKE', queryLike)
              .orWhere('tbdc_updates.summary', 'LIKE', queryLike)
          })
        })
        .limit(maxHits)

      results = _.concat(results, updateResults.map(r => ({
        id: `update-${r.updateId}`,
        title: r.updateTitle,
        description: `${r.categoryName}: ${_.truncate(r.updateContent || r.updateSummary || '', { length: 100, omission: '' })}`,
        path: 'novidades',
        locale: 'pt'
      })))
    }

    if (results.length > 0) {
      const isExternalResult = (id) => _.startsWith(String(id), 'tbdc-') || _.startsWith(String(id), 'update-')
      const pageIds = results.filter(r => !isExternalResult(r.id)).map(r => r.id)
      if (pageIds.length > 0) {
        const tagsRaw = await WIKI.models.knex('pageTags')
          .leftJoin('tags', 'tags.id', 'pageTags.tagId')
          .select('pageTags.pageId as pageId', 'tags.tag as tag')
          .whereIn('pageTags.pageId', pageIds)

        const tagsByPageId = new Map()
        for (const row of tagsRaw) {
          if (!tagsByPageId.has(row.pageId)) {
            tagsByPageId.set(row.pageId, [])
          }
          tagsByPageId.get(row.pageId).push({ tag: row.tag })
        }

        for (const row of results) {
          if (!isExternalResult(row.id)) {
            row.tags = tagsByPageId.get(row.id) || []
          } else {
            row.tags = []
          }
        }
      } else {
        for (const row of results) {
          row.tags = []
        }
      }
    }

    return {
      results: _.take(results, maxHits),
      suggestions: [],
      totalHits: results.length
    }
  },

  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created(page) {
    // not used
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    // not used
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    // not used
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    // not used
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    // not used
  }
}
