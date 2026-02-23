<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-new-post.svg', alt='Notifications', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft Notificações de Artigos
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s Configure canais para novos artigos e atualizações.
          v-spacer
          v-btn.animated.fadeInDown(color='success', depressed, @click='save', large)
            v-icon(left) mdi-check
            span Salvar

      v-flex(lg7, xs12)
        v-card.animated.fadeInUp
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title.subtitle-1 Configuração Global
          .pa-4
            v-switch(
              v-model='config.isEnabled'
              color='primary'
              inset
              label='Habilitar notificações de artigos'
              )
            v-switch(
              v-model='config.eventPageCreated'
              color='primary'
              inset
              :disabled='!config.isEnabled'
              label='Notificar quando um artigo for criado'
              )
            v-switch(
              v-model='config.eventPageUpdated'
              color='primary'
              inset
              :disabled='!config.isEnabled'
              label='Notificar quando um artigo for atualizado'
              )
            v-divider.my-3
            .subtitle-2.mb-1 Canais
            v-switch(
              v-model='config.channelInApp'
              color='primary'
              inset
              :disabled='!config.isEnabled'
              label='Sininho interno da Wiki'
              )
            v-switch(
              v-model='config.channelEmail'
              color='primary'
              inset
              :disabled='!config.isEnabled'
              label='Email (SMTP da Wiki)'
              )
            v-switch(
              v-model='config.channelDiscord'
              color='primary'
              inset
              :disabled='!config.isEnabled'
              label='Discord (Webhook)'
              )
            v-text-field.mt-2(
              outlined
              v-model='config.discordWebhookUrl'
              label='Discord Webhook URL'
              prepend-icon='mdi-discord'
              :disabled='!config.isEnabled || !config.channelDiscord'
              )
            .caption.grey--text
              | Para evitar notificações repetidas, o sistema deduplica por evento único de página (tipo + versão da página).

      v-flex(lg5, xs12)
        v-card.animated.fadeInUp.wait-p1s
          v-toolbar(color='teal', dark, dense, flat)
            v-toolbar-title.subtitle-1 Testes
          .pa-4
            v-text-field(
              outlined
              v-model='testEmail'
              label='Email para teste'
              prepend-icon='mdi-email-outline'
              :disabled='testEmailLoading'
              )
            v-btn(color='teal', dark, @click='sendEmailTest', :loading='testEmailLoading')
              v-icon(left) mdi-send
              span Enviar teste de email
            v-divider.my-4
            v-text-field(
              outlined
              v-model='testDiscordMessage'
              label='Mensagem de teste (Discord)'
              prepend-icon='mdi-message-text-outline'
              :disabled='testDiscordLoading'
              )
            v-btn(color='indigo', dark, @click='sendDiscordTest', :loading='testDiscordLoading')
              v-icon(left) mdi-discord
              span Enviar teste no Discord
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

export default {
  data () {
    return {
      config: {
        isEnabled: false,
        channelInApp: true,
        channelEmail: false,
        channelDiscord: false,
        eventPageCreated: true,
        eventPageUpdated: true,
        discordWebhookUrl: ''
      },
      testEmail: '',
      testDiscordMessage: 'Teste de notificação de artigos'
    }
  },
  computed: {
    testEmailLoading () {
      return this.$store.get('isLoading')
    },
    testDiscordLoading () {
      return this.$store.get('isLoading')
    }
  },
  methods: {
    async save () {
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $isEnabled: Boolean!
              $channelInApp: Boolean!
              $channelEmail: Boolean!
              $channelDiscord: Boolean!
              $eventPageCreated: Boolean!
              $eventPageUpdated: Boolean!
              $discordWebhookUrl: String
            ) {
              pageNotifications {
                updateConfig(
                  isEnabled: $isEnabled
                  channelInApp: $channelInApp
                  channelEmail: $channelEmail
                  channelDiscord: $channelDiscord
                  eventPageCreated: $eventPageCreated
                  eventPageUpdated: $eventPageUpdated
                  discordWebhookUrl: $discordWebhookUrl
                ) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: {
            isEnabled: this.config.isEnabled,
            channelInApp: this.config.channelInApp,
            channelEmail: this.config.channelEmail,
            channelDiscord: this.config.channelDiscord,
            eventPageCreated: this.config.eventPageCreated,
            eventPageUpdated: this.config.eventPageUpdated,
            discordWebhookUrl: this.config.discordWebhookUrl || ''
          }
        })
        if (!_.get(resp, 'data.pageNotifications.updateConfig.responseResult.succeeded', false)) {
          throw new Error(_.get(resp, 'data.pageNotifications.updateConfig.responseResult.message', 'Falha ao salvar.'))
        }
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Configurações de notificação salvas.',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async sendEmailTest () {
      try {
        this.$store.commit('loadingStart', 'admin-notif-email-test')
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($recipientEmail: String!) {
              pageNotifications {
                sendEmailTest(recipientEmail: $recipientEmail) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: {
            recipientEmail: this.testEmail
          }
        })
        if (!_.get(resp, 'data.pageNotifications.sendEmailTest.responseResult.succeeded', false)) {
          throw new Error(_.get(resp, 'data.pageNotifications.sendEmailTest.responseResult.message', 'Falha no envio de teste.'))
        }
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Email de teste enviado.',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      } finally {
        this.$store.commit('loadingStop', 'admin-notif-email-test')
      }
    },
    async sendDiscordTest () {
      try {
        this.$store.commit('loadingStart', 'admin-notif-discord-test')
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($message: String) {
              pageNotifications {
                sendDiscordTest(message: $message) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: {
            message: this.testDiscordMessage
          }
        })
        if (!_.get(resp, 'data.pageNotifications.sendDiscordTest.responseResult.succeeded', false)) {
          throw new Error(_.get(resp, 'data.pageNotifications.sendDiscordTest.responseResult.message', 'Falha no envio de teste.'))
        }
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Teste enviado para Discord.',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      } finally {
        this.$store.commit('loadingStop', 'admin-notif-discord-test')
      }
    }
  },
  apollo: {
    config: {
      query: gql`
        {
          pageNotifications {
            config {
              isEnabled
              channelInApp
              channelEmail
              channelDiscord
              eventPageCreated
              eventPageUpdated
              discordWebhookUrl
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: data => _.cloneDeep(data.pageNotifications.config),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-notifications-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
</style>
