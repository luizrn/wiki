<template lang='pug'>
.tbdc-updates-public
  //- HEADER
  .updates-header
    v-container
      v-layout(align-center)
        img(src='/_assets/svg/logo-tbdc.svg', alt='TBDC', style='height: 40px;')
        v-spacer
        .updates-links.hidden-sm-and-down
          v-btn(text, dark, href='#') Produtor
          v-btn(text, dark, href='#') Consultoria
          v-btn(text, dark, href='#') Geração de Demanda

  v-container.updates-content
    v-layout(row, wrap)
      //- SIDEBAR (ESQUERDA)
      v-flex(xs12, md3)
        .updates-sidebar
          v-text-field(
            v-model='search'
            placeholder='Pesquisar novidades...'
            prepend-inner-icon='mdi-magnify'
            outlined
            rounded
            dense
            background-color='white'
          )
          .overline.mt-4.mb-2 PRODUTOS TBDC
          v-list.transparent(dense)
            v-list-item-group(v-model='selectedCategory', color='primary')
              v-list-item(:value='null', @click='filterBy(null)')
                v-list-item-icon: v-icon(small) mdi-apps
                v-list-item-content: v-list-item-title Todos
              v-list-item(v-for='cat in categories', :key='cat.id', :value='cat.id', @click='filterBy(cat.id)')
                v-list-item-icon: v-icon(small, :color='cat.color') mdi-square
                v-list-item-content: v-list-item-title {{cat.name}}

          .overline.mt-6.mb-2 LINKS ÚTEIS
          v-list.transparent(dense)
            v-list-item(v-for='link in sidebarLinks', :key='link.label', :href='link.url', target='_blank')
              v-list-item-icon: v-icon(small) {{link.icon || 'mdi-link'}}
              v-list-item-content: v-list-item-title {{link.label}}

      //- FEED (DIREITA)
      v-flex(xs12, md9)
        .updates-feed
          v-layout(column)
            template(v-if='loading && updates.length === 0')
              v-skeleton-loader(v-for='i in 3', :key='i', type='article, actions', class='mb-6')

            template(v-else-if='filteredUpdates.length === 0')
              .text-center.py-12.grey--text
                v-icon(size='64') mdi-clipboard-text-search-outline
                .headline.mt-4 Nenhuma novidade encontrada

            template(v-else)
              v-card.post-card(v-for='post in filteredUpdates', :key='post.id', elevation='1')
                v-card-text
                  v-layout(align-center, class='mb-4')
                    v-chip(label, small, :color='post.category ? post.category.color : "grey"', dark) {{post.category ? post.category.name : 'Sem categoria'}}
                    v-spacer
                    v-btn(icon, small, color='grey'): v-icon(small) mdi-link-variant

                  .post-title.display-1.font-weight-bold.mb-2 {{post.title}}
                  .post-date.caption.grey--text.mb-6
                    v-icon(x-small, left) mdi-calendar
                    | {{formatDate(post.publishedAt)}}

                  .resource-target.pa-4.mb-6(v-if='post.summary')
                    .overline.mb-1 PARA QUEM É ESSE RECURSO?
                    .body-1.font-weight-medium
                      v-icon(left, color='orange') mdi-trophy
                      | {{post.summary}}

                  .post-body.body-1(v-html='renderMarkdown(post.content)')

                v-divider
                v-card-actions.pa-6.survey-section
                  .survey-title.overline Satisfação: O que você achou dessa novidade?
                  v-spacer
                  .emoji-buttons
                    v-btn(icon, x-large, @click='vote(post.id, 3)', :color='myVotes[post.id] === 3 ? "green" : "grey"')
                      v-icon(size='40') mdi-emoticon-happy-outline
                    v-btn(icon, x-large, @click='vote(post.id, 2)', :color='myVotes[post.id] === 2 ? "orange" : "grey"')
                      v-icon(size='40') mdi-emoticon-neutral-outline
                    v-btn(icon, x-large, @click='vote(post.id, 1)', :color='myVotes[post.id] === 1 ? "red" : "grey"')
                      v-icon(size='40') mdi-emoticon-sad-outline
  chat-widget(v-if='$store.state.user.authenticated')

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
      myVotes: {}
    }
  },
  computed: {
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
        const resp = await this.$apollo.query({
          query: gql`query {
            tbdcUpdates {
              listUpdates(limit: 50) { items { id title content summary categoryId category { name color } publishedAt } }
              categories { id name color icon }
              adminConfig { sidebarLinks }
            }
          }`,
          fetchPolicy: 'network-only'
        })
        this.updates = resp.data.tbdcUpdates.listUpdates.items
        this.categories = resp.data.tbdcUpdates.categories
        try {
          this.sidebarLinks = JSON.parse(resp.data.tbdcUpdates.adminConfig.sidebarLinks || '[]')
        } catch (err) {
          this.sidebarLinks = []
        }
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
    async vote(updateId, rating) {
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
  background-color: #f0f2f5;
  min-height: 100vh;
}

.updates-header {
  background: linear-gradient(135deg, #004d26 0%, #00331a 100%);
  padding: 16px 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.updates-content {
  padding: 40px 0;
}

.updates-sidebar {
  position: sticky;
  top: 80px;
  padding-right: 24px;
}

.post-card {
  border-radius: 12px !important;
  margin-bottom: 32px;
  border-left: 6px solid transparent;
  transition: transform 0.2s;
  &:hover {
    transform: translateY(-2px);
  }
}

.resource-target {
  background-color: #fff9f0;
  border-radius: 8px;
  border-left: 4px solid #f29900;
}

.survey-section {
  display: block !important;
  .emoji-buttons {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
  }
}

.post-title {
  color: #1a1a1a;
  line-height: 1.2;
}

.post-body {
  color: #4a4a4a;
  line-height: 1.6;
}
</style>
