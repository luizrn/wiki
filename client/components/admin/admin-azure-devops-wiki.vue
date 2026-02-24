<template lang='pug'>
v-container(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        img.animated.fadeInUp(src='/_assets/svg/icon-rest-api.svg', alt='Azure DevOps Wiki', style='width: 80px;')
        .admin-header-title
          .headline.primary--text.animated.fadeInLeft Azure DevOps Wiki
          .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Importação unidirecional de artigos Azure DevOps -> Wiki.js

    v-flex(xs12, lg6)
      v-card.animated.fadeInUp
        v-toolbar(flat, color='primary', dark, dense)
          .subtitle-1 Configuração
        v-card-text
          v-switch(v-model='form.enabled', label='Habilitar integração')
          v-text-field(v-model='form.organization', label='Organization', hint='Ex.: minha-org', persistent-hint, outlined, dense)
          v-text-field(v-model='form.pat', label='Token de API (PAT) (opcional ao manter o atual)', type='password', outlined, dense)
          v-text-field(v-model='form.defaultProject', label='Projeto padrão', outlined, dense)
          v-text-field(v-model='form.defaultWiki', label='Wiki padrão', outlined, dense)
          v-text-field(v-model='form.defaultLocale', label='Locale padrão', outlined, dense, placeholder='pt-br')
          v-text-field(v-model='form.targetBasePath', label='Base path destino', outlined, dense, placeholder='azure-devops')
          .caption.grey--text(v-if='config && config.hasPAT') Token atual (PAT): {{config.patMasked}}
        v-card-actions
          v-spacer
          v-btn.mr-2(outlined, color='primary', @click='testConnection', :loading='testing') Testar conexão
          v-btn(color='primary', @click='saveConfig', :loading='saving') Salvar

    v-flex(xs12, lg6)
      v-card.animated.fadeInUp.wait-p2s
        v-toolbar(flat, color='indigo', dark, dense)
          .subtitle-1 Importação
        v-card-text
          v-select(
            v-model='importForm.project'
            :items='projects'
            item-text='name'
            item-value='name'
            label='Projeto'
            outlined
            dense
            @change='loadWikis'
          )
          v-select(
            v-model='importForm.wiki'
            :items='wikis'
            item-text='name'
            item-value='name'
            label='Wiki'
            outlined
            dense
          )
          v-text-field(v-model='importForm.rootPath', label='Path raiz no Azure Wiki', outlined, dense, placeholder='/')
          v-text-field(v-model='importForm.locale', label='Locale destino', outlined, dense, placeholder='pt-br')
          v-text-field(v-model='importForm.targetBasePath', label='Base path destino', outlined, dense, placeholder='azure-devops')
          v-switch(v-model='importForm.incremental', label='Import incremental (pular sem alteração)')
          .caption.grey--text Último sync: {{config && config.lastSyncAt ? $options.filters.moment(config.lastSyncAt, 'lll') : 'nunca'}}
        v-card-actions
          v-spacer
          v-btn(color='indigo', dark, @click='runImport', :loading='importing', :disabled='!importForm.project || !importForm.wiki') Importar agora

    v-flex(xs12, v-if='importResult')
      v-card.animated.fadeInUp.wait-p3s
        v-toolbar(flat, dense)
          .subtitle-1 Resultado da importação
        v-card-text
          .body-2 Total: {{importResult.total}} | Importados: {{importResult.imported}} | Atualizados: {{importResult.updated}} | Pulados: {{importResult.skipped}} | Falhas: {{importResult.failed}}
          v-data-table.mt-3(
            :headers='resultHeaders'
            :items='importResult.items || []'
            :items-per-page='10'
            dense
          )
            template(v-slot:item.error='{ item }')
              span.red--text(v-if='item.error') {{item.error}}
              span(v-else) -
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

const QUERY_CONFIG = gql`
  query {
    azureDevOpsWiki {
      config {
        enabled
        organization
        hasPAT
        patMasked
        defaultProject
        defaultWiki
        defaultLocale
        targetBasePath
        lastSyncAt
      }
      projects {
        id
        name
        state
      }
    }
  }
`

const QUERY_WIKIS = gql`
  query ($project: String!) {
    azureDevOpsWiki {
      wikis(project: $project) {
        id
        name
        type
        mappedPath
      }
    }
  }
`

const MUT_SAVE = gql`
  mutation (
    $enabled: Boolean!
    $organization: String!
    $pat: String
    $defaultProject: String
    $defaultWiki: String
    $defaultLocale: String
    $targetBasePath: String
  ) {
    azureDevOpsWiki {
      saveConfig(
        enabled: $enabled
        organization: $organization
        pat: $pat
        defaultProject: $defaultProject
        defaultWiki: $defaultWiki
        defaultLocale: $defaultLocale
        targetBasePath: $targetBasePath
      ) {
        responseResult {
          succeeded
          message
        }
      }
    }
  }
`

const MUT_TEST = gql`
  mutation {
    azureDevOpsWiki {
      testConnection {
        responseResult {
          succeeded
          message
        }
      }
    }
  }
`

const MUT_IMPORT = gql`
  mutation (
    $project: String!
    $wiki: String!
    $rootPath: String
    $locale: String
    $targetBasePath: String
    $incremental: Boolean
  ) {
    azureDevOpsWiki {
      importFromAzure(
        project: $project
        wiki: $wiki
        rootPath: $rootPath
        locale: $locale
        targetBasePath: $targetBasePath
        incremental: $incremental
      ) {
        responseResult {
          succeeded
          message
        }
        total
        imported
        updated
        skipped
        failed
        items {
          azurePath
          wikiPath
          action
          pageId
          error
        }
      }
    }
  }
`

export default {
  data () {
    return {
      config: null,
      projects: [],
      wikis: [],
      form: {
        enabled: false,
        organization: '',
        pat: '',
        defaultProject: '',
        defaultWiki: '',
        defaultLocale: 'en',
        targetBasePath: 'azure-devops'
      },
      importForm: {
        project: '',
        wiki: '',
        rootPath: '/',
        locale: '',
        targetBasePath: 'azure-devops',
        incremental: true
      },
      saving: false,
      testing: false,
      importing: false,
      importResult: null,
      resultHeaders: [
        { text: 'Ação', value: 'action' },
        { text: 'Azure Path', value: 'azurePath' },
        { text: 'Wiki.js Path', value: 'wikiPath' },
        { text: 'Page ID', value: 'pageId' },
        { text: 'Erro', value: 'error' }
      ]
    }
  },
  methods: {
    async refreshConfig () {
      const resp = await this.$apollo.query({ query: QUERY_CONFIG, fetchPolicy: 'network-only' })
      this.config = _.get(resp, 'data.azureDevOpsWiki.config')
      this.projects = _.get(resp, 'data.azureDevOpsWiki.projects', [])
      if (this.config) {
        this.form = {
          enabled: this.config.enabled,
          organization: this.config.organization || '',
          pat: '',
          defaultProject: this.config.defaultProject || '',
          defaultWiki: this.config.defaultWiki || '',
          defaultLocale: this.config.defaultLocale || 'en',
          targetBasePath: this.config.targetBasePath || 'azure-devops'
        }
        this.importForm.project = this.importForm.project || this.config.defaultProject || ''
        this.importForm.wiki = this.importForm.wiki || this.config.defaultWiki || ''
        this.importForm.locale = this.importForm.locale || this.config.defaultLocale || 'en'
        this.importForm.targetBasePath = this.config.targetBasePath || 'azure-devops'
        if (this.importForm.project) {
          await this.loadWikis()
        }
      }
    },
    async loadWikis () {
      if (!this.importForm.project) return
      const resp = await this.$apollo.query({
        query: QUERY_WIKIS,
        fetchPolicy: 'network-only',
        variables: {
          project: this.importForm.project
        }
      })
      this.wikis = _.get(resp, 'data.azureDevOpsWiki.wikis', [])
    },
    async saveConfig () {
      this.saving = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: MUT_SAVE,
          variables: this.form
        })
        if (_.get(resp, 'data.azureDevOpsWiki.saveConfig.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: _.get(resp, 'data.azureDevOpsWiki.saveConfig.responseResult.message', 'Configuração salva.'),
            icon: 'mdi-check'
          })
          await this.refreshConfig()
        } else {
          throw new Error(_.get(resp, 'data.azureDevOpsWiki.saveConfig.responseResult.message', 'Falha ao salvar configuração.'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.saving = false
    },
    async testConnection () {
      this.testing = true
      try {
        const resp = await this.$apollo.mutate({ mutation: MUT_TEST })
        if (_.get(resp, 'data.azureDevOpsWiki.testConnection.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: _.get(resp, 'data.azureDevOpsWiki.testConnection.responseResult.message', 'Conexão OK.'),
            icon: 'mdi-check'
          })
          await this.refreshConfig()
        } else {
          throw new Error(_.get(resp, 'data.azureDevOpsWiki.testConnection.responseResult.message', 'Falha no teste de conexão.'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.testing = false
    },
    async runImport () {
      this.importing = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: MUT_IMPORT,
          variables: this.importForm
        })
        const result = _.get(resp, 'data.azureDevOpsWiki.importFromAzure')
        if (_.get(result, 'responseResult.succeeded', false)) {
          this.importResult = result
          this.$store.commit('showNotification', {
            style: 'success',
            message: _.get(result, 'responseResult.message', 'Importação concluída.'),
            icon: 'mdi-check'
          })
          await this.refreshConfig()
        } else {
          throw new Error(_.get(result, 'responseResult.message', 'Falha na importação.'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.importing = false
    }
  },
  mounted () {
    this.refreshConfig()
  }
}
</script>
