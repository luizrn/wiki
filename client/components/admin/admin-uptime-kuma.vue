<template lang='pug'>
v-container(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        img.animated.fadeInUp(src='/_assets/svg/icon-heart-health.svg', alt='Uptime Kuma', style='width: 80px;')
        .admin-header-title
          .headline.primary--text.animated.fadeInLeft Uptime Kuma
          .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Configure a URL base e o slug da Status Page

    v-flex(xs12, md8, lg6)
      v-card.animated.fadeInUp
        v-toolbar(flat, color='primary', dark, dense)
          .subtitle-1 Configuração
        v-card-text
          v-text-field(
            v-model='form.baseUrl'
            label='URL Base'
            hint='Ex.: https://uptime.tbdc.com.br'
            persistent-hint
            outlined
            dense
          )
          v-text-field(
            v-model='form.statusSlug'
            label='Slug da Status Page'
            hint='Ex.: 6455fergthukkiiolrttwqwszc5w55g4jk4kkop8j88hf'
            persistent-hint
            outlined
            dense
          )
          v-text-field(
            :value='statusPageUrl'
            label='URL Final da Status Page'
            readonly
            outlined
            dense
          )
        v-card-actions
          v-spacer
          v-btn(outlined, color='primary', :href='statusPageUrl', target='_blank', rel='noopener') Abrir Status
          v-btn(color='primary', :loading='saving', @click='save') Salvar
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

const QUERY_CONFIG = gql`
  query {
    uptimeKuma {
      config {
        baseUrl
        statusSlug
        statusPageUrl
      }
    }
  }
`

const MUT_SAVE = gql`
  mutation ($baseUrl: String!, $statusSlug: String!) {
    uptimeKuma {
      saveConfig(baseUrl: $baseUrl, statusSlug: $statusSlug) {
        responseResult {
          succeeded
          message
        }
      }
    }
  }
`

export default {
  data () {
    return {
      saving: false,
      form: {
        baseUrl: '',
        statusSlug: ''
      }
    }
  },
  computed: {
    statusPageUrl () {
      const baseUrl = _.trim(this.form.baseUrl || '').replace(/\/+$/, '')
      const slug = _.trim(this.form.statusSlug || '')
      if (!baseUrl || !slug) return ''
      return `${baseUrl}/status/${slug}`
    }
  },
  methods: {
    async load() {
      const resp = await this.$apollo.query({
        query: QUERY_CONFIG,
        fetchPolicy: 'network-only'
      })
      const conf = _.get(resp, 'data.uptimeKuma.config')
      this.form.baseUrl = _.get(conf, 'baseUrl', '')
      this.form.statusSlug = _.get(conf, 'statusSlug', '')
    },
    async save () {
      this.saving = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: MUT_SAVE,
          variables: {
            baseUrl: _.trim(this.form.baseUrl || ''),
            statusSlug: _.trim(this.form.statusSlug || '')
          }
        })
        if (_.get(resp, 'data.uptimeKuma.saveConfig.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: _.get(resp, 'data.uptimeKuma.saveConfig.responseResult.message', 'Configuração salva.'),
            icon: 'mdi-check'
          })
          await this.load()
        } else {
          throw new Error(_.get(resp, 'data.uptimeKuma.saveConfig.responseResult.message', 'Falha ao salvar configuração.'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.saving = false
    }
  },
  mounted () {
    this.load()
  }
}
</script>
