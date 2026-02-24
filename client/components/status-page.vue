<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').status-page
    nav-header
    v-main(:class='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-5`')
      v-container(fluid, grid-list-lg)
        v-card
          v-toolbar(flat, color='primary', dark)
            v-toolbar-title Status da Plataforma
            v-spacer
            v-btn(outlined, color='white', href='https://uptime.tbdc.com.br/status/6455fergthukkiiolrttwqwszc5w55g4jk4kkop8j88hf', target='_blank', rel='noopener')
              v-icon(left, small) mdi-open-in-new
              span Abrir em nova aba
          v-card-text
            .caption.grey--text.mb-3 Caso o painel não carregue no iframe, use o botão "Abrir em nova aba".
            iframe.status-frame(
              src='https://uptime.tbdc.com.br/status/6455fergthukkiiolrttwqwszc5w55g4jk4kkop8j88hf'
              width='100%'
              height='800'
              loading='lazy'
              referrerpolicy='no-referrer'
              style='border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
            )
    nav-footer
    notify
    search-results
    chat-widget(v-if='$store.state.user.authenticated')
</template>

<script>
export default {
  created () {
    this.$store.commit('page/SET_MODE', 'status')
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
