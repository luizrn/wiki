<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').status-page
    nav-header
    v-main(:class='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-5`')
      v-container(fluid, grid-list-lg)
        v-card
          v-toolbar(flat, color='primary', dark)
            v-toolbar-title Status da Plataforma
            v-spacer
            v-btn(outlined, color='white', :href='statusPageUrl', target='_blank', rel='noopener')
              v-icon(left, small) mdi-open-in-new
              span Abrir em nova aba
          v-card-text
            .caption.grey--text.mb-3 Caso o painel não carregue no iframe, use o botão "Abrir em nova aba".
            iframe.status-frame(
              :src='statusPageUrl'
              width='100%'
              height='800'
              loading='lazy'
              referrerpolicy='no-referrer'
              style='border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
            )
          v-divider
          v-card-actions.status-summary-footer
            v-chip(small, dark, :color='summaryColor') {{ summaryLabel }}
            span.caption.ml-2(v-if='statusSummary') Atualizado em {{ formatTime(statusSummary.updatedAt) }}
            span.caption.red--text.ml-2(v-if='statusError') {{ statusError }}
        v-card.mt-4(v-if='canManageSystem')
          v-toolbar(flat, color='primary', dark, dense)
            v-toolbar-title Configuração rápida (Admin)
          v-card-text
            v-layout(row, wrap)
              v-flex(xs12, md6, class='pr-md-2')
                v-text-field(
                  v-model='quickConfig.baseUrl'
                  label='URL Base do Uptime Kuma'
                  hint='Ex.: https://uptime.tbdc.com.br'
                  persistent-hint
                  outlined
                  dense
                )
              v-flex(xs12, md6, class='pl-md-2')
                v-text-field(
                  v-model='quickConfig.statusSlug'
                  label='Slug da Status Page'
                  hint='Identificador da página de status'
                  persistent-hint
                  outlined
                  dense
                )
          v-card-actions
            v-spacer
            v-btn(color='primary', :loading='savingQuickConfig', @click='saveQuickConfig')
              v-icon(left, small) mdi-content-save
              span Salvar configuração
    nav-footer
    notify
    search-results
    chat-widget(v-if='$store.state.user.authenticated')
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

export default {
  data () {
    return {
      statusSummary: null,
      statusError: '',
      refreshTimer: null,
      savingQuickConfig: false,
      quickConfig: {
        baseUrl: '',
        statusSlug: ''
      }
    }
  },
  computed: {
    canManageSystem () {
      return _.includes(_.get(this, '$store.state.user.permissions', []), 'manage:system')
    },
    summaryLabel () {
      if (this.statusSummary && this.statusSummary.overall) {
        return this.statusSummary.overall
      }
      return 'Carregando status...'
    },
    summaryColor () {
      if (!this.statusSummary) return 'grey'
      const overall = (this.statusSummary.overall || '').toLowerCase()
      if (overall.includes('operational')) return 'green darken-2'
      if (overall.includes('major outage')) return 'red darken-2'
      if (overall.includes('degraded') || overall.includes('maintenance')) return 'orange darken-2'
      return 'blue-grey'
    },
    statusPageUrl () {
      return (this.statusSummary && this.statusSummary.statusPageUrl) || 'https://uptime.tbdc.com.br/status/6455fergthukkiiolrttwqwszc5w55g4jk4kkop8j88hf'
    }
  },
  created () {
    this.$store.commit('page/SET_MODE', 'status')
    this.fetchStatusSummary()
    this.refreshTimer = setInterval(() => {
      this.fetchStatusSummary()
    }, 30000)
  },
  beforeDestroy () {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  },
  methods: {
    async fetchStatusSummary () {
      this.statusError = ''
      try {
        const resp = await fetch('/status/summary', {
          method: 'GET',
          credentials: 'same-origin'
        })
        if (!resp.ok) {
          throw new Error(`Erro ao carregar status (${resp.status})`)
        }
        const data = await resp.json()
        if (!data || !data.ok) {
          throw new Error(data && data.message ? data.message : 'Falha ao consultar status.')
        }
        this.statusSummary = data
        this.quickConfig.baseUrl = data.baseUrl || this.quickConfig.baseUrl
        this.quickConfig.statusSlug = data.statusSlug || this.quickConfig.statusSlug
      } catch (err) {
        this.statusError = err.message || 'Falha ao atualizar status.'
      }
    },
    async saveQuickConfig () {
      this.savingQuickConfig = true
      try {
        const baseUrl = _.trim(this.quickConfig.baseUrl || '')
        const statusSlug = _.trim(this.quickConfig.statusSlug || '')

        const resp = await this.$apollo.mutate({
          mutation: gql`
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
          `,
          variables: {
            baseUrl,
            statusSlug
          }
        })

        if (_.get(resp, 'data.uptimeKuma.saveConfig.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: _.get(resp, 'data.uptimeKuma.saveConfig.responseResult.message', 'Configuração salva.'),
            icon: 'mdi-check'
          })
          await this.fetchStatusSummary()
        } else {
          throw new Error(_.get(resp, 'data.uptimeKuma.saveConfig.responseResult.message', 'Falha ao salvar configuração.'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.savingQuickConfig = false
    },
    formatTime (iso) {
      if (!iso) return '--'
      return new Date(iso).toLocaleTimeString('pt-BR')
    }
  }
}
</script>

<style lang='scss'>
.status-page {
  .status-frame {
    background: #fff;
  }
}
</style>
