const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

function maskPAT(pat = '') {
  if (!pat || pat.length < 4) return ''
  return `${'*'.repeat(Math.max(0, pat.length - 4))}${pat.slice(-4)}`
}

module.exports = {
  Query: {
    azureDevOpsWiki: () => ({})
  },
  Mutation: {
    azureDevOpsWiki: () => ({})
  },
  AzureDevOpsWikiQuery: {
    async config() {
      const conf = await WIKI.azureDevOpsWiki.getConfig()
      return {
        enabled: !!conf.enabled,
        organization: conf.organization,
        hasPAT: !!conf.pat,
        patMasked: maskPAT(conf.pat),
        defaultProject: conf.defaultProject,
        defaultWiki: conf.defaultWiki,
        defaultLocale: conf.defaultLocale,
        targetBasePath: conf.targetBasePath,
        lastSyncAt: conf.lastSyncAt
      }
    },
    async projects() {
      return WIKI.azureDevOpsWiki.listProjects()
    },
    async wikis(obj, args) {
      return WIKI.azureDevOpsWiki.listWikis(args.project)
    }
  },
  AzureDevOpsWikiMutation: {
    async saveConfig(obj, args) {
      try {
        const current = await WIKI.azureDevOpsWiki.getConfig()
        await WIKI.azureDevOpsWiki.saveConfig({
          enabled: args.enabled,
          organization: args.organization,
          pat: _.trim(args.pat || '') || current.pat,
          defaultProject: args.defaultProject || '',
          defaultWiki: args.defaultWiki || '',
          defaultLocale: args.defaultLocale || current.defaultLocale,
          targetBasePath: args.targetBasePath || current.targetBasePath
        })
        return {
          responseResult: graphHelper.generateSuccess('Configuração Azure DevOps Wiki salva com sucesso.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async testConnection() {
      try {
        await WIKI.azureDevOpsWiki.listProjects()
        return {
          responseResult: graphHelper.generateSuccess('Conexão com Azure DevOps validada com sucesso.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async importFromAzure(obj, args, context) {
      try {
        const stats = await WIKI.azureDevOpsWiki.importFromAzure({
          project: args.project,
          wiki: args.wiki,
          rootPath: args.rootPath || '/',
          locale: args.locale,
          targetBasePath: args.targetBasePath,
          incremental: args.incremental !== false,
          user: context.req.user
        })

        return {
          responseResult: graphHelper.generateSuccess('Importação concluída.'),
          total: stats.total,
          imported: stats.imported,
          updated: stats.updated,
          skipped: stats.skipped,
          failed: stats.failed,
          items: stats.items
        }
      } catch (err) {
        return {
          responseResult: graphHelper.generateError(err).responseResult,
          total: 0,
          imported: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
          items: []
        }
      }
    }
  }
}
