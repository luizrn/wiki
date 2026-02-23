<template lang="pug">
.chat-widget-container(v-if='isChatEnabledGlobally && isChatEnabledIndividually', :class='{ "is-open": isOpen }')
  v-btn.chat-trigger(
    fab
    fixed
    bottom
    :right='!$vuetify.rtl'
    :left='$vuetify.rtl'
    color='primary'
    dark
    @click='toggleChat'
    v-show='!isOpen'
  )
    v-icon mdi-chat
    v-badge(v-if='totalUnread > 0', color='red', :content='totalUnread', overlap)

  v-card.chat-window(v-if='isOpen', elevation='10', :style='{ borderColor: headerColor }')
    v-toolbar(:color='headerColor', dark, dense, flat)
      v-btn(icon, small, v-if='activeUser', @click='activeUser = null')
        v-icon mdi-chevron-left
      v-avatar.mr-2(size='32', v-if='activeUser')
        v-img(:src='activeUser.pictureUrl || "/_assets/svg/icon-user.svg"')
      v-toolbar-title.body-1 {{ activeUser ? activeUser.name : "Chat Corporativo" }}
      v-spacer
      v-menu(offset-y, left, v-if='!activeUser')
        template(v-slot:activator='{ on }')
          v-btn(icon, small, v-on='on')
            v-icon mdi-dots-vertical
        v-list(dense)
          v-list-item(@click='disableIndividually')
            v-list-item-icon
              v-icon mdi-chat-off
            v-list-item-title Desativar Chat
      v-btn(icon, small, @click='isOpen = false')
        v-icon mdi-close

    .chat-content
      //- USER LIST
      template(v-if='!activeUser')
        v-text-field.px-3.pt-2(
          v-model='search'
          placeholder='Buscar usuário...'
          prepend-inner-icon='mdi-magnify'
          dense
          outlined
          hide-details
        )
        v-list.chat-user-list(dense)
          v-list-item(v-for='user in filteredUsers', :key='user.id', @click='selectUser(user)')
            v-list-item-avatar
              v-img(:src='user.pictureUrl || "/_assets/svg/icon-user.svg"')
            v-list-item-content
              v-list-item-title {{ user.name }}
              v-list-item-subtitle {{ user.isOnline ? "Online" : "Offline" }}
            v-list-item-action
              v-icon(small, :color='user.isOnline ? "green" : "grey"') mdi-circle

      //- CHAT BOX
      template(v-else)
        .chat-messages(ref='msgContainer')
          .msg-wrapper(v-for='msg in messages', :key='msg.id', :class='{ "is-mine": msg.senderId === currentUserId }')
            .msg-bubble(:style='msg.senderId === currentUserId ? { backgroundColor: primaryColor, color: "#fff" } : {}')
              .msg-text {{ msg.message }}
              .msg-time {{ msg.createdAt | moment("HH:mm") }}

        v-divider
        .chat-input-area
          v-textarea(
            v-model='newMessage'
            rows='1'
            auto-grow
            placeholder='Digite uma mensagem...'
            dense
            hide-details
            @keydown.enter.prevent='send'
          )
          v-btn(icon, color='primary', @click='send', :disabled='!newMessage.trim()')
            v-icon mdi-send

</template>

<script>
import { get } from 'vuex-pathify'
import _ from 'lodash'
import gql from 'graphql-tag'

const CHAT_USERS = gql`
  query($search: String) {
    chat {
      users(search: $search) {
        id
        name
        email
        pictureUrl
        isOnline
        lastActiveAt
      }
    }
  }
`

const CHAT_MESSAGES = gql`
  query($userId: Int!) {
    chat {
      messages(userId: $userId) {
        id
        senderId
        receiverId
        message
        isRead
        createdAt
      }
    }
  }
`

const SEND_MESSAGE = gql`
  mutation($receiverId: Int!, $message: String!) {
    chat {
      sendMessage(receiverId: $receiverId, message: $message) {
        id
        senderId
        receiverId
        message
        isRead
        createdAt
      }
    }
  }
`

const MSG_SUBSCRIPTION = gql`
  subscription {
    chatMessageReceived {
      id
      senderId
      receiverId
      message
      isRead
      createdAt
    }
  }
`

const USER_STATUS_SUBSCRIPTION = gql`
  subscription {
    userStatusChanged {
      userId
      isOnline
    }
  }
`

const UPDATE_STATUS = gql`
  mutation {
    chat {
      updateStatus {
        responseResult { succeeded }
      }
    }
  }
`

const UPDATE_PROFILE = gql`
  mutation($chatEnabled: Boolean) {
    users {
      updateProfile(chatEnabled: $chatEnabled, name: "", location: "", jobTitle: "", timezone: "", dateFormat: "", appearance: "") {
        responseResult { succeeded }
        jwt
      }
    }
  }
`

export default {
  data() {
    return {
      isOpen: false,
      activeUser: null,
      search: '',
      users: [],
      messages: [],
      newMessage: '',
      totalUnread: 0,
      heartbeatInterval: null
    }
  },
  computed: {
    currentUserId: get('user/id'),
    primaryColor: get('site/primaryColor'),
    headerColor: get('site/headerColor'),
    isChatEnabledGlobally: get('site/chatEnabled'),
    isChatEnabledIndividually: get('user/chatEnabled'),
    filteredUsers() {
      return this.users
    }
  },
  watch: {
    isOpen(val) {
      if (val) {
        this.fetchUsers()
      }
    },
    activeUser(val) {
      if (val) {
        this.fetchMessages()
        this.scrollToBottom()
      }
    }
  },
  apollo: {
    $subscribe: {
      chatMessageReceived: {
        query: MSG_SUBSCRIPTION,
        result({ data }) {
          const msg = data.chatMessageReceived
          if (this.activeUser && (msg.senderId === this.activeUser.id || msg.receiverId === this.activeUser.id)) {
            this.messages.push(msg)
            this.scrollToBottom()
          } else if (msg.senderId !== this.currentUserId) {
            this.totalUnread++
            // Optionally play sound or show notification
          }
        }
      },
      userStatusChanged: {
        query: USER_STATUS_SUBSCRIPTION,
        result({ data }) {
          const status = data.userStatusChanged
          const user = _.find(this.users, { id: status.userId })
          if (user) {
            user.isOnline = status.isOnline
          }
        }
      }
    }
  },
  mounted() {
    this.startHeartbeat()
  },
  beforeDestroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
  },
  methods: {
    toggleChat() {
      this.isOpen = !this.isOpen
    },
    async fetchUsers() {
      try {
        const resp = await this.$apollo.query({
          query: CHAT_USERS,
          variables: { search: this.search },
          fetchPolicy: 'network-only'
        })
        this.users = _.get(resp, 'data.chat.users', [])
      } catch (err) {
        console.error(err)
      }
    },
    async fetchMessages() {
      try {
        const resp = await this.$apollo.query({
          query: CHAT_MESSAGES,
          variables: { userId: this.activeUser.id },
          fetchPolicy: 'network-only'
        })
        this.messages = _.get(resp, 'data.chat.messages', [])
      } catch (err) {
        console.error(err)
      }
    },
    selectUser(user) {
      this.activeUser = user
    },
    async send() {
      if (!this.newMessage.trim()) return
      const text = this.newMessage
      this.newMessage = ''

      try {
        const resp = await this.$apollo.mutate({
          mutation: SEND_MESSAGE,
          variables: {
            receiverId: this.activeUser.id,
            message: text
          }
        })
        const msg = _.get(resp, 'data.chat.sendMessage')
        if (msg) {
          this.messages.push(msg)
          this.scrollToBottom()
        }
      } catch (err) {
        console.error(err)
      }
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.msgContainer
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
    },
    startHeartbeat() {
      // Update status every 2 minutes
      this.updateStatus()
      this.heartbeatInterval = setInterval(() => {
        this.updateStatus()
      }, 120000)
    },
    async updateStatus() {
      try {
        await this.$apollo.mutate({ mutation: UPDATE_STATUS })
      } catch (err) {
        // ignore
      }
    },
    async disableIndividually() {
      if (confirm('Deseja realmente desativar o chat? Você poderá reativá-lo nas configurações de perfil.')) {
        try {
          await this.$apollo.mutate({
            mutation: UPDATE_PROFILE,
            variables: { chatEnabled: false }
          })
          window.location.reload() // Reload to apply JWT change
        } catch (err) {
          console.error(err)
        }
      }
    }
  }
}
</script>

<style lang="scss">
.chat-widget-container {
  z-index: 1000;
  position: fixed;
  bottom: 20px;
  right: 20px;

  .chat-trigger {
    box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
  }

  .chat-window {
    width: 350px;
    height: 500px;
    display: flex;
    flex-direction: column;
    border-radius: 12px !important;
    overflow: hidden;
    border: 1px solid #ccc;
    background-color: #fff;

    .chat-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .chat-user-list {
      flex: 1;
      overflow-y: auto;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      background-color: #e5ddd5; // WhatsApp light background

      .msg-wrapper {
        display: flex;
        margin-bottom: 8px;
        &.is-mine {
          justify-content: flex-end;
          .msg-bubble {
            border-bottom-right-radius: 2px;
          }
        }
        &:not(.is-mine) {
          .msg-bubble {
            background-color: #fff;
            border-bottom-left-radius: 2px;
          }
        }
      }

      .msg-bubble {
        padding: 6px 10px;
        border-radius: 8px;
        max-width: 80%;
        box-shadow: 0 1px 1px rgba(0,0,0,0.1);
        position: relative;
        font-size: 0.9rem;

        .msg-time {
          font-size: 0.7rem;
          opacity: 0.6;
          text-align: right;
          margin-top: 2px;
        }
      }
    }

    .chat-input-area {
      padding: 8px;
      display: flex;
      align-items: center;
      background-color: #f0f0f0;
    }
  }
}

.theme--dark {
  .chat-window {
    background-color: #1e1e1e;
    border-color: #333;
    .chat-messages {
      background-color: #0b141a; // WhatsApp dark background
    }
    .chat-input-area {
      background-color: #2a2a2a;
    }
    .msg-bubble:not(.is-mine) {
      background-color: #202c33;
      color: #fff;
    }
  }
}
</style>
