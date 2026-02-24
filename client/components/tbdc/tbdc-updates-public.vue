<template lang='pug'>
.tbdc-updates-public
  //- HEADER
  .updates-header
    v-container.py-5
      v-layout(align-center, wrap)
        .brand-wrap
          img.brand-logo(:src='logoSrc', alt='TBDC', @error='onLogoError')
          .brand-copy
            .brand-title Novidades TBDC
            .brand-subtitle Central pública de comunicados e atualizações
        v-spacer
        .updates-links.hidden-sm-and-down
          v-chip(
            outlined
            small
            text-color='white'
            color='white'
            :input-value='selectedCategory === null'
            @click='filterBy(null)'
          ) Todos
          v-chip(
            v-for='cat in categories.slice(0, 4)'
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
      v-flex(xs12, md3)
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
      v-flex(xs12, md9)
        .updates-feed
          v-layout(column)
            template(v-if='loading && updates.length === 0')
              v-skeleton-loader(v-for='i in 3', :key='i', type='article, actions', class='mb-6')

            template(v-else-if='filteredUpdates.length === 0')
              .empty-state
                v-icon(size='66') mdi-newspaper-variant-outline
                .empty-title Nenhuma novidade encontrada
                .empty-subtitle Ajuste os filtros ou tente uma nova pesquisa.

            template(v-else)
              v-card.post-card(v-for='post in filteredUpdates', :key='post.id', elevation='1')
                v-card-text.pa-6
                  v-layout(align-center, class='mb-4')
                    v-chip(label, small, :color='post.category ? post.category.color : "#607D8B"', dark) {{post.category ? post.category.name : 'Sem categoria'}}
                    v-spacer
                    .post-date
                      v-icon(x-small, left) mdi-calendar
                      | {{formatDate(post.publishedAt)}}

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
      logoSrc: '/_assets/img/tbdc-agro-logo.png'
    }
  },
  computed: {
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
    }
  },
  async mounted() {
    await this.refresh()
    // Marcar como lido ao abrir
    localStorage.setItem('tbdc_updates_last_read', new Date().toISOString())
    this.$root.$emit('tbdc-updates-read')
  },
  methods: {
    async refresh() {
      this.loading = true
      try {
        const resp = await fetch('/novidades/data', {
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
      } catch (err) {
        console.error(err)
      }
      this.loading = false
    },
    filterBy(catId) {
      this.selectedCategory = catId
    },
    formatDate(date) {
      return moment(date).format('DD [de] MMMM [de] YYYY')
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
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
}

.brand-subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.updates-links {
  display: flex;
  gap: 8px;
}

.updates-content {
  padding: 28px 0 40px;
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

@media (max-width: 960px) {
  .updates-sidebar {
    position: static;
    padding-right: 0;
    margin-bottom: 16px;
  }

  .brand-title {
    font-size: 20px;
  }

  .post-title {
    font-size: 22px;
  }
}

@media (max-width: 600px) {
  .brand-subtitle {
    font-size: 12px;
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
