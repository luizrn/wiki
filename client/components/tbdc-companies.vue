<template lang='pug'>
  v-app
    nav-header
    v-navigation-drawer(
      :class='$vuetify.theme.dark ? `grey darken-4-d4` : `primary`'
      dark
      app
      clipped
      mobile-breakpoint='600'
      :temporary='$vuetify.breakpoint.smAndDown'
      v-model='navShown'
      :right='$vuetify.rtl'
      )
      vue-scroll(:ops='scrollStyle')
        nav-sidebar(
          :color='$vuetify.theme.dark ? `grey darken-4-d4` : `primary`'
          :items='sidebarItems'
          :nav-mode='resolvedNavMode'
        )
    v-fab-transition
      v-btn(
        fab
        color='primary'
        fixed
        bottom
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        @click='navShown = !navShown'
        v-if='$vuetify.breakpoint.mdAndDown'
        v-show='!navShown'
      )
        v-icon mdi-menu
    v-main
      transition(name='tbdc-router')
        router-view
    nav-footer
    notify
    search-results
    chat-widget(v-if='$store.state.user.authenticated')
</template>

<script>
import VueRouter from 'vue-router'
import { get } from 'vuex-pathify'
import NavSidebar from '../themes/default/components/nav-sidebar.vue'

/* global siteLangs, siteConfig */

const localeBaseMatch = window.location.pathname.match(/^\/([a-z]{2}(?:-[a-z]{2})?)\/tbdc-companies(?:\/|$)/i)
const tbdcRouterBase = localeBaseMatch ? `/${localeBaseMatch[1]}/tbdc-companies` : '/tbdc-companies'

const router = new VueRouter({
  mode: 'history',
  base: tbdcRouterBase,
  routes: [
    { path: '/', component: () => import(/* webpackChunkName: "tbdc" */ './admin/tbdc/admin-tbdc-companies.vue') },
    { path: '/new', component: () => import(/* webpackChunkName: "tbdc" */ './admin/tbdc/admin-tbdc-companies-edit.vue') },
    { path: '/master', beforeEnter: () => { window.location.assign('/a/tbdc-master') } },
    { path: '/:id(\\d+)', component: () => import(/* webpackChunkName: "tbdc" */ './admin/tbdc/admin-tbdc-companies-edit.vue') }
  ]
})

export default {
  props: {
    sidebar: {
      type: String,
      default: ''
    },
    navMode: {
      type: String,
      default: 'MIXED'
    },
    locale: {
      type: String,
      default: ''
    }
  },
  components: {
    NavSidebar
  },
  data () {
    return {
      navShown: true,
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollY: false,
          initialScrollX: false,
          scrollingX: false,
          easing: 'easeInOutCubic'
        }
      }
    }
  },
  computed: {
    userLocale: get('user/localeCode'),
    sidebarItems () {
      if (Array.isArray(this.sidebar)) {
        return this.sidebar
      }
      if (!this.sidebar || typeof this.sidebar !== 'string') {
        return []
      }
      try {
        return JSON.parse(window.atob(this.sidebar))
      } catch (err) {
        try {
          return JSON.parse(this.sidebar)
        } catch (err2) {
          return []
        }
      }
    },
    resolvedNavMode () {
      return 'TREE'
    }
  },
  router,
  created () {
    const siteLocales = (typeof siteLangs !== 'undefined' && Array.isArray(siteLangs)) ? siteLangs.map(l => l.code || l).filter(Boolean) : []
    const localeCandidates = [this.locale, this.$store.get('page/locale'), this.userLocale, siteConfig.lang, siteLocales[0], 'en'].filter(Boolean)
    const activeLocale = localeCandidates.find(lc => siteLocales.length < 1 || siteLocales.includes(lc)) || localeCandidates[0]
    const activePath = this.$store.get('page/path') || 'home'
    this.navShown = !this.$vuetify.breakpoint.smAndDown
    this.$store.commit('page/SET_MODE', 'view')
    this.$store.commit('page/SET_LOCALE', activeLocale)
    this.$store.commit('page/SET_PATH', activePath)
  }
}
</script>

<style lang='scss'>
.tbdc-router-enter-active, .tbdc-router-leave-active {
  transition: opacity .2s ease;
}
.tbdc-router-enter, .tbdc-router-leave-to {
  opacity: 0;
}
</style>
