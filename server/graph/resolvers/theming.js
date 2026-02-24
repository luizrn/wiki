const graphHelper = require('../../helpers/graph')
const _ = require('lodash')
const CleanCSS = require('clean-css')
const path = require('path')
const fs = require('fs-extra')

/* global WIKI */

const COLOR_DEFAULTS = {
  primaryColor: '#18563B',
  secondaryColor: '#9BC113',
  headerColor: '#18563B',
  footerColor: '#18563B',
  successColor: '#18563B',
  warningColor: '#9BC113',
  errorColor: '#D32F2F',
  infoColor: '#18563B',
  neutralColor: '#90A4AE'
}

function normalizeHexColor (input, fallback) {
  const value = _.trim(_.toString(input || '')).toUpperCase()
  return /^#[0-9A-F]{6}$/.test(value) ? value : fallback
}

module.exports = {
  Query: {
    async theming() { return {} }
  },
  Mutation: {
    async theming() { return {} }
  },
  ThemingQuery: {
    async themes(obj, args, context, info) {
      const themesPath = path.join(WIKI.ROOTPATH, 'client', 'themes')
      let keys = []
      try {
        keys = (await fs.readdir(themesPath, { withFileTypes: true }))
          .filter(d => d.isDirectory())
          .map(d => d.name)
      } catch (err) {}

      if (_.isEmpty(keys)) {
        keys = ['default']
      }

      return keys.map(key => ({
        key,
        title: _.startCase(key),
        author: key === 'default' ? 'requarks.io' : 'custom'
      }))
    },
    async config(obj, args, context, info) {
      return {
        theme: WIKI.config.theming.theme,
        iconset: WIKI.config.theming.iconset,
        darkMode: WIKI.config.theming.darkMode,
        tocPosition: WIKI.config.theming.tocPosition || 'left',
        injectCSS: new CleanCSS({ format: 'beautify' }).minify(WIKI.config.theming.injectCSS).styles,
        injectHead: WIKI.config.theming.injectHead,
        injectBody: WIKI.config.theming.injectBody,
        primaryColor: normalizeHexColor(WIKI.config.theming.primaryColor, COLOR_DEFAULTS.primaryColor),
        secondaryColor: normalizeHexColor(WIKI.config.theming.secondaryColor, COLOR_DEFAULTS.secondaryColor),
        headerColor: normalizeHexColor(WIKI.config.theming.headerColor, COLOR_DEFAULTS.headerColor),
        footerColor: normalizeHexColor(WIKI.config.theming.footerColor, COLOR_DEFAULTS.footerColor),
        successColor: normalizeHexColor(WIKI.config.theming.successColor, COLOR_DEFAULTS.successColor),
        warningColor: normalizeHexColor(WIKI.config.theming.warningColor, COLOR_DEFAULTS.warningColor),
        errorColor: normalizeHexColor(WIKI.config.theming.errorColor, COLOR_DEFAULTS.errorColor),
        infoColor: normalizeHexColor(WIKI.config.theming.infoColor, COLOR_DEFAULTS.infoColor),
        neutralColor: normalizeHexColor(WIKI.config.theming.neutralColor, COLOR_DEFAULTS.neutralColor),
        chatEnabled: _.get(WIKI.config.theming, 'chatEnabled', true),
        movideskChatKey: _.get(WIKI.config.theming, 'movideskChatKey', '79498363D817478581FAE5265F29E5B8')
      }
    }
  },
  ThemingMutation: {
    async setConfig(obj, args, context, info) {
      try {
        if (!_.isEmpty(args.injectCSS)) {
          args.injectCSS = new CleanCSS({
            inline: false
          }).minify(args.injectCSS).styles
        }

        WIKI.config.theming = {
          ...WIKI.config.theming,
          theme: args.theme,
          iconset: args.iconset,
          darkMode: args.darkMode,
          tocPosition: args.tocPosition || 'left',
          injectCSS: args.injectCSS || '',
          injectHead: args.injectHead || '',
          injectBody: args.injectBody || '',
          primaryColor: normalizeHexColor(args.primaryColor, COLOR_DEFAULTS.primaryColor),
          secondaryColor: normalizeHexColor(args.secondaryColor, COLOR_DEFAULTS.secondaryColor),
          headerColor: normalizeHexColor(args.headerColor, COLOR_DEFAULTS.headerColor),
          footerColor: normalizeHexColor(args.footerColor, COLOR_DEFAULTS.footerColor),
          successColor: normalizeHexColor(args.successColor, COLOR_DEFAULTS.successColor),
          warningColor: normalizeHexColor(args.warningColor, COLOR_DEFAULTS.warningColor),
          errorColor: normalizeHexColor(args.errorColor, COLOR_DEFAULTS.errorColor),
          infoColor: normalizeHexColor(args.infoColor, COLOR_DEFAULTS.infoColor),
          neutralColor: normalizeHexColor(args.neutralColor, COLOR_DEFAULTS.neutralColor),
          chatEnabled: _.isBoolean(args.chatEnabled) ? args.chatEnabled : _.get(WIKI.config.theming, 'chatEnabled', true),
          movideskChatKey: args.movideskChatKey || '79498363D817478581FAE5265F29E5B8'
        }

        await WIKI.configSvc.saveToDb(['theming'])

        return {
          responseResult: graphHelper.generateSuccess('Theme config updated')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
