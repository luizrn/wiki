const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

const SETTINGS_KEY = 'uptimeKuma'
const BASE_URL_DEFAULT = _.trim(process.env.UPTIME_KUMA_BASE_URL || 'https://uptime.tbdc.com.br')
const STATUS_SLUG_DEFAULT = _.trim(process.env.UPTIME_KUMA_STATUS_SLUG || '6455fergthukkiiolrttwqwszc5w55g4jk4kkop8j88hf')

function normalizeBaseUrl(baseUrl = '') {
  return _.trim(baseUrl || '').replace(/\/+$/, '')
}

async function getConfig() {
  const row = await WIKI.models.settings.query().findById(SETTINGS_KEY)
  const raw = _.get(row, 'value', {})
  const conf = _.has(raw, 'v') ? raw.v : raw
  const baseUrl = normalizeBaseUrl(conf.baseUrl || BASE_URL_DEFAULT)
  const statusSlug = _.trim(conf.statusSlug || STATUS_SLUG_DEFAULT)
  return {
    baseUrl,
    statusSlug,
    statusPageUrl: `${baseUrl}/status/${statusSlug}`
  }
}
module.exports = {
  Query: {
    uptimeKuma: () => ({})
  },
  Mutation: {
    uptimeKuma: () => ({})
  },
  UptimeKumaQuery: {
    async config() {
      return getConfig()
    }
  },
  UptimeKumaMutation: {
    async saveConfig(obj, args) {
      try {
        const baseUrl = normalizeBaseUrl(args.baseUrl)
        const statusSlug = _.trim(args.statusSlug || '')

        if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
          throw new Error('Informe uma URL base válida do Uptime Kuma (http/https).')
        }
        if (!statusSlug) {
          throw new Error('Informe o slug da Status Page.')
        }

        const payload = {
          v: {
            baseUrl,
            statusSlug
          }
        }

        const affected = await WIKI.models.settings.query()
          .patch({ value: payload })
          .where('key', SETTINGS_KEY)

        if (affected < 1) {
          await WIKI.models.settings.query().insert({
            key: SETTINGS_KEY,
            value: payload
          })
        }

        return {
          responseResult: graphHelper.generateSuccess('Configuração do Uptime Kuma salva com sucesso.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
