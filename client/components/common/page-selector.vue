<template lang="pug">
  v-dialog(
    v-model='isShown'
    max-width='850px'
    overlay-color='blue darken-4'
    overlay-opacity='.7'
    )
    v-card.page-selector
      v-stepper(v-model='step')
        v-stepper-header.primary.darken-1(dark)
          v-stepper-step(:complete='step > 1', step='1', color='white', light)
            span.white--text {{ tr('common:pageSelector.stepLocation', 'Localização') }}
          v-divider
          v-stepper-step(step='2', color='white', light)
            span.white--text {{ tr('common:pageSelector.stepName', 'Nome da Página') }}

        v-stepper-items
          //- STEP 1: Location & Folders
          v-stepper-content.pa-0(step='1')
            .d-flex.flex-column
              v-toolbar(color='grey darken-3', dark, dense, flat)
                v-icon.mr-2 mdi-folder-search-outline
                .body-2 {{ tr('common:pageSelector.virtualFolders', 'Pastas Virtuais') }}
                v-spacer
                v-btn(icon, small, @click='showNewFolderDialog = true', color='success')
                  v-icon mdi-folder-plus
                v-btn(icon, tile, href='https://docs.requarks.io/guide/pages#folders', target='_blank')
                  v-icon mdi-help-box

              div(style='height:400px;')
                vue-scroll(:ops='scrollStyle')
                  v-treeview(
                    :key='`pageTree-` + treeViewCacheId'
                    :active.sync='currentNode'
                    :open.sync='openNodes'
                    :items='tree'
                    :load-children='fetchFolders'
                    dense
                    expand-icon='mdi-menu-down-outline'
                    item-id='path'
                    item-text='title'
                    activatable
                    hoverable
                    transition
                    )
                    template(slot='prepend', slot-scope='{ item, open, leaf }')
                      v-icon(color='orange darken-2') mdi-{{ open ? 'folder-open' : 'folder' }}

              v-divider
              v-container.py-3.px-4(fluid, v-if='isCreateMode')
                v-row
                  v-col(cols='12', md='8')
                    v-text-field(
                      ref='quickPathIpt'
                      outlined
                      dense
                      hide-details='auto'
                      :label='tr("common:pageSelector.pageName", "Nome da Página")'
                      v-model='currentPathName'
                      placeholder='meu-novo-artigo'
                      prepend-inner-icon='mdi-file-document-edit-outline'
                      @keyup.enter='open'
                    )
                  v-col(cols='12', md='4', v-if='namespaces.length > 1')
                    v-select(
                      outlined
                      dense
                      hide-details='auto'
                      :label='tr("common:pageSelector.language", "Idioma")'
                      :items='namespaces'
                      v-model='currentLocale'
                      prepend-inner-icon='mdi-translate'
                    )
                v-row.mt-1
                  v-col(cols='12')
                    v-switch.mt-0(
                      v-model='advancedPathMode'
                      inset
                      dense
                      hide-details
                      :label='tr("common:pageSelector.advancedDirectory", "Modo avançado: definir diretório manualmente")'
                    )
                    v-text-field.mt-2(
                      v-if='advancedPathMode'
                      outlined
                      dense
                      hide-details='auto'
                      :label='tr("common:pageSelector.targetDirectory", "Diretório de destino")'
                      v-model='advancedFolderPath'
                      prepend-inner-icon='mdi-folder-cog-outline'
                      placeholder='clientes-processos/financeiro'
                    )
                    .mt-3.pa-3.rounded.grey(:class='$vuetify.theme.dark ? `darken-4` : `lighten-4`')
                      .caption.grey--text {{ tr('common:pageSelector.finalPathPreview', 'Prévia do Caminho Final') }}
                      .subtitle-1.primary--text
                        strong /{{ effectiveFolderPath }}{{ effectiveFolderPath ? '/' : '' }}{{ currentPathName || 'nova-pagina' }}

              v-divider
              v-card-actions.grey.pa-3(:class='$vuetify.theme.dark ? `darken-4` : `lighten-3`')
                .caption.grey--text {{ tr('common:pageSelector.selectedPath', 'Caminho selecionado') }}:
                code.ml-2 /{{ currentFolderPath || '(root)' }}
                v-spacer
                v-btn(text, @click='close') {{ tr('common:actions.cancel', 'Cancelar') }}
                v-btn(v-if='!isCreateMode', color='primary', @click='step = 2', :disabled='!isFolderSelected')
                  span {{ tr('common:actions.next', 'Próximo') }}
                  v-icon(right) mdi-chevron-right
                v-btn(v-if='isCreateMode', color='secondary', outlined, @click='step = 2')
                  span {{ tr('common:actions.advanced', 'Opções avançadas') }}
                v-btn(v-if='isCreateMode', color='primary', @click='open', :disabled='!isValidPath')
                  v-icon(left) mdi-check
                  span {{ tr('common:actions.createPage', 'Criar Página') }}

          //- STEP 2: Page Name
          v-stepper-content.pa-0(step='2')
            v-container.pa-5(fluid)
              v-row
                v-col(cols='12')
                  .overline.mb-2 {{ $t('common:pageSelector.pageDetails') !== 'common:pageSelector.pageDetails' ? $t('common:pageSelector.pageDetails') : 'Detalhes da Página' }}
                  v-select(
                    solo
                    flat
                    :label='tr("common:pageSelector.language", "Idioma")'
                    :items='namespaces'
                    v-model='currentLocale'
                    prepend-inner-icon='mdi-translate'
                    background-color='grey lighten-4'
                    :dark='false'
                    v-if='namespaces.length > 1'
                  )
                  v-text-field(
                    ref='pathIpt'
                    solo
                    flat
                    :label='tr("common:pageSelector.pageName", "Nome da Página")'
                    prefix='/'
                    v-model='currentPathName'
                    background-color='grey lighten-4'
                    placeholder='meu-novo-artigo'
                    @keyup.enter='open'
                    :dark='false'
                    autofocus
                  )
                  .mt-4.pa-4.rounded.grey(:class='$vuetify.theme.dark ? `darken-4` : `lighten-4`')
                    .caption.grey--text {{ tr('common:pageSelector.finalPathPreview', 'Prévia do Caminho Final') }}
                    .subtitle-1.primary--text
                      strong /{{ effectiveFolderPath }}{{ effectiveFolderPath ? '/' : '' }}{{ currentPathName }}

              v-row.mt-5
                v-col(cols='12', class='d-flex align-center')
                  v-btn(text, @click='step = 1')
                    v-icon(left) mdi-chevron-left
                    span {{ tr('common:actions.back', 'Voltar') }}
                  v-spacer
                  v-btn.px-6(color='primary', x-large, @click='open', :disabled='!isValidPath')
                    v-icon(left) mdi-check
                    span {{ tr('common:actions.createPage', 'Criar Página') }}

    //- New Folder Dialog
    v-dialog(v-model='showNewFolderDialog', max-width='400')
      v-card
        v-card-title {{ tr('common:pageSelector.createNewFolder', 'Criar Nova Pasta') }}
        v-card-text
          v-text-field(
            v-model='newFolderName'
            :label='tr("common:pageSelector.folderName", "Nome da Pasta")'
            placeholder='folder-name'
            @keyup.enter='createNewFolder'
            autofocus
          )
        v-card-actions
          v-spacer
          v-btn(text, @click='showNewFolderDialog = false') {{ tr('common:actions.cancel', 'Cancelar') }}
          v-btn(color='primary', @click='createNewFolder', :disabled='!newFolderName') {{ tr('common:actions.create', 'Criar') }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

const localeSegmentRegex = /^[A-Z]{2}(-[A-Z]{2})?$/i

/* global siteLangs, siteConfig */

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    },
    path: {
      type: String,
      default: 'new-page'
    },
    locale: {
      type: String,
      default: 'en'
    },
    mode: {
      type: String,
      default: 'create'
    },
    openHandler: {
      type: Function,
      default: () => {}
    },
    mustExist: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      step: 1,
      showNewFolderDialog: false,
      newFolderName: '',
      treeViewCacheId: 0,
      searchLoading: false,
      currentLocale: siteConfig.lang,
      currentFolderPath: '',
      advancedPathMode: false,
      advancedFolderPath: '',
      currentPathName: 'new-page',
      currentPage: null,
      currentNode: [],
      openNodes: [0],
      tree: [
        {
          id: 0,
          title: '/ (root)',
          path: '',
          children: []
        }
      ],
      pages: [],
      all: [
        {
          id: 0,
          title: '/ (root)',
          path: '',
          parent: null
        }
      ],
      namespaces: siteLangs.length ? siteLangs.map(ns => ns.code) : [siteConfig.lang],
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollX: 0.01, // fix scrollbar not disappearing on load
          scrollingX: false,
          speed: 50
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: '#999',
          hoverStyle: {
            background: '#64B5F6'
          }
        }
      }
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    currentPages () {
      return _.sortBy(_.filter(this.pages, ['parent', _.head(this.currentNode) || 0]), ['title', 'path'])
    },
    isCreateMode () {
      return this.mode === 'create'
    },
    effectiveFolderPath () {
      return this.advancedPathMode ? _.trim(_.trim(this.advancedFolderPath || ''), '/') : this.currentFolderPath
    },
    isFolderSelected () {
      return this.currentNode.length > 0 || this.currentNode[0] === 0
    },
    isValidPath () {
      if (!this.currentPathName) {
        return false
      }
      if (this.mustExist && !this.currentPage) {
        return false
      }
      const fullPath = _.compact([this.effectiveFolderPath, this.currentPathName]).join('/')
      const firstSection = _.head(fullPath.split('/'))
      if (firstSection.length <= 1) {
        return false
      } else if (localeSegmentRegex.test(firstSection)) {
        return false
      } else if (
        _.some(['login', 'logout', 'register', 'verify', 'favicons', 'fonts', 'img', 'js', 'svg'], p => {
          return p === firstSection
        })) {
        return false
      } else {
        return true
      }
    }
  },
  watch: {
    isShown (newValue, oldValue) {
      if (newValue && !oldValue) {
        this.step = 1
        this.currentPathName = _.last(this.path.split('/'))
        this.currentFolderPath = _.initial(this.path.split('/')).join('/')
        this.advancedFolderPath = this.currentFolderPath
        this.advancedPathMode = false
        this.currentLocale = this.locale
        this.currentNode = []
      }
    },
    currentNode (newValue, oldValue) {
      if (newValue.length > 0) {
        const current = _.find(this.all, ['path', newValue[0]])
        if (current) {
          this.currentFolderPath = current.path
          if (!this.advancedPathMode) {
            this.advancedFolderPath = current.path
          }
          if (this.openNodes.indexOf(current.id) < 0) {
            this.openNodes.push(current.id)
          }
        }
      } else {
        this.currentFolderPath = ''
        if (!this.advancedPathMode) {
          this.advancedFolderPath = ''
        }
      }
    },
    currentPage (newValue, oldValue) {
      if (!_.isEmpty(newValue)) {
        this.currentPath = newValue.path
      }
    },
    currentLocale (newValue, oldValue) {
      this.$nextTick(() => {
        this.tree = [
          {
            id: 0,
            title: '/ (root)',
            children: []
          }
        ]
        this.currentNode = [0]
        this.openNodes = [0]
        this.pages = []
        this.all = []
        this.treeViewCacheId += 1
      })
    }
  },
  methods: {
    tr(key, fallback) {
      const txt = this.$t(key)
      return txt !== key ? txt : fallback
    },
    close() {
      this.isShown = false
    },
    open() {
      const fullPath = _.compact([this.effectiveFolderPath, this.currentPathName]).join('/')
      const exit = this.openHandler({
        locale: this.currentLocale,
        path: fullPath,
        id: (this.mustExist && this.currentPage) ? this.currentPage.pageId : 0
      })
      if (exit !== false) {
        this.close()
      }
    },
    createNewFolder() {
      if (!this.newFolderName) return

      const slug = _.kebabCase(this.newFolderName)
      const newPath = _.compact([this.currentFolderPath, slug]).join('/')

      // Check if folder already exists in current children
      const parentNode = _.find(this.all, ['path', this.currentFolderPath])
      if (parentNode && parentNode.children && _.some(parentNode.children, ['path', newPath])) {
        this.$store.commit('showNotification', {
          message: 'Esta pasta já existe.',
          style: 'warning'
        })
        return
      }

      const newId = Math.floor(Math.random() * 1000000) + 10000
      const newFolder = {
        id: newId,
        title: this.newFolderName,
        path: newPath,
        isFolder: true,
        parent: parentNode ? parentNode.id : 0,
        children: []
      }

      if (parentNode) {
        if (!parentNode.children) parentNode.children = []
        parentNode.children.push(newFolder)
      } else {
        this.tree[0].children.push(newFolder)
      }

      this.all.push(newFolder)
      this.currentNode = [newPath]
      this.newFolderName = ''
      this.showNewFolderDialog = false
      this.treeViewCacheId++
    },
    async fetchFolders (item) {
      if (item.children && item.children.length > 0) return

      this.searchLoading = true
      const resp = await this.$apollo.query({
        query: gql`
          query ($parent: Int!, $mode: PageTreeMode!, $locale: String!) {
            pages {
              tree(parent: $parent, mode: $mode, locale: $locale) {
                id
                path
                title
                isFolder
                pageId
                parent
              }
            }
          }
        `,
        fetchPolicy: 'network-only',
        variables: {
          parent: item.id,
          mode: 'ALL',
          locale: this.currentLocale
        }
      })
      const items = _.get(resp, 'data.pages.tree', [])
      const itemFolders = _.filter(items, ['isFolder', true]).map(f => ({...f, children: []}))
      const itemPages = _.filter(items, i => i.pageId > 0)

      item.children = itemFolders.length > 0 ? itemFolders : undefined

      this.pages = _.unionBy(this.pages, itemPages, 'id')
      this.all = _.unionBy(this.all, items, 'id')

      this.searchLoading = false
    }
  }
}
</script>

<style lang='scss'>

.page-selector {
  .v-treeview-node__label {
    font-size: 13px;
  }
  .v-treeview-node__content {
    cursor: pointer;
  }
}

</style>
