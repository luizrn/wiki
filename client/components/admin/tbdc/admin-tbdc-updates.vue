<template lang='pug'>
v-container(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        v-icon.animated.fadeInUp(size='80', color='primary') mdi-update
        .admin-header-title
          .headline.primary--text.animated.fadeInLeft Novidades (Updates)
          .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Gerencie as atualizações e novidades da plataforma
        v-spacer
        v-btn.animated.fadeInDown(color='primary', @click='isEditorOpen = true; editorMode = "create"; editItem = {}')
          v-icon(left) mdi-plus
          span Nova Postagem

    //- DASHBOARD / STATS
    v-flex(xs12, md4)
      v-card.animated.fadeInUp.wait-p2s
        v-card-title: .overline Satisfação Geral (Médias)
        v-card-text
          v-layout(row, align-center, justify-space-around)
            v-flex.text-center
              v-icon(color='primary', size='40') mdi-emoticon-happy-outline
              .display-1.mt-2 {{stats.happy || 0}}
            v-flex.text-center
              v-icon(color='#9BC113', size='40') mdi-emoticon-neutral-outline
              .display-1.mt-2 {{stats.neutral || 0}}
            v-flex.text-center
              v-icon(color='red', size='40') mdi-emoticon-sad-outline
              .display-1.mt-2 {{stats.sad || 0}}

    v-flex(xs12, md8)
      v-card.animated.fadeInUp.wait-p3s
        v-tabs(v-model='activeTab', color='primary')
          v-tab Postagens
          v-tab Configurações
          v-tab Dados Mestres

        v-tabs-items(v-model='activeTab')
          //- LISTAGEM DE POSTS
          v-tab-item
            v-data-table(:headers='headers', :items='updates', :loading='loading')
              template(v-slot:item.title='{ item }')
                .body-1.font-weight-bold {{item.title}}
                .caption.grey--text {{item.category.name}}
              template(v-slot:item.isPublished='{ item }')
                v-chip(small, :color='item.isPublished ? "success" : "grey"', outlined)
                  | {{item.isPublished ? "Publicado" : "Rascunho"}}
              template(v-slot:item.actions='{ item }')
                v-btn(icon, small, @click='editPost(item)')
                  v-icon(small) mdi-pencil
                v-btn(icon, small, color='red', @click='deletePost(item)')
                  v-icon(small) mdi-delete

          //- CONFIGURAÇÕES
          v-tab-item
            v-card(flat)
              v-card-text
                v-select(
                  label='Usuário Responsável pelas Postagens'
                  :items='staff'
                  item-text='name'
                  item-value='id'
                  v-model='config.responsibleUserId'
                )
                v-textarea(
                  label='Links do Menu Lateral (JSON)'
                  v-model='config.sidebarLinks'
                  rows='5'
                  hint='Ex: [{"label": "Suporte", "icon": "mdi-help", "url": "/help"}]'
                )
              v-card-actions
                v-spacer
                v-btn(color='primary', @click='saveConfig') Salvar Configurações

          //- DADOS MESTRES (Categorias/Alvos)
          v-tab-item
            v-card(flat)
              v-card-text
                .d-flex.align-center
                  .overline Categorias (Produtos)
                  v-spacer
                  v-btn(small, color='primary', @click='openCategoryEditor()')
                    v-icon(left, small) mdi-plus
                    span Nova Categoria
                v-list(dense)
                  v-list-item(v-for='cat in categories', :key='cat.id')
                    v-list-item-avatar(size='24', :color='cat.color', tile)
                      v-icon(small, dark) {{ cat.icon || 'mdi-tag' }}
                    v-list-item-content
                      v-list-item-title {{cat.name}}
                      v-list-item-subtitle Ordem: {{cat.order || 0}} | Público: {{cat.showOnPublicPage ? 'Sim' : 'Não'}}
                    v-list-item-action
                      v-btn(icon, small, @click='openCategoryEditor(cat)')
                        v-icon(small) mdi-pencil
                      v-btn(icon, small, color='red', @click='deleteCategory(cat)')
                        v-icon(small) mdi-delete
                v-divider.my-4
                .d-flex.align-center
                  .overline Público-Alvo (Recursos para...)
                  v-spacer
                  v-btn(small, color='primary', @click='openTargetEditor()')
                    v-icon(left, small) mdi-plus
                    span Novo Público-Alvo
                v-list(dense)
                  v-list-item(v-for='target in targets', :key='target.id')
                    v-list-item-icon: v-icon {{target.icon}}
                    v-list-item-content: v-list-item-title {{target.name}}
                    v-list-item-action
                      v-btn(icon, small, @click='openTargetEditor(target)')
                        v-icon(small) mdi-pencil
                      v-btn(icon, small, color='red', @click='deleteTarget(target)')
                        v-icon(small) mdi-delete

    //- EDITOR DIALOG
    v-dialog(v-model='isEditorOpen', fullscreen, transition='dialog-bottom-transition')
      v-card
        v-toolbar(dark, color='primary')
          v-btn(icon, dark, @click='isEditorOpen = false')
            v-icon mdi-close
          v-toolbar-title {{editorMode === "create" ? "Nova Postagem" : "Editar Postagem"}}
          v-spacer
          v-btn(dark, text, @click='savePost')
            v-icon(left) mdi-content-save
            | Salvar
        v-card-text.pa-4
          v-container
            v-layout(row, wrap)
              v-flex(xs12, md8)
                v-text-field(label='Título da Novidade', v-model='editItem.title', outlined)
                .subtitle-1.mb-2 Conteúdo
                //- Simulação de editor rico (no Wiki.js usaríamos o editor padrão)
                v-textarea(v-model='editItem.content', outlined, rows='15', placeholder='Use Markdown para formatar seu post...')
              v-flex(xs12, md4)
                v-select(label='Produto/Categoria', :items='categories', item-text='name', item-value='id', v-model='editItem.categoryId', outlined)
                v-select(label='Público-Alvo', :items='targets', item-text='name', item-value='id', v-model='editItem.targetId', outlined)
                v-textarea(label='Resumo Crítico (O que é o recurso?)', v-model='editItem.summary', outlined, rows='3')
                v-switch(label='Publicado', v-model='editItem.isPublished', color='primary')

    //- CATEGORY DIALOG
    v-dialog(v-model='isCategoryEditorOpen', max-width='560')
      v-card
        v-card-title {{ categoryEdit.id ? 'Editar Categoria' : 'Nova Categoria' }}
        v-card-text
          v-text-field(v-model='categoryEdit.name', label='Nome', outlined, dense)
          v-row
            v-col(cols='6')
              v-text-field(v-model='categoryEdit.color', label='Cor HEX', outlined, dense, placeholder='#18563B')
            v-col(cols='6')
              v-text-field(v-model='categoryEdit.icon', label='Ícone (MDI)', outlined, dense, placeholder='mdi-tag')
          v-row
            v-col(cols='6')
              v-text-field(v-model.number='categoryEdit.order', type='number', label='Ordem', outlined, dense)
            v-col(cols='6')
              v-switch(v-model='categoryEdit.showOnPublicPage', label='Exibir no público', color='primary')
        v-card-actions
          v-spacer
          v-btn(text, @click='isCategoryEditorOpen = false') Cancelar
          v-btn(color='primary', @click='saveCategory') Salvar

    //- TARGET DIALOG
    v-dialog(v-model='isTargetEditorOpen', max-width='520')
      v-card
        v-card-title {{ targetEdit.id ? 'Editar Público-Alvo' : 'Novo Público-Alvo' }}
        v-card-text
          v-text-field(v-model='targetEdit.name', label='Nome', outlined, dense)
          v-text-field(v-model='targetEdit.icon', label='Ícone (MDI)', outlined, dense, placeholder='mdi-account-group')
        v-card-actions
          v-spacer
          v-btn(text, @click='isTargetEditorOpen = false') Cancelar
          v-btn(color='primary', @click='saveTarget') Salvar

</template>

<script>
import gql from 'graphql-tag'

export default {
  data() {
    return {
      activeTab: 0,
      loading: false,
      updates: [],
      categories: [],
      targets: [],
      staff: [],
      stats: { happy: 0, neutral: 0, sad: 0 },
      config: {
        responsibleUserId: 1,
        sidebarLinks: '[]'
      },
      isEditorOpen: false,
      editorMode: 'create',
      isCategoryEditorOpen: false,
      isTargetEditorOpen: false,
      categoryEdit: {
        id: null,
        name: '',
        color: '#18563B',
        icon: 'mdi-tag',
        order: 0,
        showOnPublicPage: true
      },
      targetEdit: {
        id: null,
        name: '',
        icon: 'mdi-account-group'
      },
      editItem: {
        title: '',
        content: '',
        summary: '',
        categoryId: null,
        targetId: null,
        isPublished: false
      },
      headers: [
        { text: 'Postagem', value: 'title' },
        { text: 'Data', value: 'publishedAt' },
        { text: 'Status', value: 'isPublished' },
        { text: 'Ações', value: 'actions', sortable: false, align: 'right' }
      ]
    }
  },
  async mounted() {
    await this.refresh()
  },
  methods: {
    async refresh() {
      this.loading = true
      try {
        const resp = await this.$apollo.query({
          query: gql`query {
            tbdcUpdates {
              listUpdates(limit: 100) { items { id title content summary categoryId category { name color } isPublished publishedAt updatedAt } }
              categories { id name color icon showOnPublicPage order }
              targets { id name icon }
              adminConfig { responsibleUserId sidebarLinks }
            }
            users {
              list(orderBy: "name") { id name isActive isSystem }
            }
          }`,
          fetchPolicy: 'network-only'
        })
        this.updates = resp.data.tbdcUpdates.listUpdates.items
        this.categories = resp.data.tbdcUpdates.categories
        this.targets = resp.data.tbdcUpdates.targets
        this.config = resp.data.tbdcUpdates.adminConfig
        this.staff = (resp.data.users.list || []).filter(u => u.isActive && !u.isSystem).map(u => ({
          id: u.id,
          name: u.name
        }))

        // Simulação de stats p/ demonstração
        this.stats = { happy: 12, neutral: 4, sad: 1 }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.loading = false
    },
    editPost(item) {
      this.editItem = { ...item }
      this.editorMode = 'edit'
      this.isEditorOpen = true
    },
    openCategoryEditor(cat = null) {
      if (cat) {
        this.categoryEdit = {
          id: cat.id,
          name: cat.name || '',
          color: cat.color || '#18563B',
          icon: cat.icon || 'mdi-tag',
          order: cat.order || 0,
          showOnPublicPage: cat.showOnPublicPage !== false
        }
      } else {
        this.categoryEdit = {
          id: null,
          name: '',
          color: '#18563B',
          icon: 'mdi-tag',
          order: (this.categories || []).length,
          showOnPublicPage: true
        }
      }
      this.isCategoryEditorOpen = true
    },
    async saveCategory() {
      try {
        await this.$apollo.mutate({
          mutation: gql`mutation($id:Int,$name:String!,$color:String,$icon:String,$showOnPublicPage:Boolean,$order:Int){
            tbdcUpdates {
              upsertCategory(id:$id,name:$name,color:$color,icon:$icon,showOnPublicPage:$showOnPublicPage,order:$order){ id }
            }
          }`,
          variables: {
            id: this.categoryEdit.id,
            name: this.categoryEdit.name,
            color: this.categoryEdit.color,
            icon: this.categoryEdit.icon,
            showOnPublicPage: this.categoryEdit.showOnPublicPage,
            order: this.categoryEdit.order
          }
        })
        this.isCategoryEditorOpen = false
        await this.refresh()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async deleteCategory(cat) {
      if (!confirm(`Deseja excluir a categoria "${cat.name}"?`)) {
        return
      }
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`mutation($id:Int!){ tbdcUpdates { deleteCategory(id:$id){ responseResult { succeeded message } } } }`,
          variables: { id: cat.id }
        })
        if (!resp.data.tbdcUpdates.deleteCategory.responseResult.succeeded) {
          throw new Error(resp.data.tbdcUpdates.deleteCategory.responseResult.message || 'Falha ao excluir categoria.')
        }
        await this.refresh()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    openTargetEditor(target = null) {
      if (target) {
        this.targetEdit = {
          id: target.id,
          name: target.name || '',
          icon: target.icon || 'mdi-account-group'
        }
      } else {
        this.targetEdit = {
          id: null,
          name: '',
          icon: 'mdi-account-group'
        }
      }
      this.isTargetEditorOpen = true
    },
    async saveTarget() {
      try {
        await this.$apollo.mutate({
          mutation: gql`mutation($id:Int,$name:String!,$icon:String){
            tbdcUpdates {
              upsertTarget(id:$id,name:$name,icon:$icon){ id }
            }
          }`,
          variables: {
            id: this.targetEdit.id,
            name: this.targetEdit.name,
            icon: this.targetEdit.icon
          }
        })
        this.isTargetEditorOpen = false
        await this.refresh()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async deleteTarget(target) {
      if (!confirm(`Deseja excluir o público-alvo "${target.name}"?`)) {
        return
      }
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`mutation($id:Int!){ tbdcUpdates { deleteTarget(id:$id){ responseResult { succeeded message } } } }`,
          variables: { id: target.id }
        })
        if (!resp.data.tbdcUpdates.deleteTarget.responseResult.succeeded) {
          throw new Error(resp.data.tbdcUpdates.deleteTarget.responseResult.message || 'Falha ao excluir público-alvo.')
        }
        await this.refresh()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async savePost() {
      try {
        await this.$apollo.mutate({
          mutation: gql`mutation($id: Int, $title: String!, $content: String!, $summary: String, $categoryId: Int!, $targetId: Int, $isPublished: Boolean) {
            tbdcUpdates {
              upsertUpdate(id: $id, title: $title, content: $content, summary: $summary, categoryId: $categoryId, targetId: $targetId, isPublished: $isPublished) {
                update { id }
              }
            }
          }`,
          variables: {
            id: this.editItem.id,
            title: this.editItem.title,
            content: this.editItem.content,
            summary: this.editItem.summary,
            categoryId: this.editItem.categoryId,
            targetId: this.editItem.targetId,
            isPublished: this.editItem.isPublished
          }
        })
        this.isEditorOpen = false
        await this.refresh()
        this.$store.commit('showSuccess', 'Novidade salva com sucesso!')
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async deletePost(item) {
      if (confirm('Deseja excluir esta postagem?')) {
        try {
          await this.$apollo.mutate({
            mutation: gql`mutation($id: Int!) {
              tbdcUpdates {
                deleteUpdate(id: $id) { responseResult { message } }
              }
            }`,
            variables: { id: item.id }
          })
          await this.refresh()
        } catch (err) {
          this.$store.commit('pushGraphError', err)
        }
      }
    },
    async saveConfig() {
      try {
        await this.$apollo.mutate({
          mutation: gql`mutation($u: Int, $s: String) {
            tbdcUpdates {
              saveConfig(responsibleUserId: $u, sidebarLinks: $s) { responseResult { message } }
            }
          }`,
          variables: {
            u: parseInt(this.config.responsibleUserId),
            s: this.config.sidebarLinks
          }
        })
        this.$store.commit('showSuccess', 'Configurações salvas!')
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  }
}
</script>

<style lang='scss' scoped>
.admin-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  &-title {
    margin-left: 16px;
  }
}
</style>
