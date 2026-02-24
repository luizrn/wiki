import { make } from 'vuex-pathify'

/* global siteConfig */

const state = {
  company: siteConfig.company,
  contentLicense: siteConfig.contentLicense,
  footerOverride: siteConfig.footerOverride,
  dark: siteConfig.darkMode,
  tocPosition: siteConfig.tocPosition,
  mascot: true,
  title: siteConfig.title,
  logoUrl: siteConfig.logoUrl,
  primaryColor: siteConfig.primaryColor,
  secondaryColor: siteConfig.secondaryColor,
  headerColor: siteConfig.headerColor,
  footerColor: siteConfig.footerColor,
  successColor: siteConfig.successColor,
  warningColor: siteConfig.warningColor,
  errorColor: siteConfig.errorColor,
  infoColor: siteConfig.infoColor,
  neutralColor: siteConfig.neutralColor,
  chatEnabled: siteConfig.chatEnabled,
  search: '',
  searchIsFocused: false,
  searchIsLoading: false,
  searchRestrictLocale: false,
  searchRestrictPath: false,
  printView: false
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
