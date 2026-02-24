<template lang='pug'>
v-container.admin-movidesk(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        v-icon.animated.fadeInUp(size='80', color='primary') mdi-lifebuoy
        .admin-header-title
          .headline.primary--text.animated.fadeInLeft Suporte Movidesk
          .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Configuração nativa do widget de suporte
        v-spacer
        v-btn.animated.fadeInRight(color='success', depressed, large, :loading='saving', @click='save')
          v-icon(left) mdi-check
          span Salvar

  v-layout(row, wrap)
    v-flex(xs12, lg7)
      v-card.animated.fadeInUp
        v-toolbar(color='primary', dark, dense, flat)
          v-toolbar-title.subtitle-1 Configuração do Widget
        v-card-text
          v-switch(
            inset
            color='primary'
            v-model='form.movideskEnabled'
            label='Habilitar Suporte Movidesk'
            hint='Controla apenas o widget Movidesk (separado do chat interno).'
            persistent-hint
          )
          v-text-field.mt-3(
            v-model='form.movideskChatKey'
            label='Token do Widget (mdChatClient)'
            outlined
            prepend-icon='mdi-key-variant'
            hint='Ex.: 79498363D817478581FAE5265F29E5B8'
            persistent-hint
          )
          v-layout(row, wrap)
            v-flex(xs12, md6)
              v-text-field(
                v-model='form.movideskCodeReference'
                label='Code Reference'
                outlined
                prepend-icon='mdi-account-key'
                hint='Ex.: código do colaborador'
                persistent-hint
              )
            v-flex(xs12, md6)
              v-text-field(
                v-model='form.movideskOrganizationCodeReference'
                label='Organization Code Reference'
                outlined
                prepend-icon='mdi-domain'
                hint='Ex.: código da organização/empresa'
                persistent-hint
              )
          v-layout(row, wrap)
            v-flex(xs12, md4)
              v-switch(
                inset
                color='primary'
                v-model='form.movideskStayConnected'
                label='Stay Connected'
              )
            v-flex(xs12, md4)
              v-switch(
                inset
                color='primary'
                v-model='form.movideskEmptySubject'
                label='Empty Subject'
              )
            v-flex(xs12, md4)
              v-switch(
                inset
                color='primary'
                v-model='form.movideskStartChat'
                label='Start Chat'
              )
          v-divider.my-4
          v-btn(color='primary', outlined, :loading='testing', @click='testLogin')
            v-icon(left) mdi-play-circle-outline
            span Testar Com Usuário Logado

    v-flex(xs12, lg5)
      v-card.animated.fadeInUp.wait-p1s
        v-toolbar(color='primary', dark, dense, flat)
          v-toolbar-title.subtitle-1 Preview de Autenticação
        v-card-text
          .subtitle-2.mb-2 Dados do usuário atual
          v-list(dense)
            v-list-item
              v-list-item-avatar(size='24', tile): v-icon mdi-account
              v-list-item-content
                v-list-item-title {{ userName || 'Sem nome' }}
            v-list-item
              v-list-item-avatar(size='24', tile): v-icon mdi-email-outline
              v-list-item-content
                v-list-item-title {{ userEmail || 'Sem e-mail' }}
          v-alert.mt-4(type='info', text, dense, border='left')
            O login do Movidesk será feito automaticamente com nome/e-mail do usuário logado na wiki.
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

const QUERY = gql`
  query {
    theming {
      config {
        movideskEnabled
        movideskChatKey
        movideskCodeReference
        movideskOrganizationCodeReference
        movideskStayConnected
        movideskEmptySubject
        movideskStartChat
      }
    }
  }
`

const MUTATION = gql`
  mutation (
    $movideskEnabled: Boolean!
    $movideskChatKey: String!
    $movideskCodeReference: String
    $movideskOrganizationCodeReference: String
    $movideskStayConnected: Boolean
    $movideskEmptySubject: Boolean
    $movideskStartChat: Boolean
  ) {
    theming {
      setMovideskConfig(
        movideskEnabled: $movideskEnabled
        movideskChatKey: $movideskChatKey
        movideskCodeReference: $movideskCodeReference
        movideskOrganizationCodeReference: $movideskOrganizationCodeReference
        movideskStayConnected: $movideskStayConnected
        movideskEmptySubject: $movideskEmptySubject
        movideskStartChat: $movideskStartChat
      ) {
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
      testing: false,
      form: {
        movideskEnabled: false,
        movideskChatKey: '79498363D817478581FAE5265F29E5B8',
        movideskCodeReference: '',
        movideskOrganizationCodeReference: '',
        movideskStayConnected: false,
        movideskEmptySubject: false,
        movideskStartChat: false
      }
    }
  },
  computed: {
    userName () {
      return _.trim(_.get(this.$store.state, 'user.name', ''))
    },
    userEmail () {
      return _.trim(_.get(this.$store.state, 'user.email', ''))
    }
  },
  methods: {
    async ensureScriptLoaded () {
      if (typeof window.movideskLogin === 'function') {
        return
      }
      window.mdChatClient = this.form.movideskChatKey
      await new Promise((resolve, reject) => {
        const existing = document.getElementById('movidesk-chat-widget-script')
        if (existing) {
          const wait = setInterval(() => {
            if (typeof window.movideskLogin === 'function') {
              clearInterval(wait)
              resolve()
            }
          }, 200)
          setTimeout(() => {
            clearInterval(wait)
            reject(new Error('Timeout loading Movidesk script'))
          }, 10000)
          return
        }
        const script = document.createElement('script')
        script.id = 'movidesk-chat-widget-script'
        script.src = 'https://chat.movidesk.com/Scripts/chat-widget.min.js'
        script.async = true
        script.onload = resolve
        script.onerror = () => reject(new Error('Failed to load Movidesk script'))
        document.body.appendChild(script)
      })
    },
    doLogin (startChatOverride = null) {
      if (typeof window.movideskLogin !== 'function') {
        throw new Error('movideskLogin não disponível')
      }
      window.movideskLogin({
        name: this.userName || 'Usuário Wiki',
        email: this.userEmail || '',
        codeReference: this.form.movideskCodeReference || '',
        organizationCodeReference: this.form.movideskOrganizationCodeReference || '',
        stayConnected: !!this.form.movideskStayConnected,
        emptySubject: !!this.form.movideskEmptySubject,
        startChat: _.isBoolean(startChatOverride) ? startChatOverride : !!this.form.movideskStartChat
      })
    },
    async testLogin () {
      this.testing = true
      try {
        if (!this.form.movideskChatKey) {
          throw new Error('Informe o Token do Widget (mdChatClient).')
        }
        await this.ensureScriptLoaded()
        this.doLogin(true)
        this.$store.commit('showNotification', {
          message: 'Teste executado. Widget Movidesk autenticado com usuário logado.',
          style: 'success',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.testing = false
    },
    async save () {
      this.saving = true
      this.$store.commit('loadingStart', 'admin-movidesk-save')
      try {
        const { data } = await this.$apollo.mutate({
          mutation: MUTATION,
          variables: { ...this.form }
        })
        if (!_.get(data, 'theming.setMovideskConfig.responseResult.succeeded', false)) {
          throw new Error(_.get(data, 'theming.setMovideskConfig.responseResult.message', 'Falha ao salvar configurações do Movidesk.'))
        }
        this.$store.commit('showNotification', {
          message: 'Configurações do Movidesk salvas com sucesso.',
          style: 'success',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit('loadingStop', 'admin-movidesk-save')
      this.saving = false
    }
  },
  apollo: {
    config: {
      query: QUERY,
      fetchPolicy: 'network-only',
      update: data => _.get(data, 'theming.config', {}),
      result ({ data }) {
        const cfg = _.get(data, 'theming.config', {})
        this.form = {
          ...this.form,
          ..._.pick(cfg, [
            'movideskEnabled',
            'movideskChatKey',
            'movideskCodeReference',
            'movideskOrganizationCodeReference',
            'movideskStayConnected',
            'movideskEmptySubject',
            'movideskStartChat'
          ])
        }
      }
    }
  }
}
</script>

<style lang='scss' scoped>
.admin-movidesk .v-card {
  border-radius: 10px;
}
</style>
