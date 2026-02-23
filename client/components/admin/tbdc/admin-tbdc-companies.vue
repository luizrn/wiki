<template lang='pug'>
v-container(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        v-icon.animated.fadeInUp(size='80', color='primary') mdi-shield-account-outline
        .admin-header-title
          .headline.blue--text.text--darken-2.animated.fadeInLeft Consultar Permissões TBDC
          .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Pesquise o que cada empresa pode ou não fazer
        v-spacer
        v-btn.animated.fadeInDown.wait-p2s.mr-3(outlined, color='grey', icon, @click='refresh')
          v-icon mdi-refresh
        v-btn.animated.fadeInDown(color='primary', large, depressed, to='/tbdc-companies/new')
          v-icon(left) mdi-plus
          span Novo Cliente

      v-card.mt-3.animated.fadeInUp
        //- Search Filters
        v-card-text(:class='$vuetify.theme.dark ? `grey darken-3-d5` : `grey lighten-4`')
          v-layout(row, wrap)
            v-flex(xs12, md3)
              v-text-field(v-model='search' label='Busca rápida (Empresa, Regra...)' solo flat hide-details prepend-inner-icon='mdi-magnify' dense clearable)
            v-flex(xs12, md2)
              v-select(v-model='filterStaff' :items='staff' item-text='name' item-value='id' label='CS / Implantador' solo flat hide-details dense clearable)
            v-flex(xs12, md2)
              v-select(v-model='filterProduct' :items='products' item-text='name' item-value='id' label='Produto' solo flat hide-details dense clearable)
            v-flex(xs12, md2)
              v-select(v-model='filterModule' :items='modules' item-text='name' item-value='id' label='Módulo' solo flat hide-details dense clearable)
            v-flex(xs12, md3, class='text-right')
              v-btn(color='primary', depressed, to='/tbdc-master', text)
                v-icon(left) mdi-cog-outline
                span Dados Mestres

        v-divider
        //- Results List
        v-data-table(
          :items='rulesFiltered'
          :headers='headers'
          :search='search'
          :loading='loading'
          :items-per-page='itemsPerPage'
          @page-count='pageCount = $event'
          hide-default-footer
          class='tbdc-rules-table'
        )
          template(v-slot:item.company='{ item }')
            .d-flex.flex-column
              strong.blue-grey--text.text--darken-3(:class='$vuetify.theme.dark ? "text--lighten-2" : ""') {{ item.company.name || 'Empresa Independente' }}
              .caption.grey--text CS: {{ item.company.cs ? item.company.cs.name : 'N/A' }}

          template(v-slot:item.level='{ item }')
            v-tooltip(top)
              template(v-slot:activator='{ on }')
                v-chip(v-on='on' small :color='getLevelColor(item.level)' dark)
                  v-icon(left small) mdi-circle
                  span.font-weight-bold {{ getLevelShort(item.level) }}
              span {{ getLevelFull(item.level) }}

          template(v-slot:item.isActive='{ item }')
            v-chip(v-if='item.isActive' x-small color='green' dark) SIM
            v-chip(v-else x-small color='red' dark) NÃO

          template(v-slot:item.actions='{ item }')
            v-tooltip(top)
              template(v-slot:activator='{ on }')
                v-btn(v-on='on' icon small color='primary' @click='$router.push("/tbdc-companies/" + item.company.id)')
                  v-icon(small) mdi-pencil
              span Editar Cliente

            v-tooltip(top)
              template(v-slot:activator='{ on }')
                v-btn(v-on='on' icon small color='red' @click='deleteCompany(item.company)')
                  v-icon(small) mdi-delete
              span Excluir Cliente

        v-card-chin(v-if='pageCount > 1')
          v-spacer
          v-pagination(v-model='pagination' :length='pageCount' total-visible='7')
          v-spacer
          v-select(:items='[15, 30, 50, 100]' v-model='itemsPerPage' label='Itens por página' dense hide-details style='max-width: 150px' flat solo)

</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

export default {
  data() {
    return {
      search: '',
      filterStaff: null,
      filterProduct: null,
      filterModule: null,
      pagination: 1,
      pageCount: 0,
      itemsPerPage: 15,
      loading: false,
      companies: [],
      staff: [],
      products: [],
      headers: [
        { text: 'Empresa', value: 'company' },
        { text: 'Produto', value: 'module.product.name' },
        { text: 'Módulo / Regra', value: 'ruleName' },
        { text: 'Permissão', value: 'level', width: 140 },
        { text: 'Descrição', value: 'description' },
        { text: 'Em Vigor', value: 'isActive', width: 100 },
        { text: '', value: 'actions', sortable: false, width: 100 }
      ],
      levels: {
        GREEN: { short: 'LIVRE', color: 'green', full: 'Suporte tem permissão' },
        BLUE: { short: 'AUTORIZADO', color: 'blue', full: 'Sim, mas com autorização do focal' },
        PURPLE: { short: 'SOMENTE CS', color: 'purple', full: 'Somente o CS tem permissão' },
        YELLOW: { short: 'CONSULTAR CS', color: 'yellow darken-3', full: 'Somente após consulta com CS' },
        ORANGE: { short: 'DEPENDE', color: 'orange darken-3', full: 'Com alguma regra sobre algum parâmetro' },
        RED: { short: 'PROIBIDO', color: 'red', full: 'Não permitido ou não informado' },
        BLACK: { short: 'NÃO UTILIZA', color: 'black', full: 'Não utiliza este produto' }
      }
    }
  },
  computed: {
    modules() {
      if (this.filterProduct) {
        const prod = _.find(this.products, { id: this.filterProduct })
        return prod ? prod.modules : []
      }
      return _.flatMap(this.products, 'modules')
    },
    rulesFiltered() {
      let rules = _.flatMap(this.companies, c => _.map(c.permissions, p => ({ ...p, company: c })))

      if (this.filterStaff) {
        rules = _.filter(rules, r => r.company.csId === this.filterStaff || r.company.implantadorId === this.filterStaff)
      }
      if (this.filterProduct) {
        rules = _.filter(rules, r => r.module && r.module.product && r.module.product.id === this.filterProduct)
      }
      if (this.filterModule) {
        rules = _.filter(rules, r => r.moduleId === this.filterModule)
      }

      return rules
    }
  },
  methods: {
    async refresh() {
      this.loading = true
      await this.$apollo.queries.companies.refetch()
      this.loading = false
    },
    getLevelColor(l) { return (this.levels[l] || {}).color || 'grey' },
    getLevelShort(l) { return (this.levels[l] || {}).short || l },
    getLevelFull(l) { return (this.levels[l] || {}).full || l },
    async deleteCompany(company) {
      if (confirm(`Excluir o cliente ${company.name} e todas as suas regras definitivamete?`)) {
        try {
          await this.$apollo.mutate({
            mutation: gql`mutation($id: Int!) { tbdc { deleteCompany(id: $id) } }`,
            variables: { id: company.id }
          })
          await this.refresh()
          this.$store.commit('showNotification', { message: 'Empresa excluída.', style: 'success' })
        } catch (err) { this.$store.commit('pushGraphError', err) }
      }
    }
  },
  apollo: {
    companies: {
      query: gql`
        query {
          tbdc {
            companies {
              id name csId implantadorId
              cs { id name }
              implantador { id name }
              permissions {
                id ruleName level description isActive updatedAt moduleId
                module { id name product { id name } }
              }
            }
          }
        }
      `,
      update: data => data.tbdc.companies,
      watchLoading(l) { this.loading = l }
    },
    staff: {
      query: gql`query { tbdc { staff { id name } } }`,
      update: data => data.tbdc.staff
    },
    products: {
      query: gql`query { tbdc { products { id name modules { id name } } } }`,
      update: data => data.tbdc.products
    }
  }
}
</script>

<style lang='scss'>
.tbdc-rules-table {
  .v-data-table__wrapper {
    overflow-x: auto;
  }
}
</style>
