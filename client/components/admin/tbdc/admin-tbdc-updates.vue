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
              v-icon(color='green', size='40') mdi-emoticon-happy-outline
              .display-1.mt-2 {{stats.happy || 0}}
            v-flex.text-center
              v-icon(color='orange', size='40') mdi-emoticon-neutral-outline
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
                .overline Categorias (Produtos)
                v-list(dense)
                  v-list-item(v-for='cat in categories', :key='cat.id')
                    v-list-item-avatar(size='24', :color='cat.color', tile)
                    v-list-item-content: v-list-item-title {{cat.name}}
                v-divider.my-4
                .overline Público-Alvo (Recursos para...)
                v-list(dense)
                  v-list-item(v-for='target in targets', :key='target.id')
                    v-list-item-icon: v-icon {{target.icon}}
                    v-list-item-content: v-list-item-title {{target.name}}

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
                v-switch(label='Publicado', v-model='editItem.isPublished', color='success')

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
              categories { id name color icon }
              targets { id name icon }
              adminConfig { responsibleUserId sidebarLinks }
            }
          }`,
          fetchPolicy: 'network-only'
        })
        this.updates = resp.data.tbdcUpdates.listUpdates.items
        this.categories = resp.data.tbdcUpdates.categories
        this.targets = resp.data.tbdcUpdates.targets
        this.config = resp.data.tbdcUpdates.adminConfig

        // Simulação de stats p/ demonstração
        this.stats = { happy: 12, neutral: 4, sad: 1 }
      } catch (err) {
        this.$store.commit('showError', err.message)
      }
      this.loading = false
    },
    editPost(item) {
      this.editItem = { ...item }
      this.editorMode = 'edit'
      this.isEditorOpen = true
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
        this.$store.commit('showError', err.message)
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
          this.$store.commit('showError', err.message)
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
        this.$store.commit('showError', err.message)
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
