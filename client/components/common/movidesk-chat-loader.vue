<template lang='pug'>
  span(style='display:none;')
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'

export default {
  computed: {
    isAuthenticated: get('user/authenticated'),
    userName: get('user/name'),
    userEmail: get('user/email'),
    movideskEnabled: get('site/movideskEnabled'),
    movideskChatKey: get('site/movideskChatKey'),
    movideskCodeReference: get('site/movideskCodeReference'),
    movideskOrganizationCodeReference: get('site/movideskOrganizationCodeReference'),
    movideskStayConnected: get('site/movideskStayConnected'),
    movideskEmptySubject: get('site/movideskEmptySubject'),
    movideskStartChat: get('site/movideskStartChat')
  },
  watch: {
    isAuthenticated: 'boot',
    movideskEnabled: 'boot',
    movideskChatKey: 'boot',
    userEmail: 'boot'
  },
  mounted () {
    this.boot()
  },
  methods: {
    async boot () {
      if (!this.isAuthenticated || !this.movideskEnabled || !this.movideskChatKey || !this.userEmail) {
        return
      }
      try {
        await this.ensureScriptLoaded()
        this.login()
      } catch (err) {
        // no-op to avoid noisy UX; failures can be tested in /a/movidesk
      }
    },
    async ensureScriptLoaded () {
      if (typeof window.movideskLogin === 'function') {
        return
      }

      if (window.__movideskScriptPromise) {
        return window.__movideskScriptPromise
      }

      window.mdChatClient = this.movideskChatKey

      window.__movideskScriptPromise = new Promise((resolve, reject) => {
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

      return window.__movideskScriptPromise
    },
    login () {
      const signature = `${this.userEmail}|${this.movideskChatKey}|${this.movideskCodeReference}|${this.movideskOrganizationCodeReference}`
      if (window.__movideskLastLoginSignature === signature) {
        return
      }
      if (typeof window.movideskLogin !== 'function') {
        return
      }

      window.movideskLogin({
        name: _.trim(this.userName) || 'Usuario Wiki',
        email: _.trim(this.userEmail),
        codeReference: _.trim(this.movideskCodeReference || ''),
        organizationCodeReference: _.trim(this.movideskOrganizationCodeReference || ''),
        stayConnected: !!this.movideskStayConnected,
        emptySubject: !!this.movideskEmptySubject,
        startChat: !!this.movideskStartChat
      })

      window.__movideskLastLoginSignature = signature
    }
  }
}
</script>
