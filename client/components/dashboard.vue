<template lang='pug'>
  v-app.dashboard-app(:dark='$vuetify.theme.dark')
    nav-header
    v-main(:class='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-5`')
      v-container(fluid, grid-list-lg)
        v-layout(row wrap)
          v-flex(xs12)
            .dashboard-header
              .headline.primary--text Wiki Dashboard
              .subtitle-2.grey--text Indicadores, acesso rápido e catálogo de serviços/processos.
              v-spacer
              v-btn(color='primary', depressed, @click='refreshAll')
                v-icon(left) mdi-refresh
                span Atualizar

          v-flex(xs12, md6, lg3)
            v-card
              v-card-text
                .overline.grey--text Artigos
                .display-1 {{ overview.summary.totalArticles }}
                .caption Publicados: {{overview.summary.publishedArticles}} | Rascunhos: {{overview.summary.draftArticles}}

          v-flex(xs12, md6, lg3)
            v-card
              v-card-text
                .overline.grey--text Visitas Totais
                .display-1 {{ overview.summary.totalVisits }}
                .caption Últimos 30 dias em gráficos abaixo

          v-flex(xs12, md6, lg3)
            v-card
              v-card-text
                .overline.grey--text Serviços
                .display-1 {{ overview.summary.totalServices }}
                .caption Processos: {{ overview.summary.totalProcesses }}

          v-flex(xs12, md6, lg3)
            v-card
              v-card-text
                .overline.grey--text Usuários Ativos
                .display-1 {{ overview.summary.totalUsers }}
                .caption Com acesso à Wiki

          v-flex(xs12, lg8)
            v-card
              v-toolbar(flat, dense, color='primary', dark)
                v-toolbar-title Indicadores de Tendência (30 dias)
              v-card-text
                .subtitle-2.mb-2 Visitas
                v-sparkline(:value='visitsSeries', color='blue', line-width='2', auto-draw, padding='8')
                .subtitle-2.mb-2.mt-4 Artigos Criados
                v-sparkline(:value='createdSeries', color='green', line-width='2', auto-draw, padding='8')
                .subtitle-2.mb-2.mt-4 Artigos Atualizados
                v-sparkline(:value='updatedSeries', color='orange', line-width='2', auto-draw, padding='8')

          v-flex(xs12, lg4)
            v-card
              v-toolbar(flat, dense, color='indigo', dark)
                v-toolbar-title Menus de Acesso Rápido
                v-spacer
                v-btn(icon, small, v-if='isAdmin', @click='editMode = !editMode')
                  v-icon {{ editMode ? 'mdi-check' : 'mdi-pencil' }}
              v-card-text
                v-layout(row wrap)
                  v-flex(xs12, v-for='(lnk, idx) in config.quickLinks', :key='`ql-` + idx')
                    v-btn.mb-2(text, block, :href='lnk.url', :color='lnk.color || `primary`')
                      v-icon(left) {{lnk.icon}}
                      span {{lnk.label}}
                template(v-if='isAdmin && editMode')
                  v-divider.my-3
                  v-btn(small, color='primary', @click='addQuickLink')
                    v-icon(left, small) mdi-plus
                    span Novo Atalho
                  v-card.mt-2.pa-2(v-for='(lnk, idx) in config.quickLinks', :key='`qle-` + idx', outlined)
                    v-text-field(dense, outlined, v-model='lnk.label', label='Label')
                    v-text-field(dense, outlined, v-model='lnk.icon', label='Ícone (mdi-*)')
                    v-text-field(dense, outlined, v-model='lnk.url', label='URL')
                    v-text-field(dense, outlined, v-model='lnk.color', label='Cor')
                    v-btn(text, small, color='red', @click='removeQuickLink(idx)')
                      v-icon(left, small) mdi-delete
                      span Remover

          v-flex(xs12)
            v-card
              v-toolbar(flat, dense, color='deep-purple', dark)
                v-toolbar-title Conteúdo Personalizado
                v-spacer
                v-btn(color='success', small, depressed, v-if='isAdmin', @click='saveConfig')
                  v-icon(left, small) mdi-content-save
                  span Salvar
              v-card-text
                v-textarea(v-if='isAdmin && editMode', outlined, auto-grow, rows='4', v-model='config.customContent', label='Conteúdo da Home / Dashboard')
                .body-1(style='white-space: pre-wrap;') {{ config.customContent }}

          v-flex(xs12, lg4)
            v-card
              v-toolbar(flat, dense, color='teal', dark)
                v-toolbar-title Últimos 10 Artigos
              v-list(dense)
                v-list-item(v-for='art in overview.latestArticles', :key='`la-` + art.id', :href='`/` + art.locale + `/` + art.path')
                  v-list-item-content
                    v-list-item-title {{art.title}}
                    v-list-item-subtitle {{art.locale}}/{{art.path}}

          v-flex(xs12, lg4)
            v-card
              v-toolbar(flat, dense, color='teal', dark)
                v-toolbar-title Top 10 Mais Vistos
              v-list(dense)
                v-list-item(v-for='art in overview.topArticles', :key='`ta-` + art.id', :href='`/` + art.locale + `/` + art.path')
                  v-list-item-content
                    v-list-item-title {{art.title}}
                    v-list-item-subtitle {{art.views}} visualizações

          v-flex(xs12, lg4)
            v-card
              v-toolbar(flat, dense, color='teal', dark)
                v-toolbar-title Top 10 Usuários (Acessos)
              v-list(dense)
                v-list-item(v-for='usr in overview.topUsers', :key='`tu-` + usr.id')
                  v-list-item-content
                    v-list-item-title {{usr.name}}
                    v-list-item-subtitle {{usr.visits}} acessos

          v-flex(xs12, id='services')
            v-card
              v-toolbar(flat, dense, color='blue-grey', dark)
                v-toolbar-title Serviços e Processos
                v-spacer
                v-btn(color='success', small, depressed, @click='openCreate')
                  v-icon(left, small) mdi-plus
                  span Novo
              v-card-text
                v-layout(row wrap)
                  v-flex(xs12, md4)
                    v-text-field(outlined, dense, clearable, prepend-inner-icon='mdi-magnify', label='Pesquisar', v-model='filters.search')
                  v-flex(xs12, md2)
                    v-select(outlined, dense, clearable, :items='entryTypes', label='Tipo', v-model='filters.entryType')
                  v-flex(xs12, md2)
                    v-select(outlined, dense, clearable, :items='facets.departments', label='Departamento', v-model='filters.department')
                  v-flex(xs12, md2)
                    v-select(outlined, dense, clearable, :items='facets.teams', label='Time', v-model='filters.team')
                  v-flex(xs12, md2)
                    v-select(outlined, dense, clearable, :items='facets.tags', label='Tag', v-model='filters.tag')
                v-data-table(
                  :headers='tableHeaders'
                  :items='items'
                  :items-per-page='15'
                  dense
                  disable-sort
                  )
                  template(v-slot:item.entryType='{ item }')
                    v-chip(x-small, :color='item.entryType === `PROCESS` ? `indigo` : `teal`', dark) {{item.entryType}}
                  template(v-slot:item.tags='{ item }')
                    span(v-if='item.tags && item.tags.length') {{ item.tags.join(', ') }}
                    span(v-else) -
                  template(v-slot:item.name='{ item }')
                    .font-weight-medium {{ item.name }}
                    .caption.grey--text {{ item.description }}
                    a.caption(:href='item.linkUrl', target='_blank', v-if='item.linkUrl') {{ item.linkUrl }}
                  template(v-slot:item.actions='{ item }')
                    v-btn(icon, x-small, color='primary', @click='openEdit(item)')
                      v-icon(small) mdi-pencil
                    v-btn(icon, x-small, color='red', :disabled='!item.canDelete', @click='removeItem(item)')
                      v-icon(small) mdi-delete

    v-dialog(v-model='formDialog', max-width='760')
      v-card
        v-toolbar(flat, dense, color='primary', dark)
          v-toolbar-title {{ form.id ? 'Editar' : 'Novo' }} {{ form.entryType === 'PROCESS' ? 'Processo' : 'Serviço' }}
        v-card-text
          v-layout(row wrap)
            v-flex(xs12, md6)
              v-text-field(outlined, dense, label='Nome', v-model='form.name')
            v-flex(xs12, md3)
              v-select(outlined, dense, :items='entryTypes', label='Tipo', v-model='form.entryType')
            v-flex(xs12, md3)
              v-text-field(outlined, dense, label='Departamento', v-model='form.department')
            v-flex(xs12, md6)
              v-text-field(outlined, dense, label='Time', v-model='form.team')
            v-flex(xs12, md6)
              v-text-field(outlined, dense, label='Link (opcional)', v-model='form.linkUrl')
            v-flex(xs12)
              v-text-field(outlined, dense, label='Tags (separadas por vírgula)', v-model='tagsText')
            v-flex(xs12)
              v-textarea(outlined, rows='4', auto-grow, label='Descrição', v-model='form.description')
        v-card-chin
          v-spacer
          v-btn(text, @click='formDialog = false') Cancelar
          v-btn(color='success', dark, @click='saveItem') Salvar

    nav-footer
    notify
    search-results
    chat-widget(v-if='$store.state.user.authenticated')
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { get } from 'vuex-pathify'

export default {
  data () {
    return {
      editMode: false,
      config: {
        customContent: '',
        quickLinks: []
      },
      overview: {
        summary: {
          totalArticles: 0,
          publishedArticles: 0,
          draftArticles: 0,
          totalUsers: 0,
          totalServices: 0,
          totalProcesses: 0,
          totalVisits: 0
        },
        latestArticles: [],
        topArticles: [],
        topUsers: [],
        localeStats: [],
        visitsLast30d: [],
        createdLast30d: [],
        updatedLast30d: []
      },
      items: [],
      facets: {
        departments: [],
        teams: [],
        tags: []
      },
      filters: {
        search: '',
        entryType: '',
        department: '',
        team: '',
        tag: ''
      },
      formDialog: false,
      form: {
        id: null,
        name: '',
        entryType: 'SERVICE',
        description: '',
        linkUrl: '',
        department: '',
        team: '',
        tags: []
      },
      tagsText: ''
    }
  },
  computed: {
    permissions: get('user/permissions'),
    isAuthenticated: get('user/authenticated'),
    isAdmin () {
      return _.includes(this.permissions, 'manage:system')
    },
    visitsSeries () {
      return this.overview.visitsLast30d.map(r => r.value)
    },
    createdSeries () {
      return this.overview.createdLast30d.map(r => r.value)
    },
    updatedSeries () {
      return this.overview.updatedLast30d.map(r => r.value)
    },
    entryTypes () {
      return ['SERVICE', 'PROCESS']
    },
    tableHeaders () {
      return [
        { text: 'Nome / Descrição', value: 'name' },
        { text: 'Tipo', value: 'entryType', width: 110 },
        { text: 'Departamento', value: 'department', width: 140 },
        { text: 'Time', value: 'team', width: 130 },
        { text: 'Tags', value: 'tags', width: 160 },
        { text: 'Atualizado', value: 'updatedAt', width: 160 },
        { text: '', value: 'actions', width: 100, sortable: false, align: 'right' }
      ]
    }
  },
  watch: {
    filters: {
      handler: _.debounce(function () {
        this.refreshItems()
      }, 300),
      deep: true
    }
  },
  methods: {
    async refreshAll () {
      await Promise.all([
        this.$apollo.queries.config.refetch(),
        this.$apollo.queries.overview.refetch(),
        this.$apollo.queries.items.refetch(),
        this.$apollo.queries.facets.refetch()
      ])
    },
    async refreshItems () {
      if (this.$apollo.queries.items) {
        await this.$apollo.queries.items.refetch()
      }
    },
    addQuickLink () {
      this.config.quickLinks.push({
        label: 'Novo link',
        icon: 'mdi-link-variant',
        url: '/dashboard',
        color: 'primary'
      })
    },
    removeQuickLink (idx) {
      this.config.quickLinks.splice(idx, 1)
    },
    async saveConfig () {
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($customContent: String!, $quickLinks: [DashboardQuickLinkInput]!) {
              dashboard {
                saveConfig(customContent: $customContent, quickLinks: $quickLinks) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: {
            customContent: this.config.customContent || '',
            quickLinks: this.config.quickLinks || []
          }
        })
        if (!_.get(resp, 'data.dashboard.saveConfig.responseResult.succeeded', false)) {
          throw new Error(_.get(resp, 'data.dashboard.saveConfig.responseResult.message', 'Falha ao salvar dashboard.'))
        }
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'check',
          message: 'Dashboard atualizado com sucesso.'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    openCreate () {
      this.form = {
        id: null,
        name: '',
        entryType: 'SERVICE',
        description: '',
        linkUrl: '',
        department: '',
        team: '',
        tags: []
      }
      this.tagsText = ''
      this.formDialog = true
    },
    openEdit (item) {
      this.form = {
        id: item.id,
        name: item.name,
        entryType: item.entryType,
        description: item.description,
        linkUrl: item.linkUrl || '',
        department: item.department || '',
        team: item.team || '',
        tags: item.tags || []
      }
      this.tagsText = (item.tags || []).join(', ')
      this.formDialog = true
    },
    async saveItem () {
      try {
        const tags = _.uniq((this.tagsText || '').split(',').map(t => _.trim(t)).filter(Boolean))
        const variables = {
          name: this.form.name,
          entryType: this.form.entryType,
          description: this.form.description,
          linkUrl: this.form.linkUrl,
          department: this.form.department,
          team: this.form.team,
          tags
        }
        const resp = await this.$apollo.mutate({
          mutation: this.form.id ? gql`
            mutation ($id: Int!, $name: String!, $entryType: String!, $description: String!, $linkUrl: String, $department: String!, $team: String!, $tags: [String]) {
              serviceCatalog {
                update(id: $id, name: $name, entryType: $entryType, description: $description, linkUrl: $linkUrl, department: $department, team: $team, tags: $tags) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          ` : gql`
            mutation ($name: String!, $entryType: String!, $description: String!, $linkUrl: String, $department: String!, $team: String!, $tags: [String]) {
              serviceCatalog {
                create(name: $name, entryType: $entryType, description: $description, linkUrl: $linkUrl, department: $department, team: $team, tags: $tags) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: this.form.id ? { id: this.form.id, ...variables } : variables
        })
        const path = this.form.id ? 'data.serviceCatalog.update.responseResult' : 'data.serviceCatalog.create.responseResult'
        if (!_.get(resp, `${path}.succeeded`, false)) {
          throw new Error(_.get(resp, `${path}.message`, 'Falha ao salvar item.'))
        }
        this.formDialog = false
        await Promise.all([
          this.$apollo.queries.items.refetch(),
          this.$apollo.queries.facets.refetch(),
          this.$apollo.queries.overview.refetch()
        ])
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'check',
          message: 'Registro salvo com sucesso.'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async removeItem (item) {
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              serviceCatalog {
                delete(id: $id) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: { id: item.id }
        })
        if (!_.get(resp, 'data.serviceCatalog.delete.responseResult.succeeded', false)) {
          throw new Error(_.get(resp, 'data.serviceCatalog.delete.responseResult.message', 'Falha ao excluir item.'))
        }
        await Promise.all([
          this.$apollo.queries.items.refetch(),
          this.$apollo.queries.facets.refetch(),
          this.$apollo.queries.overview.refetch()
        ])
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'check',
          message: 'Registro excluído com sucesso.'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  },
  apollo: {
    config: {
      query: gql`
        {
          dashboard {
            config {
              customContent
              quickLinks {
                label
                icon
                url
                color
              }
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: data => _.cloneDeep(data.dashboard.config)
    },
    overview: {
      query: gql`
        {
          dashboard {
            overview {
              summary {
                totalArticles
                publishedArticles
                draftArticles
                totalUsers
                totalServices
                totalProcesses
                totalVisits
              }
              latestArticles {
                id
                title
                path
                locale
                createdAt
                updatedAt
                views
              }
              topArticles {
                id
                title
                path
                locale
                createdAt
                updatedAt
                views
              }
              topUsers {
                id
                name
                email
                visits
              }
              localeStats {
                locale
                total
              }
              visitsLast30d {
                label
                value
              }
              createdLast30d {
                label
                value
              }
              updatedLast30d {
                label
                value
              }
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: data => _.cloneDeep(data.dashboard.overview)
    },
    items: {
      query: gql`
        query ($search: String, $entryType: String, $department: String, $team: String, $tag: String) {
          serviceCatalog {
            list(search: $search, entryType: $entryType, department: $department, team: $team, tag: $tag, limit: 300) {
              id
              name
              entryType
              description
              linkUrl
              department
              team
              tags
              createdAt
              updatedAt
              createdById
              updatedById
              createdByName
              updatedByName
              canDelete
            }
          }
        }
      `,
      variables () {
        return {
          search: this.filters.search || null,
          entryType: this.filters.entryType || null,
          department: this.filters.department || null,
          team: this.filters.team || null,
          tag: this.filters.tag || null
        }
      },
      fetchPolicy: 'network-only',
      update: data => _.cloneDeep(data.serviceCatalog.list || [])
    },
    facets: {
      query: gql`
        {
          serviceCatalog {
            facets {
              departments
              teams
              tags
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: data => _.cloneDeep(data.serviceCatalog.facets)
    }
  }
}
</script>

<style lang='scss'>
.dashboard-app {
  .dashboard-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }
}
</style>
