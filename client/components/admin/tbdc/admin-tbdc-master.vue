<template lang='pug'>
v-container(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        v-icon.animated.fadeInUp(size='80', color='primary') mdi-database-edit-outline
        .admin-header-title
          .headline.primary--text.animated.fadeInLeft Dados Mestres TBDC
          .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Gerencie Produtos, Módulos e Equipe (CS / Implantadores)
        v-spacer
        v-btn.animated.fadeInDown(color='primary', large, depressed, @click='refresh')
          v-icon(left) mdi-refresh
          span Atualizar

      v-tabs.mt-3.animated.fadeInUp(v-model='activeTab', background-color='transparent', color='primary')
        v-tab(key='products') Produtos & Módulos
        v-tab(key='staff') Equipe (CS / Implantadores)

      v-tabs-items(v-model='activeTab')
        //- TAB: PRODUTOS & MÓDULOS
        v-tab-item(:value='0')
          v-card(flat, :class='$vuetify.theme.dark ? "grey darken-4" : "grey lighten-5"')
            v-card-text.pa-4
              v-layout(row, wrap)
                v-flex(xs12, md4)
                  v-card(outlined)
                    v-toolbar(flat, dense, :color='$vuetify.theme.dark ? "grey darken-3" : "grey lighten-4"')
                      v-toolbar-title.subtitle-1 Produtos
                      v-spacer
                      v-btn(icon, small, @click='editProduct({})')
                        v-icon mdi-plus
                    v-list(dense)
                      template(v-for='product in products')
                        v-list-item(
                          :key='product.id'
                          @click='selectedProduct = product'
                          :class='selectedProduct.id === product.id ? "primary--text font-weight-bold" : ""'
                          :style='selectedProduct.id === product.id ? { backgroundColor: $vuetify.theme.dark ? "rgba(24, 86, 59, 0.30)" : "rgba(24, 86, 59, 0.10)" } : {}'
                        )
                          v-list-item-content
                            v-list-item-title {{ product.name }}
                          v-list-item-action
                            v-btn(icon, small, @click.stop='editProduct(product)')
                              v-icon(small) mdi-pencil

                v-flex(xs12, md8)
                  v-card(outlined, v-if='selectedProduct.id')
                    v-toolbar(flat, dense, :color='$vuetify.theme.dark ? "grey darken-3" : "grey lighten-4"')
                      v-toolbar-title.subtitle-1 Módulos de {{ selectedProduct.name }}
                      v-spacer
                      v-btn(icon, small, @click='editModule({})')
                        v-icon mdi-plus
                    v-list(dense)
                      template(v-if='selectedProduct.modules && selectedProduct.modules.length > 0')
                        template(v-for='mod in selectedProduct.modules')
                          v-list-item(:key='mod.id')
                            v-list-item-content
                              v-list-item-title {{ mod.name }}
                            v-list-item-action
                              v-btn(icon, small, @click.stop='editModule(mod)')
                                v-icon(small) mdi-pencil
                      v-list-item(v-else)
                        v-list-item-content
                          v-list-item-title.grey--text Nenhum módulo cadastrado.
                  v-alert(v-else, type='info', outlined) Selecione um produto para gerenciar seus módulos.

        //- TAB: STAFF
        v-tab-item(:value='1')
          v-card(flat, :class='$vuetify.theme.dark ? "grey darken-4" : "grey lighten-5"')
            v-card-text.pa-4
              .d-flex.mb-4
                v-btn(color='primary', depressed, @click='editStaff({})')
                  v-icon(left) mdi-plus
                  span Adicionar Membro
              v-card(outlined)
                v-data-table(:items='staff', :headers='staffHeaders', :loading='loading', hide-default-footer)
                  template(v-slot:item.role='{ item }')
                    v-chip(small, :color='item.role === "CS" ? "#9BC113" : "#18563B"', dark) {{ item.role }}
                  template(v-slot:item.actions='{ item }')
                    v-btn(icon, small, @click='editStaff(item)')
                      v-icon(small) mdi-pencil
                    v-btn(icon, small, color='red', @click='deleteStaff(item)')
                      v-icon(small) mdi-delete

  //- DIALOGS
  //- Product Edit
  v-dialog(v-model='productDialog', max-width='500')
    v-card
      .dialog-header {{ editObj.id ? 'Editar Produto' : 'Novo Produto' }}
      v-card-text.pt-5
        v-text-field(v-model='editObj.name', label='Nome do Produto', outlined, @keyup.enter='saveProduct')
      v-card-chin
        v-spacer
        v-btn(text, @click='productDialog = false') Cancelar
        v-btn(color='primary', @click='saveProduct') Salvar

  //- Module Edit
  v-dialog(v-model='moduleDialog', max-width='500')
    v-card
      .dialog-header {{ editObj.id ? 'Editar Módulo' : 'Novo Módulo' }}
      v-card-text.pt-5
        v-text-field(v-model='editObj.name', label='Nome do Módulo', outlined, @keyup.enter='saveModule')
      v-card-chin
        v-spacer
        v-btn(text, @click='moduleDialog = false') Cancelar
        v-btn(color='primary', @click='saveModule') Salvar

  //- Staff Edit
  v-dialog(v-model='staffDialog', max-width='500')
    v-card
      .dialog-header {{ editObj.id ? 'Editar Membro' : 'Novo Membro' }}
      v-card-text.pt-5
        v-text-field(v-model='editObj.name', label='Nome', outlined)
        v-text-field(v-model='editObj.email', label='Email', outlined)
        v-select(v-model='editObj.role', :items='roles', label='Cargo', outlined)
      v-card-chin
        v-spacer
        v-btn(text, @click='staffDialog = false') Cancelar
        v-btn(color='primary', @click='saveStaff') Salvar

</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

export default {
  data() {
    return {
      activeTab: 0,
      loading: false,
      products: [],
      staff: [],
      selectedProduct: {},
      productDialog: false,
      moduleDialog: false,
      staffDialog: false,
      editObj: {},
      roles: ['CS', 'IMPLANTADOR'],
      staffHeaders: [
        { text: 'Nome', value: 'name' },
        { text: 'Email', value: 'email' },
        { text: 'Cargo', value: 'role' },
        { text: 'Ações', value: 'actions', sortable: false, width: 100 }
      ]
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.products.refetch()
      await this.$apollo.queries.staff.refetch()
    },
    editProduct(p) {
      this.editObj = _.cloneDeep(p)
      this.productDialog = true
    },
    async saveProduct() {
      try {
        await this.$apollo.mutate({
          mutation: gql`mutation($id: Int, $name: String!) { tbdc { saveProduct(id: $id, name: $name) { id name } } }`,
          variables: { id: this.editObj.id, name: this.editObj.name }
        })
        this.productDialog = false
        await this.refresh()
      } catch (err) { this.$store.commit('pushGraphError', err) }
    },
    editModule(m) {
      this.editObj = _.cloneDeep(m)
      this.moduleDialog = true
    },
    async saveModule() {
      try {
        await this.$apollo.mutate({
          mutation: gql`mutation($id: Int, $productId: Int!, $name: String!) { tbdc { saveModule(id: $id, productId: $productId, name: $name) { id name } } }`,
          variables: { id: this.editObj.id, productId: this.selectedProduct.id, name: this.editObj.name }
        })
        this.moduleDialog = false
        await this.refresh()
        // Update local selected product modules
        const updatedProduct = _.find(this.products, { id: this.selectedProduct.id })
        if (updatedProduct) {
          this.selectedProduct = updatedProduct
        }
      } catch (err) { this.$store.commit('pushGraphError', err) }
    },
    editStaff(s) {
      this.editObj = _.cloneDeep(s)
      this.staffDialog = true
    },
    async saveStaff() {
      try {
        await this.$apollo.mutate({
          mutation: gql`mutation($id: Int, $name: String!, $email: String!, $role: String!) { tbdc { saveStaff(id: $id, name: $name, email: $email, role: $role) { id name } } }`,
          variables: { id: this.editObj.id, name: this.editObj.name, email: this.editObj.email, role: this.editObj.role }
        })
        this.staffDialog = false
        await this.refresh()
      } catch (err) { this.$store.commit('pushGraphError', err) }
    },
    async deleteStaff(item) {
      if (confirm('Tem certeza que deseja excluir este membro?')) {
        try {
          await this.$apollo.mutate({
            mutation: gql`mutation($id: Int!) { tbdc { deleteStaff(id: $id) } }`,
            variables: { id: item.id }
          })
          await this.refresh()
        } catch (err) { this.$store.commit('pushGraphError', err) }
      }
    }
  },
  apollo: {
    products: {
      query: gql`query { tbdc { products { id name modules { id name } } } }`,
      update: data => data.tbdc.products,
      watchLoading (isLoading) {
        this.loading = isLoading
      }
    },
    staff: {
      query: gql`query { tbdc { staff { id name email role } } }`,
      update: data => data.tbdc.staff
    }
  }
}
</script>
