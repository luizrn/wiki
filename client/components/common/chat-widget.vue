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
          template(v-if='sortedRecentUsers.length > 0')
            v-subheader.chat-group-title Conversas recentes
            v-list-item.chat-user-item(v-for='user in sortedRecentUsers', :key='`recent-` + user.id', @click='selectUser(user)')
              v-list-item-avatar
                v-img(:src='user.pictureUrl || "/_assets/svg/icon-user.svg"')
              v-list-item-content
                v-list-item-title {{ user.name }}
                v-list-item-subtitle
                  span(:class='user.isOnline ? "online-text" : "offline-text"') {{ user.isOnline ? "Online" : "Offline" }}
              v-list-item-action
                v-badge(v-if='unreadByUser[user.id] > 0', color='red', :content='unreadByUser[user.id]')
                  v-icon(small, :color='user.isOnline ? "green" : "grey"') mdi-circle
                v-icon(v-else, small, :color='user.isOnline ? "green" : "grey"') mdi-circle
          template(v-for='(groupUsers, groupName) in groupedUsersNoHistory')
            v-subheader.chat-group-title(:key='`group-title-` + groupName') {{ groupName }}
            v-list-item.chat-user-item(v-for='user in groupUsers', :key='`group-user-` + user.id', @click='selectUser(user)')
              v-list-item-avatar
                v-img(:src='user.pictureUrl || "/_assets/svg/icon-user.svg"')
              v-list-item-content
                v-list-item-title {{ user.name }}
                v-list-item-subtitle
                  span(:class='user.isOnline ? "online-text" : "offline-text"') {{ user.isOnline ? "Online" : "Offline" }}
              v-list-item-action
                v-badge(v-if='unreadByUser[user.id] > 0', color='red', :content='unreadByUser[user.id]')
                  v-icon(small, :color='user.isOnline ? "green" : "grey"') mdi-circle
                v-icon(v-else, small, :color='user.isOnline ? "green" : "grey"') mdi-circle

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
        lastMessageAt
        primaryGroup
        groups
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

const MARK_AS_READ = gql`
  mutation($senderId: Int!) {
    chat {
      markAsRead(senderId: $senderId) {
        responseResult { succeeded }
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
      unreadByUser: {},
      heartbeatInterval: null,
      usersRefreshInterval: null,
      conversationRefreshInterval: null,
      lastMessageId: null
    }
  },
  computed: {
    currentUserId: get('user/id'),
    primaryColor: get('site/primaryColor'),
    headerColor: get('site/headerColor'),
    isChatEnabledGlobally: get('site/chatEnabled'),
    isChatEnabledIndividually: get('user/chatEnabled'),
    filteredUsers() {
      return _.filter(this.users, u => {
        if (!this.search) return true
        const needle = _.toLower(_.trim(this.search))
        return _.toLower(u.name || '').includes(needle) || _.toLower(u.email || '').includes(needle)
      })
    },
    sortedRecentUsers() {
      return _.orderBy(
        _.filter(this.filteredUsers, u => !!u.lastMessageAt),
        [
          u => -(new Date(u.lastMessageAt).getTime() || 0),
          u => _.toLower(u.name || '')
        ],
        ['asc', 'asc']
      )
    },
    groupedUsersNoHistory() {
      const withoutHistory = _.orderBy(
        _.filter(this.filteredUsers, u => !u.lastMessageAt),
        [
          u => _.toLower(u.primaryGroup || 'Sem Grupo'),
          u => _.toLower(u.name || '')
        ],
        ['asc', 'asc']
      )
      return _.groupBy(withoutHistory, u => u.primaryGroup || 'Sem Grupo')
    }
  },
  watch: {
    isOpen(val) {
      if (val) {
        this.fetchUsers()
        this.startUsersAutoRefresh()
      } else {
        this.stopUsersAutoRefresh()
        this.stopConversationAutoRefresh()
      }
    },
    search: _.debounce(function () {
      if (this.isOpen && !this.activeUser) {
        this.fetchUsers()
      }
    }, 250),
    activeUser(val) {
      if (val) {
        this.$set(this.unreadByUser, val.id, 0)
        this.fetchMessages()
        this.markCurrentConversationAsRead()
        this.startConversationAutoRefresh()
        this.scrollToBottom()
      } else {
        this.messages = []
        this.lastMessageId = null
        this.stopConversationAutoRefresh()
      }
    }
  },
  apollo: {
    $subscribe: {
      chatMessageReceived: {
        query: MSG_SUBSCRIPTION,
        result({ data }) {
          const msg = data.chatMessageReceived
          this.touchUserConversation(msg)
          if (this.activeUser && (msg.senderId === this.activeUser.id || msg.receiverId === this.activeUser.id)) {
            this.appendMessage(msg)
            if (msg.senderId === this.activeUser.id && msg.receiverId === this.currentUserId) {
              this.markCurrentConversationAsRead()
            }
            this.scrollToBottom()
          } else if (msg.senderId !== this.currentUserId) {
            const currentUnread = this.unreadByUser[msg.senderId] || 0
            this.$set(this.unreadByUser, msg.senderId, currentUnread + 1)
            this.recalculateTotalUnread()
          }
        }
      },
      userStatusChanged: {
        query: USER_STATUS_SUBSCRIPTION,
        result({ data }) {
          const status = data.userStatusChanged
          const user = _.find(this.users, { id: status.userId })
          if (user) {
            this.$set(user, 'isOnline', status.isOnline)
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
    this.stopUsersAutoRefresh()
    this.stopConversationAutoRefresh()
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
      if (!this.activeUser) return
      try {
        const resp = await this.$apollo.query({
          query: CHAT_MESSAGES,
          variables: { userId: this.activeUser.id },
          fetchPolicy: 'network-only'
        })
        const nextMessages = _.get(resp, 'data.chat.messages', [])
        const lastMsg = _.last(nextMessages)
        const nextLastId = _.get(lastMsg, 'id', null)
        const hasNewMessage = nextLastId && nextLastId !== this.lastMessageId
        this.messages = nextMessages
        this.lastMessageId = nextLastId
        if (hasNewMessage) {
          this.scrollToBottom()
        }
      } catch (err) {
        console.error(err)
      }
    },
    selectUser(user) {
      this.activeUser = user
    },
    appendMessage(msg) {
      if (!_.some(this.messages, { id: msg.id })) {
        this.messages.push(msg)
        this.lastMessageId = msg.id
      }
    },
    touchUserConversation(msg) {
      if (!msg) return
      const otherId = msg.senderId === this.currentUserId ? msg.receiverId : msg.senderId
      const user = _.find(this.users, { id: otherId })
      if (user) {
        this.$set(user, 'lastMessageAt', msg.createdAt)
      }
    },
    async markCurrentConversationAsRead() {
      if (!this.activeUser) return
      try {
        await this.$apollo.mutate({
          mutation: MARK_AS_READ,
          variables: { senderId: this.activeUser.id }
        })
        this.$set(this.unreadByUser, this.activeUser.id, 0)
        this.recalculateTotalUnread()
      } catch (err) {
        // ignore
      }
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
          this.appendMessage(msg)
          this.touchUserConversation(msg)
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
    recalculateTotalUnread() {
      this.totalUnread = _.sum(_.values(this.unreadByUser))
    },
    startHeartbeat() {
      // Update status every 2 minutes
      this.updateStatus()
      this.heartbeatInterval = setInterval(() => {
        this.updateStatus()
      }, 120000)
    },
    startUsersAutoRefresh() {
      this.stopUsersAutoRefresh()
      this.usersRefreshInterval = setInterval(() => {
        if (this.isOpen && !this.activeUser) {
          this.fetchUsers()
        }
      }, 30000)
    },
    stopUsersAutoRefresh() {
      if (this.usersRefreshInterval) {
        clearInterval(this.usersRefreshInterval)
        this.usersRefreshInterval = null
      }
    },
    startConversationAutoRefresh() {
      this.stopConversationAutoRefresh()
      this.conversationRefreshInterval = setInterval(() => {
        if (this.isOpen && this.activeUser) {
          this.fetchMessages()
          this.markCurrentConversationAsRead()
        }
      }, 8000)
    },
    stopConversationAutoRefresh() {
      if (this.conversationRefreshInterval) {
        clearInterval(this.conversationRefreshInterval)
        this.conversationRefreshInterval = null
      }
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
  z-index: 1300;
  position: fixed;
  bottom: 20px;
  right: 20px;

  .chat-trigger {
    box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
  }

  .chat-window {
    width: 380px;
    height: 560px;
    display: flex;
    flex-direction: column;
    border-radius: 12px !important;
    overflow: hidden;
    border: 1px solid #ccc;
    background-color: #fff;

    .v-toolbar {
      flex: 0 0 auto;
    }

    .v-toolbar__content {
      min-height: 52px !important;
    }

    .chat-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    .chat-user-list {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding-top: 4px !important;
      align-content: flex-start;
    }

    .chat-user-item {
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }

    .chat-group-title {
      min-height: 26px;
      height: 26px;
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      font-weight: 700;
      color: #6b6b6b;
      text-transform: uppercase;
      background: rgba(0, 0, 0, 0.03);
    }

    .online-text {
      color: #2e7d32;
      font-weight: 600;
    }

    .offline-text {
      color: #757575;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      background-color: #e5ddd5; // WhatsApp light background
      min-height: 0;

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
