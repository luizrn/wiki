<template lang='pug'>
v-container(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        img.animated.fadeInUp(src='/_assets/svg/icon-rest-api.svg', alt='Webhooks', style='width: 80px;')
        .admin-header-title
          .headline.primary--text.animated.fadeInLeft Webhooks
          .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s Configure outgoing webhooks for system events.
        v-spacer
        v-btn.animated.fadeInDown(color='success', depressed, @click='save', large, :disabled='!isDirty')
          v-icon(left) check
          span {{$t('common:actions.apply')}}

    v-flex(lg3, xs12)
      v-card.animated.fadeInUp
        v-toolbar(flat, color='primary', dark, dense)
          .subtitle-1 Webhooks
          v-spacer
          v-btn(icon, small, @click='addWebhook')
            v-icon add
        v-list(two-line, dense).py-0
          template(v-for='(str, idx) in webhooks')
            v-list-item(:key='str.id', @click='selectWebhook(str)')
              v-list-item-avatar
                v-icon(:color='str.isEnabled ? "primary" : "grey"') mdi-webhook
              v-list-item-content
                v-list-item-title.body-2(:class='selectedWebhookId === str.id ? "primary--text" : ""') {{ str.title }}
                v-list-item-sub-title.caption {{ str.url }}
              v-list-item-avatar(v-if='selectedWebhookId === str.id')
                v-icon.animated.fadeInLeft(color='primary') arrow_forward_ios
            v-divider(v-if='idx < webhooks.length - 1')

    v-flex(xs12, lg9)
      v-card.wiki-form.animated.fadeInUp.wait-p2s(v-if='selectedWebhookId !== null')
        v-toolbar(color='primary', dense, flat, dark)
          .subtitle-1 {{webhook.title || 'New Webhook'}}
          v-spacer
          v-btn(icon, small, @click='testWebhook', :disabled='!webhook.id')
            v-icon mdi-play
          v-btn(icon, small, @click='deleteWebhook', :disabled='!webhook.id')
            v-icon mdi-delete
        v-card-text
          v-form
            v-text-field(v-model='webhook.title', label='Title', placeholder='My Webhook', required)
            v-text-field(v-model='webhook.description', label='Description', placeholder='Optional description')
            v-text-field(v-model='webhook.url', label='Target URL', placeholder='https://example.com/webhook', required)
            v-text-field(v-model='webhook.secret', label='Secret Key', placeholder='Optional secret for HMAC signature')
            v-switch(v-model='webhook.isEnabled', label='Enabled', color='primary')

            .overline.mt-4 Events to trigger:
            v-layout(row, wrap)
              v-flex(xs12, sm6, md4, v-for='ev in availableEvents', :key='ev')
                v-checkbox(v-model='webhook.events', :label='ev', :value='ev', dense, hide-details)

      v-card.animated.fadeInUp.wait-p2s(v-else)
        v-card-text.text-center.py-5
          v-icon(size='64', color='grey lighten-2') mdi-webhook
          .subtitle-1.grey--text Select a webhook or create a new one.

</template>

<script>
import _ from 'lodash'
import webhooksQueryList from 'gql/admin/webhooks/webhooks-query-list.gql'
import webhookMutationCreate from 'gql/admin/webhooks/webhook-mutation-create.gql'
import webhookMutationUpdate from 'gql/admin/webhooks/webhook-mutation-update.gql'
import webhookMutationDelete from 'gql/admin/webhooks/webhook-mutation-delete.gql'
import webhookMutationTest from 'gql/admin/webhooks/webhook-mutation-test.gql'

export default {
  data() {
    return {
      webhooks: [],
      webhook: {
        id: null,
        title: '',
        description: '',
        url: '',
        events: [],
        isEnabled: true,
        secret: ''
      },
      selectedWebhookId: null,
      initialWebhook: {},
      availableEvents: [
        'page:created',
        'page:updated',
        'page:deleted',
        'page:moved',
        'user:created',
        'user:updated',
        'user:deleted'
      ]
    }
  },
  computed: {
    isDirty() {
      return !_.isEqual(this.webhook, this.initialWebhook)
    }
  },
  methods: {
    selectWebhook(hook) {
      this.selectedWebhookId = hook.id
      this.webhook = _.cloneDeep(hook)
      this.initialWebhook = _.cloneDeep(this.webhook)
    },
    addWebhook() {
      this.selectedWebhookId = 0 // Using 0 for new unsaved webhook
      this.webhook = {
        id: null,
        title: '',
        description: '',
        url: '',
        events: [],
        isEnabled: true,
        secret: ''
      }
      this.initialWebhook = {}
    },
    async save() {
      try {
        const isNew = !this.webhook.id
        const mutation = isNew ? webhookMutationCreate : webhookMutationUpdate
        const variables = _.cloneDeep(this.webhook)
        if (isNew) delete variables.id

        await this.$apollo.mutate({
          mutation,
          variables,
          refetchQueries: [{ query: webhooksQueryList }]
        })

        this.$store.commit('showNotification', {
          style: 'success',
          message: `Webhook ${isNew ? 'created' : 'updated'} successfully.`,
          icon: 'check'
        })

        if (isNew) {
           this.selectedWebhookId = null
        } else {
           this.initialWebhook = _.cloneDeep(this.webhook)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async deleteWebhook() {
      if (!confirm('Are you sure you want to delete this webhook?')) return
      try {
        await this.$apollo.mutate({
          mutation: webhookMutationDelete,
          variables: { id: this.webhook.id },
          refetchQueries: [{ query: webhooksQueryList }]
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Webhook deleted successfully.',
          icon: 'check'
        })
        this.selectedWebhookId = null
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async testWebhook() {
      try {
        await this.$apollo.mutate({
          mutation: webhookMutationTest,
          variables: { id: this.webhook.id }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Test webhook sent successfully.',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  },
  apollo: {
    webhooks: {
      query: webhooksQueryList,
      fetchPolicy: 'network-only',
      update: (data) => data.webhooks.list,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-webhooks-refresh')
      }
    }
  }
}
</script>
