<template lang='pug'>
v-container(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        v-icon.animated.fadeInUp(size='80', color='primary') mdi-shield-account-outline
        .admin-header-title
          .headline.primary--text.animated.fadeInLeft Consultar Permissões TBDC
          .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Pesquise o que cada empresa pode ou não fazer
        v-spacer
        v-btn.animated.fadeInDown.wait-p2s.mr-3(outlined, color='grey', icon, @click='refresh')
          v-icon mdi-refresh
        v-btn.animated.fadeInDown(v-if='canManage', color='primary', large, depressed, to='/new')
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
              v-btn(v-if='canManage', color='primary', depressed, href='/a/tbdc-master', text)
                v-icon(left) mdi-cog-outline
                span Dados Mestres

        v-divider
        //- Results List
        v-data-table(
          :items='rulesFilteredSearched'
          :headers='headers'
          :loading='loading'
          :items-per-page='itemsPerPage'
          @page-count='pageCount = $event'
          hide-default-footer
          class='tbdc-rules-table'
        )
          template(v-slot:item.company='{ item }')
            .d-flex.flex-column
              router-link.company-link.font-weight-bold(:to='`/${item.company.id}/details`')
                | {{ item.company.name || 'Empresa Independente' }}
              .caption.grey--text CS: {{ item.company.cs ? item.company.cs.name : 'N/A' }}

          template(v-slot:item.level='{ item }')
            v-tooltip(top)
              template(v-slot:activator='{ on }')
                v-chip(v-on='on' small :color='getLevelColor(item.level)' dark)
                  v-icon(left small) mdi-circle
                  span.font-weight-bold {{ getLevelShort(item.level) }}
              span {{ getLevelFull(item.level) }}

          template(v-slot:item.description='{ item }')
            v-tooltip(top, v-if='item.description')
              template(v-slot:activator='{ on }')
                span.tbdc-description-truncated(v-on='on') {{ truncateDescription(item.description) }}
              span {{ item.description }}
            span.tbdc-description-truncated(v-else) -

          template(v-slot:item.isActive='{ item }')
            v-chip(v-if='item.isActive' x-small color='green' dark) SIM
            v-chip(v-else x-small color='red' dark) NÃO

          template(v-slot:item.actions='{ item }')
            v-tooltip(top)
              template(v-slot:activator='{ on }')
                v-btn(v-on='on' icon small color='teal' @click='$router.push("/" + item.company.id + "/details")')
                  v-icon(small) mdi-eye
              span Ver detalhes
            v-tooltip(top)
              template(v-slot:activator='{ on }')
                v-btn(v-on='on' icon small color='primary' @click='$router.push("/" + item.company.id)')
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
      permissionLevels: []
    }
  },
  computed: {
    canManage() {
      return _.includes(_.get(this.$store, 'state.user.permissions', []), 'manage:system')
    },
    headers() {
      const baseHeaders = [
        { text: 'Empresa', value: 'company' },
        { text: 'Produto', value: 'module.product.name' },
        { text: 'Módulo / Regra', value: 'ruleName' },
        { text: 'Permissão', value: 'level', width: 140 },
        { text: 'Descrição', value: 'description' },
        { text: 'Em Vigor', value: 'isActive', width: 100 },
        { text: '', value: 'actions', sortable: false, width: 120 }
      ]
      return baseHeaders
    },
    levelsMap() {
      return _.keyBy(this.permissionLevels || [], 'code')
    },
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
    },
    rulesFilteredSearched() {
      const term = _.toLower(_.trim(this.search || ''))
      if (!term) {
        return this.rulesFiltered
      }

      return this.rulesFiltered.filter(r => {
        const haystack = [
          _.get(r, 'company.name', ''),
          _.get(r, 'company.cs.name', ''),
          _.get(r, 'company.implantador.name', ''),
          _.get(r, 'module.product.name', ''),
          _.get(r, 'module.name', ''),
          _.get(r, 'ruleName', ''),
          _.get(r, 'description', ''),
          _.get(r, 'level', '')
        ]
          .map(v => _.toLower(String(v || '')))
          .join(' ')

        return haystack.includes(term)
      })
    }
  },
  methods: {
    async refresh() {
      this.loading = true
      await this.$apollo.queries.companies.refetch()
      this.loading = false
    },
    getLevelColor(l) { return _.get(this.levelsMap, [l, 'color'], 'grey') },
    getLevelShort(l) { return (_.get(this.levelsMap, [l, 'label'], l) || l).toUpperCase().slice(0, 20) },
    getLevelFull(l) { return _.get(this.levelsMap, [l, 'description'], _.get(this.levelsMap, [l, 'label'], l)) || l },
    truncateDescription(text) {
      const clean = _.trim(_.toString(text || ''))
      if (clean.length <= 60) {
        return clean
      }
      return `${clean.substring(0, 60)}...`
    },
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
    },
    permissionLevels: {
      query: gql`query { tbdc { permissionLevels { id code label description color order isActive } } }`,
      update: data => _.orderBy((data.tbdc.permissionLevels || []).filter(x => x.isActive), ['order', 'label'], ['asc', 'asc'])
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
.tbdc-description-truncated {
  display: inline-block;
  max-width: 240px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
}
.company-link {
  color: #18563B;
  text-decoration: none;
}
.company-link:hover {
  text-decoration: underline;
}
</style>
