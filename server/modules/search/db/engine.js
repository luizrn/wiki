/* global WIKI */

const MAX_SEARCH_TERMS = 8

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

function addTermMatcher(builder, likePattern) {
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

    const results = await WIKI.models.pages.query()
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
          addTermMatcher(builderSub, queryLike)
        })
        if (termLikes.length > 1) {
          for (const termLike of termLikes) {
            builder.andWhere(builderSub => {
              addTermMatcher(builderSub, termLike)
            })
          }
        }
      })
      .orderByRaw(`(${scoreExpr.join(' + ')}) DESC`, scoreParams)
      .orderBy('title', 'asc')
      .limit(maxHits)

    if (results.length > 0) {
      const pageIds = results.map(r => r.id)
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
        row.tags = tagsByPageId.get(row.id) || []
      }
    }

    return {
      results,
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
