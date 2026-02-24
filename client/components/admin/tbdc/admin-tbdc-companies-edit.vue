<template lang='pug'>
v-container(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        v-icon.animated.fadeInUp(size='80', color='primary') mdi-office-building-cog-outline
        .admin-header-title
          .headline.primary--text.animated.fadeInLeft {{ isEdit ? 'Editar Empresa' : 'Nova Empresa' }}
          .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{ company.name || 'Cadastro de cliente' }}
        v-spacer
        v-btn.ml-3.animated.fadeInDown(color='grey', icon, outlined, to='/')
          v-icon mdi-arrow-left
        v-btn.ml-3.animated.fadeInDown(v-if='canManage', color='primary', large, depressed, @click='saveCompany', :loading='loading')
          v-icon(left) mdi-check
          span Salvar Cliente

      v-stepper.mt-3.animated.fadeInUp(v-model='step')
        v-stepper-header
          v-stepper-step(:complete='step > 1', step='1') Dados da Empresa
          v-divider
          v-stepper-step(:complete='step > 2', step='2') Produto & Permissões

        v-stepper-items
          //- STEP 1: DADOS BÁSICOS
          v-stepper-content(step='1')
            v-card(flat)
              v-card-text.pa-4
                v-layout(row, wrap)
                  v-flex(xs12, md6)
                    v-text-field(v-model='company.name', label='Nome da Empresa', outlined, prepend-icon='mdi-domain')
                    v-layout(row, wrap)
                      v-flex(xs12, md6)
                        v-autocomplete(
                          v-model='company.csId'
                          :items='staffCS'
                          item-text='name'
                          item-value='id'
                          label='CS Responsável'
                          outlined
                          clearable
                          prepend-icon='mdi-account-tie'
                        )
                      v-flex(xs12, md6)
                        v-autocomplete(
                          v-model='company.implantadorId'
                          :items='staffImplantador'
                          item-text='name'
                          item-value='id'
                          label='Implantador'
                          outlined
                          clearable
                          prepend-icon='mdi-account-wrench'
                        )
                  v-flex(xs12, md6)
                    v-card(outlined)
                      v-toolbar(flat, dense, :color='$vuetify.theme.dark ? "grey darken-3" : "grey lighten-4"')
                        v-icon(left) mdi-account-star
                        v-toolbar-title.subtitle-1 Focal da Empresa
                      v-card-text
                        v-text-field(v-model='company.focalName', label='Nome do Focal', dense, outlined)
                        v-text-field(v-model='company.focalEmail', label='Email do Focal', dense, outlined)
                        v-text-field(v-model='company.focalPhone', label='Telefone do Focal', dense, outlined)

              v-card-actions.pa-4
                v-spacer
                v-btn(color='primary', depressed, size='large', @click='step = 2', :disabled='!company.name')
                  span Próximo: Permissões
                  v-icon(right) mdi-chevron-right

          //- STEP 2: PRODUTO & PERMISSÕES
          v-stepper-content(step='2')
            v-card(flat)
              v-card-text.pa-4
                v-select(
                  v-model='selectedProductId'
                  :items='products'
                  item-text='name'
                  item-value='id'
                  label='Selecione o Produto TBDC para carregar módulos'
                  outlined
                  @change='loadProductModules'
                  prepend-icon='mdi-package-variant'
                )

                v-card(outlined, v-if='permissions.length > 0')
                  v-data-table(
                    :headers='permHeaders'
                    :items='permissions'
                    hide-default-footer
                    disable-pagination
                  )
                    template(v-slot:item.ruleName='{ item }')
                      v-text-field(v-model='item.ruleName', dense, hide-details, flat, solo)
                    template(v-slot:item.level='{ item }')
                      v-select(
                        v-model='item.level'
                        :items='levels'
                        dense
                        hide-details
                        solo
                        flat
                        style='width: 250px'
                      )
                        template(v-slot:selection='{ item: lvl }')
                          v-icon(small, :color='lvl.color', class='mr-1') mdi-circle
                          span.caption {{ lvl.text }}
                        template(v-slot:item='{ item: lvl }')
                          v-icon(small, :color='lvl.color', class='mr-1') mdi-circle
                          span {{ lvl.text }}
                    template(v-slot:item.description='{ item }')
                      v-text-field(v-model='item.description', dense, hide-details, flat, solo, placeholder='Observações...')
                    template(v-slot:item.isActive='{ item }')
                      v-switch(v-model='item.isActive', dense, hide-details, color='success')
                    template(v-slot:item.actions='{ index }')
                      v-btn(icon, small, color='red', @click='removePerm(index)')
                        v-icon(small) mdi-delete

                v-btn(v-if='selectedProductId', color='primary', text, class='mt-3', @click='addPermRow')
                  v-icon(left) mdi-plus-circle-outline
                  span Adicionar Outra Regra

              v-card-actions.pa-4
                v-btn(text, @click='step = 1')
                  v-icon(left) mdi-chevron-left
                  span Voltar
                v-spacer
                v-btn(v-if='canManage', color='primary', depressed, large, @click='saveCompany', :loading='loading')
                  v-icon(left) mdi-content-save
                  span Finalizar e Salvar Cliente

</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

export default {
  data() {
    return {
      step: 1,
      loading: false,
      isEdit: false,
      company: {
        id: null,
        name: '',
        csId: null,
        implantadorId: null,
        focalName: '',
        focalEmail: '',
        focalPhone: '',
        isActive: true
      },
      staff: [],
      products: [],
      selectedProductId: null,
      permissions: [],
      permHeaders: [
        { text: 'Regra / Módulo', value: 'ruleName', sortable: false },
        { text: 'Permissão (Nível)', value: 'level', width: 260, sortable: false },
        { text: 'Observação / Descrição', value: 'description', sortable: false },
        { text: 'Vigente', value: 'isActive', width: 90, sortable: false },
        { text: '', value: 'actions', sortable: false, width: 40 }
      ],
      levels: [],
      fallbackLevels: [
        { text: 'Suporte tem permissão', value: 'GREEN', color: '#4CAF50' },
        { text: 'Sim, autorizado pelo focal', value: 'BLUE', color: '#18563B' },
        { text: 'Somente CS tem permissão', value: 'PURPLE', color: '#8E24AA' },
        { text: 'Após consulta com CS', value: 'YELLOW', color: '#7A980F' },
        { text: 'Regra sobre parâmetro', value: 'ORANGE', color: '#9BC113' },
        { text: 'Não permitido', value: 'RED', color: '#F44336' },
        { text: 'Não utiliza', value: 'BLACK', color: '#000000' }
      ]
    }
  },
  computed: {
    canManage() {
      return _.includes(_.get(this.$store, 'state.user.permissions', []), 'manage:system')
    },
    staffCS() { return _.filter(this.staff, { role: 'CS' }) },
    staffImplantador() { return _.filter(this.staff, { role: 'IMPLANTADOR' }) }
  },
  async created() {
    if (!this.canManage) {
      this.$store.commit('showNotification', {
        message: 'Você não tem permissão para editar clientes.',
        style: 'warning'
      })
      this.$router.push('/')
      return
    }
    if (this.$route.params.id) {
      this.isEdit = true
      await this.loadCompany(this.$route.params.id)
    }
    await this.loadPermissionLevels()
  },
  methods: {
    async loadPermissionLevels() {
      try {
        const resp = await this.$apollo.query({
          query: gql`query { tbdc { permissionLevels { id code label description color order isActive } } }`,
          fetchPolicy: 'network-only'
        })
        const rows = _.orderBy((_.get(resp, 'data.tbdc.permissionLevels', []) || []).filter(x => x.isActive), ['order', 'label'], ['asc', 'asc'])
        this.levels = rows.map(x => ({
          text: x.label,
          value: x.code,
          color: x.color
        }))
      } catch (err) {
        this.levels = this.fallbackLevels
      }
      if (!this.levels || this.levels.length < 1) {
        this.levels = this.fallbackLevels
      }
    },
    async loadCompany(id) {
      this.loading = true
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query($id: Int!) {
              tbdc {
                company(id: $id) {
                  id name focalName focalEmail focalPhone csId implantadorId isActive
                  permissions { id moduleId ruleName level description isActive }
                }
              }
            }
          `,
          variables: { id: parseInt(id) },
          fetchPolicy: 'network-only'
        })
        const data = resp.data.tbdc.company
        this.company = _.omit(data, ['permissions', '__typename'])
        this.permissions = _.map(data.permissions, p => ({ ...p, __typename: undefined }))
      } catch (err) { this.$store.commit('pushGraphError', err) }
      this.loading = false
    },
    loadProductModules(productId) {
      const product = _.find(this.products, { id: productId })
      if (product && product.modules) {
        product.modules.forEach(mod => {
          if (!_.some(this.permissions, { moduleId: mod.id })) {
            this.permissions.push({
              moduleId: mod.id,
              ruleName: mod.name,
              level: 'RED',
              description: '',
              isActive: true
            })
          }
        })
      }
    },
    addPermRow() {
      const product = _.find(this.products, { id: this.selectedProductId })
      const firstAvailableModule = _.find(_.get(product, 'modules', []), mod => !_.some(this.permissions, { moduleId: mod.id }))
      const fallbackModule = _.get(product, 'modules[0]', null)
      const chosenModule = firstAvailableModule || fallbackModule
      if (!chosenModule) {
        this.$store.commit('showNotification', {
          message: 'Selecione um produto com módulos disponíveis antes de adicionar regra.',
          style: 'warning'
        })
        return
      }
      this.permissions.push({
        moduleId: chosenModule.id,
        ruleName: chosenModule.name || 'Nova Regra',
        level: 'RED',
        description: '',
        isActive: true
      })
    },
    removePerm(index) {
      this.permissions.splice(index, 1)
    },
    async saveCompany() {
      if (!this.company.name) {
        this.$store.commit('showNotification', { message: 'Por favor, informe o nome da empresa.', style: 'red' })
        this.step = 1
        return
      }
      this.loading = true
      try {
        const variables = {
          ..._.omit(this.company, ['id']),
          csId: this.company.csId ? parseInt(this.company.csId) : null,
          implantadorId: this.company.implantadorId ? parseInt(this.company.implantadorId) : null,
          permissions: _.map(this.permissions, p => ({
            moduleId: parseInt(p.moduleId),
            ruleName: p.ruleName,
            level: p.level,
            description: p.description,
            isActive: !!p.isActive
          })).filter(p => Number.isInteger(p.moduleId) && p.moduleId > 0)
        }

        if (this.company.id) {
          variables.id = parseInt(this.company.id)
        }

        await this.$apollo.mutate({
          mutation: gql`
            mutation($id: Int, $name: String!, $focalName: String, $focalEmail: String, $focalPhone: String, $csId: Int, $implantadorId: Int, $isActive: Boolean, $permissions: [TBDCPermissionInput]) {
              tbdc {
                saveCompany(id: $id, name: $name, focalName: $focalName, focalEmail: $focalEmail, focalPhone: $focalPhone, csId: $csId, implantadorId: $implantadorId, isActive: $isActive, permissions: $permissions) {
                  id
                }
              }
            }
          `,
          variables
        })
        this.$store.commit('showNotification', { message: 'Cliente salvo com sucesso!', style: 'success' })
        this.$router.push('/')
      } catch (err) { this.$store.commit('pushGraphError', err) }
      this.loading = false
    }
  },
  apollo: {
    staff: {
      query: gql`query { tbdc { staff { id name role } } }`,
      update: data => data.tbdc.staff
    },
    products: {
      query: gql`query { tbdc { products { id name modules { id name } } } }`,
      update: data => data.tbdc.products
    }
  }
}
</script>
