<template lang='pug'>
v-container(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        v-icon.animated.fadeInUp(size='80', color='primary') mdi-domain
        .admin-header-title
          .headline.primary--text.animated.fadeInLeft Detalhes da Empresa
          .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{ company.name || 'Empresa' }}
        v-spacer
        v-menu(offset-y)
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeInDown.wait-p1s.mr-2(color='primary', outlined, v-on='on')
              v-icon(left) mdi-export-variant
              span Exportar
          v-list
            v-list-item(@click='exportCompany("pdf")')
              v-list-item-avatar(size='24', tile): v-icon(color='red darken-2') mdi-file-pdf-box
              v-list-item-title PDF
            v-list-item(@click='exportCompany("csv")')
              v-list-item-avatar(size='24', tile): v-icon(color='green darken-2') mdi-file-delimited
              v-list-item-title CSV
            v-list-item(@click='exportCompany("pptx")')
              v-list-item-avatar(size='24', tile): v-icon(color='orange darken-2') mdi-file-powerpoint
              v-list-item-title PPTX
        v-btn.animated.fadeInDown.wait-p2s.mr-3(outlined, color='grey', @click='$router.push("/")')
          v-icon(left) mdi-arrow-left
          span Voltar
        v-btn.animated.fadeInDown(color='primary', @click='$router.push("/" + company.id)')
          v-icon(left) mdi-pencil
          span Editar

    v-flex(xs12, md4)
      v-card.animated.fadeInUp.wait-p1s
        v-card-title Dados Cadastrais
        v-divider
        v-list(dense)
          v-list-item
            v-list-item-content
              v-list-item-title Empresa
              v-list-item-subtitle {{ company.name || '-' }}
          v-list-item
            v-list-item-content
              v-list-item-title CS Responsável
              v-list-item-subtitle {{ company.cs ? company.cs.name : '-' }}
          v-list-item
            v-list-item-content
              v-list-item-title Implantador
              v-list-item-subtitle {{ company.implantador ? company.implantador.name : '-' }}
          v-list-item
            v-list-item-content
              v-list-item-title Focal
              v-list-item-subtitle {{ company.focalName || '-' }}
          v-list-item
            v-list-item-content
              v-list-item-title E-mail do Focal
              v-list-item-subtitle {{ company.focalEmail || '-' }}
          v-list-item
            v-list-item-content
              v-list-item-title Telefone do Focal
              v-list-item-subtitle {{ company.focalPhone || '-' }}
          v-list-item
            v-list-item-content
              v-list-item-title Status
              v-list-item-subtitle
                v-chip(x-small, :color='company.isActive ? "green" : "red"', dark) {{ company.isActive ? 'Ativo' : 'Inativo' }}
          v-list-item
            v-list-item-content
              v-list-item-title Criado em
              v-list-item-subtitle {{ formatDate(company.createdAt) }}
          v-list-item
            v-list-item-content
              v-list-item-title Atualizado em
              v-list-item-subtitle {{ formatDate(company.updatedAt) }}

    v-flex(xs12, md8)
      v-card.animated.fadeInUp.wait-p2s
        v-card-title Permissões da Empresa
        v-card-subtitle Todas as permissões cadastradas foram agrupadas por produto.
        v-divider
        v-card-text(v-if='groupedPermissions.length < 1')
          .grey--text Nenhuma permissão cadastrada para esta empresa.
        v-expansion-panels(v-else, flat, accordion)
          v-expansion-panel(v-for='group in groupedPermissions', :key='group.productName')
            v-expansion-panel-header
              .d-flex.align-center.justify-space-between.w-100
                .subtitle-1.font-weight-bold {{ group.productName }}
                v-chip(x-small, outlined) {{ group.items.length }} regra(s)
            v-expansion-panel-content
              v-data-table(
                :headers='permHeaders'
                :items='group.items'
                dense
                hide-default-footer
                class='details-perm-table'
              )
                template(v-slot:item.level='{ item }')
                  v-chip(small, :color='getLevelColor(item.level)', dark)
                    v-icon(left, x-small) mdi-circle
                    span {{ getLevelLabel(item.level) }}
                template(v-slot:item.isActive='{ item }')
                  v-chip(x-small, :color='item.isActive ? "green" : "red"', dark) {{ item.isActive ? 'SIM' : 'NÃO' }}
                template(v-slot:item.updatedAt='{ item }')
                  span {{ formatDate(item.updatedAt) }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

export default {
  data () {
    return {
      loading: false,
      company: {
        id: null,
        name: '',
        focalName: '',
        focalEmail: '',
        focalPhone: '',
        cs: null,
        implantador: null,
        isActive: true,
        createdAt: null,
        updatedAt: null
      },
      permissionLevels: [],
      permHeaders: [
        { text: 'Módulo', value: 'module.name' },
        { text: 'Regra', value: 'ruleName' },
        { text: 'Permissão', value: 'level', width: 220 },
        { text: 'Descrição', value: 'description' },
        { text: 'Em Vigor', value: 'isActive', width: 90 },
        { text: 'Atualizado em', value: 'updatedAt', width: 170 }
      ]
    }
  },
  computed: {
    levelsMap () {
      return _.keyBy(this.permissionLevels || [], 'code')
    },
    groupedPermissions () {
      const permissions = _.get(this.company, 'permissions', [])
      const groups = _.groupBy(permissions, p => _.get(p, 'module.product.name', 'Sem produto'))
      return _.orderBy(
        _.map(groups, (items, productName) => ({
          productName,
          items: _.orderBy(items, ['module.name', 'ruleName'], ['asc', 'asc'])
        })),
        ['productName'],
        ['asc']
      )
    }
  },
  watch: {
    '$route.params.id': {
      immediate: false,
      handler () {
        this.refresh()
      }
    }
  },
  async created () {
    await this.refresh()
  },
  methods: {
    async refresh () {
      const id = parseInt(this.$route.params.id)
      if (!id) {
        this.$router.push('/')
        return
      }
      this.loading = true
      try {
        const [companyResp, levelsResp] = await Promise.all([
          this.$apollo.query({
            query: gql`
              query ($id: Int!) {
                tbdc {
                  company(id: $id) {
                    id
                    name
                    focalName
                    focalEmail
                    focalPhone
                    isActive
                    createdAt
                    updatedAt
                    cs { id name }
                    implantador { id name }
                    permissions {
                      id
                      moduleId
                      ruleName
                      level
                      description
                      isActive
                      updatedAt
                      module {
                        id
                        name
                        product { id name }
                      }
                    }
                  }
                }
              }
            `,
            variables: { id },
            fetchPolicy: 'network-only'
          }),
          this.$apollo.query({
            query: gql`query { tbdc { permissionLevels { code label description color isActive order } } }`,
            fetchPolicy: 'network-only'
          })
        ])
        this.company = _.get(companyResp, 'data.tbdc.company', this.company)
        this.permissionLevels = _.orderBy(
          (_.get(levelsResp, 'data.tbdc.permissionLevels', []) || []).filter(x => x.isActive),
          ['order', 'label'],
          ['asc', 'asc']
        )
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.loading = false
    },
    getLevelLabel (level) {
      return _.get(this.levelsMap, [level, 'label'], level)
    },
    getLevelColor (level) {
      return _.get(this.levelsMap, [level, 'color'], '#607D8B')
    },
    exportCompany (format) {
      const id = _.toSafeInteger(this.$route.params.id)
      if (id < 1) {
        return
      }
      window.location.assign(`/x-company/${format}/${id}`)
    },
    formatDate (value) {
      if (!value) return '-'
      const dt = new Date(value)
      if (isNaN(dt.getTime())) return value
      return dt.toLocaleString('pt-BR')
    }
  }
}
</script>

<style lang='scss'>
.details-perm-table .v-data-table__wrapper {
  overflow-x: auto;
}
</style>
