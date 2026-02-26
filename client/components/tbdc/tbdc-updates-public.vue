<template lang='pug'>
.tbdc-updates-public
  //- HEADER
  .updates-header(:class='{ "mobile-hidden": isMobile }')
    v-container.py-5
      .header-top
        .brand-wrap
          img.brand-logo(:src='logoSrc', alt='TBDC', @error='onLogoError')
          .brand-copy
            .brand-title {{ headerTitle }}
            .brand-subtitle {{ headerSubtitle }}
        .header-actions
          .header-menu
            v-btn.header-link(
              text
              small
              :href='novidadesHref'
              :class='{ "is-active": currentSection === "novidades" }'
            ) Novidades
            v-btn.header-link(
              text
              small
              :href='clientesHref'
              :class='{ "is-active": currentSection === "clientes" }'
            ) Documentação TBDC
          v-btn.header-admin-btn(
            v-if='canAccessUpdatesAdmin'
            small
            color='red darken-2'
            dark
            depressed
            href='/a/tbdc-updates'
          ) ADMINISTRAÇÃO
      .updates-links-wrap.hidden-sm-and-down
        .updates-links
          v-chip(
            outlined
            small
            text-color='white'
            color='white'
            :input-value='selectedCategory === null'
            @click='filterBy(null)'
          ) Todos
          v-chip(
            v-for='cat in categories'
            :key='cat.id'
            outlined
            small
            :color='cat.color || "white"'
            text-color='white'
            :input-value='selectedCategory === cat.id'
            @click='filterBy(cat.id)'
          ) {{ cat.name }}

  v-container.updates-content
    v-layout(row, wrap)
      //- SIDEBAR (ESQUERDA)
      v-flex(xs12, md3, v-if='!isMobile')
        .updates-sidebar
          v-card.sidebar-card(elevation='1')
            v-card-text.pb-3
              v-text-field(
                v-model='search'
                placeholder='Pesquisar novidades...'
                prepend-inner-icon='mdi-magnify'
                outlined
                rounded
                dense
                hide-details
                background-color='white'
                class='mb-4'
              )
              .section-title Produtos TBDC
              v-list(dense, class='sidebar-list')
                v-list-item(
                  :class='{ "is-active": selectedCategory === null }'
                  @click='filterBy(null)'
                )
                  v-list-item-icon: v-icon(small) mdi-apps
                  v-list-item-content: v-list-item-title Todos
                v-list-item(
                  v-for='cat in categories'
                  :key='cat.id'
                  :class='{ "is-active": selectedCategory === cat.id }'
                  @click='filterBy(cat.id)'
                )
                  v-list-item-icon: v-icon(small, :color='cat.color') mdi-circle-medium
                  v-list-item-content: v-list-item-title {{cat.name}}

              .section-title.mt-6 Links úteis
              v-list(dense, class='sidebar-list')
                v-list-item(v-if='sidebarLinks.length === 0', disabled)
                  v-list-item-content: v-list-item-title Nenhum link cadastrado
                v-list-item(v-for='link in sidebarLinks', :key='link.label', :href='link.url', target='_blank')
                  v-list-item-icon: v-icon(small, color='var(--tbdc-primary)') {{link.icon || 'mdi-open-in-new'}}
                  v-list-item-content: v-list-item-title {{link.label}}

      //- FEED (DIREITA)
      v-flex(xs12, :md9='!isMobile', :md12='isMobile')
        .updates-feed
          .timeline-sticky(v-if='!isMobile && filteredUpdates.length')
            .timeline-time
              v-icon(x-small, left) mdi-clock-outline
              | {{ activePostRelativeTime }}
            .timeline-kind
              v-icon(x-small, left, color='#34c38f') mdi-plus-circle
              | PUBLICADO
          .mobile-toolbar(v-if='isMobile')
            v-btn.mobile-menu-btn(color='var(--tbdc-primary)', dark, depressed, rounded, @click='mobileMenu = true')
              v-icon(left, small) mdi-tune-variant
              | Menu e Filtros
            .mobile-menu-badge Menu
          v-layout(column)
            template(v-if='loading && updates.length === 0')
              v-skeleton-loader(v-for='i in 3', :key='i', type='article, actions', class='mb-6')

            template(v-else-if='filteredUpdates.length === 0')
              .empty-state
                v-icon(size='66') mdi-newspaper-variant-outline
                .empty-title Nenhuma novidade encontrada
                .empty-subtitle Ajuste os filtros ou tente uma nova pesquisa.

            template(v-else)
              v-card.post-card(
                v-for='(post, idx) in filteredUpdates'
                :key='post.id'
                elevation='1'
                :ref='`postCard-${idx}`'
                ref-in-for
              )
                v-card-text.pa-6
                  v-layout(align-center, class='mb-4')
                    v-chip(label, small, :color='post.category ? post.category.color : "#607D8B"', dark) {{post.category ? post.category.name : 'Sem categoria'}}
                    v-spacer
                    .post-date
                      v-icon(x-small, left) mdi-calendar
                      | {{formatRelativeDate(post.publishedAt)}}

                  .post-title.mb-3 {{post.title}}

                  .resource-target.pa-4.mb-5(v-if='post.summary')
                    .overline.mb-1 Público-alvo
                    .body-2.font-weight-medium
                      v-icon(left, color='#9BC113', small) mdi-account-group
                      | {{post.summary}}

                  .post-body(v-html='renderMarkdown(post.content)')

                v-divider
                v-card-actions.px-6.py-4.survey-section
                  .survey-title Avalie esta novidade
                  v-spacer
                  .emoji-buttons
                    v-btn(icon, @click='vote(post.id, 3)', :color='myVotes[post.id] === 3 ? "primary" : "grey"')
                      v-icon(size='30') mdi-emoticon-happy-outline
                    v-btn(icon, @click='vote(post.id, 2)', :color='myVotes[post.id] === 2 ? "#9BC113" : "grey"')
                      v-icon(size='30') mdi-emoticon-neutral-outline
                    v-btn(icon, @click='vote(post.id, 1)', :color='myVotes[post.id] === 1 ? "red" : "grey"')
                      v-icon(size='30') mdi-emoticon-sad-outline

  v-navigation-drawer.mobile-drawer(
    v-model='mobileMenu'
    temporary
    right
    fixed
    width='320'
    disable-resize-watcher
    v-if='isMobile'
  )
    .mobile-drawer-head
      .mobile-drawer-title Filtros
      v-btn(icon, small, @click='mobileMenu = false')
        v-icon mdi-close
    .mobile-drawer-content
      v-text-field(
        v-model='search'
        placeholder='Pesquisar novidades...'
        prepend-inner-icon='mdi-magnify'
        outlined
        rounded
        dense
        hide-details
        background-color='white'
        class='mb-4'
      )
      .section-title Produtos TBDC
      v-list(dense, class='sidebar-list')
        v-list-item(
          :class='{ "is-active": selectedCategory === null }'
          @click='filterBy(null); mobileMenu = false'
        )
          v-list-item-icon: v-icon(small) mdi-apps
          v-list-item-content: v-list-item-title Todos
        v-list-item(
          v-for='cat in categories'
          :key='cat.id'
          :class='{ "is-active": selectedCategory === cat.id }'
          @click='filterBy(cat.id); mobileMenu = false'
        )
          v-list-item-icon: v-icon(small, :color='cat.color') mdi-circle-medium
          v-list-item-content: v-list-item-title {{cat.name}}
      .section-title.mt-6 Links úteis
      v-list(dense, class='sidebar-list')
        v-list-item(v-if='sidebarLinks.length === 0', disabled)
          v-list-item-content: v-list-item-title Nenhum link cadastrado
        v-list-item(v-for='link in sidebarLinks', :key='link.label', :href='link.url', target='_blank')
          v-list-item-icon: v-icon(small, color='var(--tbdc-primary)') {{link.icon || 'mdi-open-in-new'}}
          v-list-item-content: v-list-item-title {{link.label}}

  footer.updates-footer
    .ig-strip
      v-container
        .ig-inner
          .ig-title {{ publicFooter.instagramText }}
          a.ig-link(:href='publicFooter.instagramUrl', target='_blank', rel='noopener')
            v-icon(left, color='#7dbd3b') mdi-instagram
            | {{ publicFooter.instagramHandle }}
    .footer-main
      v-container
        v-row(align='center')
          v-col(cols='12', md='3')
            .footer-logo-wrap
              img.footer-logo(:src='logoSrc', alt='TBDC')
          v-col(cols='12', md='3')
            .footer-contact
              .contact-item
                v-icon(small, color='#7dbd3b') mdi-whatsapp
                .contact-text
                  .label Comercial:
                  .value {{ publicFooter.commercialPhone }}
              .contact-item
                v-icon(small, color='#7dbd3b') mdi-whatsapp
                .contact-text
                  .label Suporte:
                  .value {{ publicFooter.supportPhone }}
          v-col(cols='12', md='4')
            .footer-address
              v-icon(small, color='#7dbd3b') mdi-map-marker
              .address-text
                .label Endereço:
                .value {{ publicFooter.addressLine1 }}
                .value {{ publicFooter.addressLine2 }}
                a.map-link(:href='publicFooter.mapUrl', target='_blank', rel='noopener') Ver no mapa
          v-col(cols='12', md='2')
            .social-list
              a(:href='publicFooter.socialInstagram', target='_blank', rel='noopener')
                v-icon(color='#7dbd3b') mdi-instagram
              a(:href='publicFooter.socialFacebook', target='_blank', rel='noopener')
                v-icon(color='#7dbd3b') mdi-facebook
              a(:href='publicFooter.socialLinkedin', target='_blank', rel='noopener')
                v-icon(color='#7dbd3b') mdi-linkedin
              a(:href='publicFooter.socialYoutube', target='_blank', rel='noopener')
                v-icon(color='#7dbd3b') mdi-youtube
    .footer-bottom
      v-container
        .bottom-inner
          .legal-links
            a(:href='publicFooter.privacyUrl', target='_blank', rel='noopener') Política de Privacidade
            a(:href='publicFooter.cookiesUrl', target='_blank', rel='noopener') Política de Cookies
            a(:href='publicFooter.termsUrl', target='_blank', rel='noopener') Termos de uso
          .company-id {{ publicFooter.companyId }}
</template>

<script>
import gql from 'graphql-tag'
import moment from 'moment'
import _ from 'lodash'

export default {
  data() {
    return {
      loading: false,
      updates: [],
      categories: [],
      sidebarLinks: [],
      search: '',
      selectedCategory: null,
      myVotes: {},
      logoSrc: '/_assets/img/tbdc-agro-logo.png',
      headerTitle: 'Novidades TBDC',
      headerSubtitle: 'Central pública de comunicados e atualizações',
      canAccessUpdatesAdmin: false,
      publicFooter: {
        instagramText: 'Siga-nos no Instagram',
        instagramHandle: '@tbdcagro',
        instagramUrl: 'https://www.instagram.com/tbdcagro/',
        commercialPhone: '65 99623-2985',
        supportPhone: '65 99990-0123',
        addressLine1: 'Av. das Arapongas, 1104 N, Jardim das Orquídeas,',
        addressLine2: 'Nova Mutum - MT, 78452-006',
        mapUrl: 'https://maps.google.com/?q=Av.+das+Arapongas,+1104+Nova+Mutum+MT',
        privacyUrl: 'https://www.tbdc.com.br/',
        cookiesUrl: 'https://www.tbdc.com.br/',
        termsUrl: 'https://www.tbdc.com.br/',
        companyId: '© TBDC - 28.845.223/0001-79',
        socialInstagram: 'https://www.instagram.com/tbdcagro/',
        socialFacebook: 'https://www.facebook.com/',
        socialLinkedin: 'https://www.linkedin.com/',
        socialYoutube: 'https://www.youtube.com/'
      },
      mobileMenu: false,
      activePostIndex: 0,
      postObserver: null
    }
  },
  computed: {
    currentSection() {
      return window.location.pathname.startsWith('/clientes') ? 'clientes' : 'novidades'
    },
    novidadesHref() {
      return '/novidades'
    },
    clientesHref() {
      return '/clientes'
    },
    isAuthenticated() {
      return _.get(this, '$store.state.user.authenticated', false)
    },
    filteredUpdates() {
      return this.updates.filter(u => {
        const search = _.toLower(_.trim(this.search || ''))
        const title = _.toLower(u.title || '')
        const content = _.toLower(u.content || '')
        const matchSearch = search ? (title.includes(search) || content.includes(search)) : true
        const matchCat = this.selectedCategory ? u.categoryId === this.selectedCategory : true
        return matchSearch && matchCat
      })
    },
    isMobile() {
      return _.get(this, '$vuetify.breakpoint.smAndDown', false)
    },
    activePostRelativeTime() {
      const post = _.get(this.filteredUpdates, `[${this.activePostIndex}]`)
      return post ? this.formatRelativeDate(post.publishedAt) : ''
    }
  },
  watch: {
    filteredUpdates() {
      this.$nextTick(() => this.setupPostObserver())
    },
    isMobile() {
      this.$nextTick(() => this.setupPostObserver())
    }
  },
  async mounted() {
    moment.locale('pt-br')
    await this.refresh()
    // Marcar como lido ao abrir
    localStorage.setItem('tbdc_updates_last_read', new Date().toISOString())
    this.$root.$emit('tbdc-updates-read')
    this.$nextTick(() => this.setupPostObserver())
  },
  beforeDestroy() {
    this.teardownPostObserver()
  },
  methods: {
    async refresh() {
      this.loading = true
      try {
        const endpoint = this.currentSection === 'clientes' ? '/clientes/data' : '/novidades/data'
        const resp = await fetch(endpoint, {
          method: 'GET',
          credentials: 'same-origin'
        })
        if (!resp.ok) {
          throw new Error(`Falha ao carregar novidades (${resp.status})`)
        }
        const data = await resp.json()
        if (!data.ok) {
          throw new Error(data.message || 'Falha ao carregar novidades.')
        }
        this.updates = data.updates || []
        this.categories = data.categories || []
        this.sidebarLinks = data.sidebarLinks || []
        this.headerTitle = this.currentSection === 'clientes'
          ? 'Documentação TBDC'
          : _.get(data, 'publicHeader.title', 'Novidades TBDC')
        this.headerSubtitle = this.currentSection === 'clientes'
          ? 'Central pública de conteúdos e documentação'
          : _.get(data, 'publicHeader.subtitle', 'Central pública de comunicados e atualizações')
        this.logoSrc = _.get(data, 'publicHeader.logoUrl', '/_assets/img/tbdc-agro-logo.png')
        this.publicFooter = Object.assign({}, this.publicFooter, _.get(data, 'publicFooter', {}))
        this.canAccessUpdatesAdmin = !!_.get(data, 'canAccessUpdatesAdmin', false)
      } catch (err) {
        console.error(err)
      }
      this.loading = false
    },
    filterBy(catId) {
      this.selectedCategory = catId
    },
    formatRelativeDate(date) {
      return moment(date).fromNow()
    },
    renderMarkdown(content) {
      const safeText = _.escape(content || '')
      return safeText.replace(/\n/g, '<br>')
    },
    onLogoError() {
      this.logoSrc = '/_assets/favicons/android-chrome-192x192.png'
    },
    async vote(updateId, rating) {
      if (!this.isAuthenticated) {
        this.$store.commit('showNotification', {
          style: 'warning',
          message: 'Faça login para enviar sua avaliação.',
          icon: 'mdi-lock'
        })
        return
      }
      try {
        await this.$apollo.mutate({
          mutation: gql`mutation($id: Int!, $r: Int!) {
            tbdcUpdates {
              submitVote(updateId: $id, rating: $r) { responseResult { message } }
            }
          }`,
          variables: { id: updateId, r: rating }
        })
        this.$set(this.myVotes, updateId, rating)
        this.$store.commit('showSuccess', 'Obrigado pelo seu feedback!')
      } catch (err) {
        this.$store.commit('showError', err.message)
      }
    },
    teardownPostObserver() {
      if (this.postObserver) {
        this.postObserver.disconnect()
        this.postObserver = null
      }
    },
    setupPostObserver() {
      this.teardownPostObserver()
      if (this.isMobile || !this.filteredUpdates.length || typeof IntersectionObserver === 'undefined') {
        return
      }

      this.postObserver = new IntersectionObserver((entries) => {
        let candidate = this.activePostIndex
        let ratio = 0
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const idx = Number(entry.target.dataset.postIndex)
          if (Number.isNaN(idx)) return
          if (entry.intersectionRatio >= ratio) {
            ratio = entry.intersectionRatio
            candidate = idx
          }
        })
        this.activePostIndex = candidate
      }, {
        root: null,
        rootMargin: '-25% 0px -55% 0px',
        threshold: [0.15, 0.3, 0.5, 0.75, 1]
      })

      this.filteredUpdates.forEach((_, idx) => {
        const ref = this.$refs[`postCard-${idx}`]
        const cmp = Array.isArray(ref) ? ref[0] : ref
        const el = cmp && cmp.$el ? cmp.$el : null
        if (!el) return
        el.dataset.postIndex = String(idx)
        this.postObserver.observe(el)
      })
    }
  }
}
</script>

<style lang='scss' scoped>
.tbdc-updates-public {
  --tbdc-primary: #18563B;
  --tbdc-primary-dark: #123f2b;
  --tbdc-secondary: #9BC113;
  background:
    radial-gradient(circle at top right, rgba(155, 193, 19, 0.12), transparent 30%),
    linear-gradient(180deg, #f5f8f6 0%, #eef4f0 100%);
  min-height: 100vh;
  font-family: 'Segoe UI', 'Inter', 'Roboto', sans-serif;
}

.updates-header {
  background: linear-gradient(135deg, var(--tbdc-primary) 0%, var(--tbdc-primary-dark) 100%);
  box-shadow: 0 8px 24px rgba(12, 44, 30, 0.2);
  color: #fff;
}

.updates-header.mobile-hidden {
  display: none;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.brand-wrap {
  display: flex;
  align-items: center;
}

.brand-logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  object-fit: contain;
  background: rgba(255, 255, 255, 0.12);
  padding: 6px;
}

.brand-copy {
  margin-left: 12px;
}

.brand-title {
  font-size: 34px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.4px;
}

.brand-subtitle {
  font-size: 16px;
  font-weight: 500;
  opacity: 0.94;
  line-height: 1.35;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-menu {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-link {
  color: #fff !important;
  text-transform: none !important;
  font-weight: 700 !important;
  border-radius: 999px;
}

.header-link.is-active {
  background: rgba(255, 255, 255, 0.16);
}

.header-admin-btn {
  font-weight: 800 !important;
  letter-spacing: 0.4px !important;
  text-transform: uppercase !important;
}

.updates-links-wrap {
  margin-top: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
}

.updates-links {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
  width: max-content;
}

.updates-links .v-chip {
  font-size: 13px !important;
  font-weight: 700 !important;
  letter-spacing: 0.25px;
  text-transform: none;
  color: #fff !important;
}

.updates-links .v-chip .v-chip__content {
  line-height: 1.1;
  color: #fff !important;
}

.updates-links .v-chip.v-chip--active,
.updates-links .v-chip:hover,
.updates-links .v-chip:focus {
  color: #fff !important;
}

.updates-links .v-chip.v-chip--active .v-chip__content,
.updates-links .v-chip:hover .v-chip__content,
.updates-links .v-chip:focus .v-chip__content {
  color: #fff !important;
}

.updates-content {
  padding: 28px 0 40px;
}

.updates-feed {
  position: relative;
  padding-left: 132px;
}

.timeline-sticky {
  position: sticky;
  top: 106px;
  margin-left: -120px;
  width: 106px;
  z-index: 2;
}

.timeline-time {
  color: #6f7d74;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.timeline-kind {
  color: #4e5f57;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
}

.mobile-toolbar {
  display: none;
}

.updates-sidebar {
  position: sticky;
  top: 24px;
  padding-right: 24px;
}

.sidebar-card {
  border-radius: 14px !important;
}

.section-title {
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-size: 12px;
  color: #4a5c51;
  font-weight: 700;
  margin-bottom: 8px;
}

.sidebar-list {
  background: transparent !important;
}

.sidebar-list .v-list__tile {
  border-radius: 8px !important;
}

.sidebar-list .is-active {
  background: rgba(24, 86, 59, 0.08);
}

.post-card {
  border-radius: 14px !important;
  margin-bottom: 22px;
  border-left: 6px solid rgba(24, 86, 59, 0.25);
  transition: transform 0.2s, box-shadow 0.2s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08) !important;
  }
}

.resource-target {
  background-color: rgba(155, 193, 19, 0.10);
  border-radius: 8px;
  border-left: 4px solid var(--tbdc-secondary);
}

.survey-section {
  align-items: center;
}

.survey-title {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #5b6c62;
  font-weight: 700;
}

.emoji-buttons {
  display: flex;
  gap: 8px;
}

.post-title {
  color: #1f3629;
  font-weight: 700;
  font-size: 28px;
  line-height: 1.22;
}

.post-date {
  color: #6f7d74;
  font-size: 12px;
}

.post-body {
  color: #2d3a32;
  line-height: 1.72;
  font-size: 16px;
}

.empty-state {
  text-align: center;
  color: #76867d;
  background: #fff;
  border-radius: 14px;
  border: 1px dashed #c9d6ce;
  padding: 52px 24px;
}

.empty-title {
  font-size: 22px;
  font-weight: 700;
  color: #415249;
  margin-top: 14px;
}

.empty-subtitle {
  font-size: 14px;
  margin-top: 8px;
}

.mobile-drawer {
  z-index: 1000;
}

.mobile-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #e6ece8;
}

.mobile-drawer-title {
  font-weight: 800;
  font-size: 16px;
  color: #1d3a2b;
}

.mobile-drawer-content {
  padding: 12px;
}

.updates-footer {
  margin-top: 24px;
  background: #f4f6f8;
  border-top: 1px solid #dde5df;
}

.ig-strip {
  background: #eef5e9;
  border-bottom: 1px solid #dde6dd;
}

.ig-inner {
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
}

.ig-title {
  font-size: 40px;
  font-weight: 800;
  color: #16543a;
}

.ig-link {
  display: inline-flex;
  align-items: center;
  font-size: 32px;
  font-weight: 800;
  color: #7dbd3b;
  text-decoration: none;
}

.footer-main {
  background: #f6f7f9;
  padding: 24px 0;
}

.footer-logo-wrap {
  display: flex;
  justify-content: center;
}

.footer-logo {
  width: 180px;
  height: 72px;
  object-fit: contain;
}

.footer-contact, .footer-address {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contact-item {
  display: flex;
  gap: 10px;
}

.contact-text .label,
.address-text .label {
  font-weight: 800;
  color: #5e6f89;
}

.contact-text .value,
.address-text .value {
  color: #627590;
  line-height: 1.35;
}

.footer-address {
  flex-direction: row;
}

.map-link {
  color: #7dbd3b;
  font-weight: 700;
  text-decoration: none;
}

.social-list {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.social-list a {
  text-decoration: none;
}

.footer-bottom {
  border-top: 1px solid #e1e6e3;
  background: #f0f2f4;
}

.bottom-inner {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.legal-links {
  display: flex;
  gap: 22px;
}

.legal-links a,
.company-id {
  color: #7f8ea5;
  font-size: 13px;
  text-decoration: none;
}

@media (max-width: 960px) {
  .updates-sidebar {
    position: static;
    padding-right: 0;
    margin-bottom: 16px;
  }

  .updates-feed {
    padding-left: 0;
  }

  .timeline-sticky {
    display: none;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .header-menu {
    width: 100%;
    overflow-x: auto;
    white-space: nowrap;
  }

  .brand-title {
    font-size: 26px;
  }

  .post-title {
    font-size: 22px;
  }
}

@media (max-width: 600px) {
  .tbdc-updates-public {
    background: #f3f7f4;
  }

  .updates-content {
    padding-top: 10px;
    padding-bottom: 20px;
  }

  .mobile-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 10px;
    padding: 2px 2px 8px;
  }

  .mobile-menu-btn {
    text-transform: none !important;
    font-weight: 700 !important;
  }

  .mobile-menu-badge {
    margin-left: 8px;
    min-width: 68px;
    height: 34px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
    font-size: 13px;
    font-weight: 700;
    color: #1d3a2b;
    border: 1px solid rgba(24, 86, 59, 0.35);
    background: #f0f7f3;
  }

  .post-card {
    border-radius: 12px !important;
    border-left-width: 4px;
    margin-bottom: 14px;
  }

  .post-title {
    font-size: 20px;
    line-height: 1.3;
  }

  .post-body {
    font-size: 15px;
    line-height: 1.64;
  }

  .resource-target {
    padding: 12px !important;
  }

  .empty-state {
    padding: 32px 16px;
  }

  .ig-inner {
    min-height: 70px;
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px 0;
  }

  .ig-title {
    font-size: 22px;
  }

  .ig-link {
    font-size: 20px;
  }

  .footer-main {
    padding: 16px 0;
  }

  .footer-logo {
    width: 140px;
    height: 56px;
  }

  .bottom-inner {
    flex-direction: column;
    justify-content: center;
    padding: 8px 0;
  }

  .legal-links {
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .brand-subtitle {
    font-size: 13px;
  }

  .brand-logo {
    width: 48px;
    height: 48px;
  }

  .updates-content {
    padding-top: 16px;
  }

  .survey-section {
    display: block !important;
  }

  .emoji-buttons {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 10px;
  }
}
</style>
