<template lang="pug">
v-container(fluid)
  .animated.fadeIn
    v-row
      v-col(cols="12")
        v-card
          v-toolbar(color="primary", dark, flat)
            v-icon(left) mdi-link-variant
            v-toolbar-title Links Públicos de Acesso
            v-spacer
            v-btn-toggle(v-model="filterStatus", mandatory, dense, color="white", background-color="primary")
              v-btn(value="PENDING") Pendentes
              v-btn(value="APPROVED") Ativos
              v-btn(value="REJECTED") Rejeitados
              v-btn(value="EXPIRED") Revogados

          v-data-table(
            :headers="headers",
            :items="publicLinks",
            :loading="loading",
            no-data-text="Nenhuma solicitação encontrada"
          )
            template(v-slot:item.page="{ item }")
              v-list-item(dense, class="pa-0")
                v-list-item-content
                  v-list-item-title {{ item.page ? item.page.title : 'N/A' }}
                  v-list-item-subtitle {{ item.page ? item.page.path : 'N/A' }}

            template(v-slot:item.creator="{ item }")
              v-list-item(dense, class="pa-0")
                v-list-item-content
                  v-list-item-title {{ item.creator ? item.creator.name : 'N/A' }}
                  v-list-item-subtitle {{ item.creator ? item.creator.email : 'N/A' }}

            template(v-slot:item.token="{ item }")
              code {{ item.token.substring(0, 8) }}...
              v-btn(icon, x-small, @click="copyLink(item)", v-if="item.status === 'APPROVED'")
                v-icon mdi-content-copy

            template(v-slot:item.actions="{ item }")
              div(v-if="item.status === 'PENDING'")
                v-btn(color="success", icon, @click="approveLink(item.id)")
                  v-icon mdi-check
                v-btn(color="error", icon, @click="rejectLink(item.id)")
                  v-icon mdi-close
              v-btn(v-else-if="item.status === 'APPROVED'", color="warning", icon, @click="revokeLink(item.id)")
                v-icon mdi-link-variant-off

</template>

<script>
import gql from 'graphql-tag'

export default {
  data() {
    return {
      filterStatus: 'PENDING',
      loading: false,
      publicLinks: [],
      headers: [
        { text: 'Página', value: 'page' },
        { text: 'Solicitante', value: 'creator' },
        { text: 'Token', value: 'token' },
        { text: 'Acessos', value: 'views', align: 'center' },
        { text: 'Criado em', value: 'createdAt' },
        { text: 'Ações', value: 'actions', sortable: false, align: 'end' }
      ]
    }
  },
  watch: {
    filterStatus() {
      this.$apollo.queries.publicLinks.refresh()
    }
  },
  methods: {
    async approveLink(id) {
      try {
        const { data } = await this.$apollo.mutate({
          mutation: gql`mutation ($id: Int!) { publicLinks { approve(id: $id) { responseResult { succeeded message } } } }`,
          variables: { id }
        })
        if (!data.publicLinks.approve.responseResult.succeeded) {
          throw new Error(data.publicLinks.approve.responseResult.message || 'Falha ao aprovar link público.')
        }
        this.$apollo.queries.publicLinks.refresh()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async rejectLink(id) {
      try {
        const { data } = await this.$apollo.mutate({
          mutation: gql`mutation ($id: Int!) { publicLinks { reject(id: $id) { responseResult { succeeded message } } } }`,
          variables: { id }
        })
        if (!data.publicLinks.reject.responseResult.succeeded) {
          throw new Error(data.publicLinks.reject.responseResult.message || 'Falha ao rejeitar link público.')
        }
        this.$apollo.queries.publicLinks.refresh()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async revokeLink(id) {
      try {
        const { data } = await this.$apollo.mutate({
          mutation: gql`mutation ($id: Int!) { publicLinks { revoke(id: $id) { responseResult { succeeded message } } } }`,
          variables: { id }
        })
        if (!data.publicLinks.revoke.responseResult.succeeded) {
          throw new Error(data.publicLinks.revoke.responseResult.message || 'Falha ao revogar link público.')
        }
        this.$apollo.queries.publicLinks.refresh()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    copyLink(item) {
      const url = `${window.location.origin}/pub/${item.token}`
      navigator.clipboard.writeText(url)
      this.$store.commit('showNotification', {
        message: 'Link copiado para a área de transferência!',
        style: 'success',
        icon: 'mdi-check'
      })
    }
  },
  apollo: {
    publicLinks: {
      query: gql`
        query ($status: String) {
          publicLinks {
            list(status: $status) {
              id
              token
              status
              views
              createdAt
              page {
                title
                locale
                path
              }
              creator {
                name
                email
              }
            }
          }
        }
      `,
      variables() {
        return { status: this.filterStatus }
      },
      update: data => data.publicLinks.list,
      watchLoading(isLoading) {
        this.loading = isLoading
      }
    }
  }
}
</script>
