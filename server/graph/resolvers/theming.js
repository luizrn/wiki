const graphHelper = require('../../helpers/graph')
const _ = require('lodash')
const CleanCSS = require('clean-css')
const path = require('path')
const fs = require('fs-extra')

/* global WIKI */

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
        primaryColor: WIKI.config.theming.primaryColor || '#1976d2',
        headerColor: WIKI.config.theming.headerColor || '#212121',
        footerColor: WIKI.config.theming.footerColor || '#212121',
        chatEnabled: _.get(WIKI.config.theming, 'chatEnabled', true)
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
          primaryColor: args.primaryColor || '#1976d2',
          headerColor: args.headerColor || '#212121',
          footerColor: args.footerColor || '#212121',
          chatEnabled: args.chatEnabled !== false
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
