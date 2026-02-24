<template lang='pug'>
  v-container.admin-movidesk(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          v-icon.animated.fadeInUp(size='48', color='primary', style='margin-right: 16px;') mdi-headset
          .admin-header-title(style='margin-left: 0;')
            .headline.primary--text.animated.fadeInLeft Suporte Movidesk
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Central de Atendimento TBDC

    v-layout(row wrap, mt-5)
      v-flex(xs12, md8, offset-md2)
        v-card.pa-5.text-center.animated.fadeInUp.wait-p2s(elevation='2')
          v-avatar(size='80', color='primary lighten-4').mb-4
            v-icon(size='40', color='primary') mdi-lifebuoy

          h2.headline.mb-2 Olá, {{ userName }}!
          p.body-1.grey--text.text--darken-1
            | Precisa de ajuda com o sistema ou tem alguma dúvida?
            br
            | Nosso suporte técnico via Movidesk está pronto para ajudar.

          v-divider.my-4

          .d-flex.align-center.justify-center.flex-column
            p.body-2.grey--text
              | Você será autenticado automaticamente com seu e-mail corporativo:
              br
              strong.primary--text {{ userEmail }}

            v-btn.mt-4(
              color='primary'
              large
              depressed
              :loading='scriptLoading'
              @click='startMovideskChat'
              style='min-width: 250px;'
            )
              v-icon(left) mdi-chat
              span Iniciar Chat de Suporte

            v-alert.mt-5(
              v-if='scriptLoaded'
              type='success'
              text
              dense
              border='left'
            )
              | Conectado ao Movidesk. O widget de chat deve aparecer no canto inferior da tela.

</template>

<script>
export default {
  data() {
    return {
      scriptLoading: false,
      scriptLoaded: false
    }
  },
  computed: {
    userName() {
      return this.$store.state.user.name || 'Colaborador'
    },
    userEmail() {
      return this.$store.state.user.email || ''
    }
  },
  mounted() {
    // Preload the widget script silently
    this.loadMovideskScript()
  },
  methods: {
    loadMovideskScript() {
      if (window.mdChatClient) {
        this.scriptLoaded = true
        return
      }

      this.scriptLoading = true
      // Configurar o ID do Cliente Movidesk
      window.mdChatClient = "79498363D817478581FAE5265F29E5B8"

      const script = document.createElement('script')
      script.src = "https://chat.movidesk.com/Scripts/chat-widget.min.js"
      script.async = true
      script.onload = () => {
        this.scriptLoading = false
        this.scriptLoaded = true
        // Opcional: já fazer o login silenciosamente
        this.authenticateMovidesk()
      }
      script.onerror = () => {
        this.scriptLoading = false
        this.$store.commit('showNotification', {
          message: 'Falha ao carregar o chat do Movidesk. Verifique sua conexão.',
          style: 'error',
          icon: 'mdi-alert'
        })
      }
      document.body.appendChild(script)
    },
    authenticateMovidesk(startChat = false) {
      if (typeof window.movideskLogin === 'function') {
        window.movideskLogin({
          name: this.userName,
          email: this.userEmail,
          codeReference: "0000",
          organizationCodeReference: "9999",
          stayConnected: false,
          emptySubject: false,
          startChat: startChat
        })
      }
    },
    startMovideskChat() {
      if (!this.scriptLoaded) {
        // Se o script não carregou, tenta carregar e forçar a abertura
        this.loadMovideskScript()
      } else {
        // Se já carregou, autentica forçando a abertura do chat
        this.authenticateMovidesk(true)
      }
    }
  }
}
</script>

<style lang='scss' scoped>
.admin-movidesk {
  .v-card {
    border-radius: 12px;
  }
}
</style>
