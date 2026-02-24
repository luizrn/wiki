<template lang="pug">
  v-footer.justify-center(:color='bgColor', inset)
    .d-flex.align-center.flex-wrap.justify-center
      .caption.grey--text(:class='$vuetify.theme.dark ? `text--lighten-1` : `text--darken-1`')
        template(v-if='footerOverride')
          span(v-html='footerOverrideRender + ` |&nbsp;`')
        template(v-else-if='company && company.length > 0 && contentLicense !== ``')
          span(v-if='contentLicense === `alr`') {{ $t('common:footer.copyright', { company: company, year: currentYear, interpolation: { escapeValue: false } }) }} |&nbsp;
          span(v-else) {{ $t('common:footer.license', { company: company, license: $t('common:license.' + contentLicense), interpolation: { escapeValue: false } }) }} |&nbsp;
        span Distribuído por #[a(href='https://wiki.js.org', ref='nofollow') Wiki.js] (versão TBDC V2)
      v-btn.ml-3(x-small, outlined, :color='statusColor', href='/status')
        v-icon(left, x-small, :color='statusColor') {{ statusIcon }}
        span {{ statusLabel }}
</template>

<script>
import { get } from 'vuex-pathify'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  breaks: false,
  linkify: true
})

export default {
  props: {
    color: {
      type: String,
      default: 'grey lighten-3'
    },
    darkColor: {
      type: String,
      default: 'grey darken-3'
    }
  },
  data() {
    return {
      currentYear: (new Date()).getFullYear(),
      statusOverall: '',
      statusTimer: null
    }
  },
  computed: {
    company: get('site/company'),
    contentLicense: get('site/contentLicense'),
    footerOverride: get('site/footerOverride'),
    footerOverrideRender () {
      if (!this.footerOverride) { return '' }
      return md.renderInline(this.footerOverride)
    },
    bgColor() {
      if (!this.$vuetify.theme.dark) {
        return this.color
      } else {
        return this.darkColor
      }
    },
    statusLabel () {
      const map = {
        Operational: 'Status operacional',
        'Partially Degraded Service': 'Serviço parcialmente degradado',
        'Degraded Performance': 'Performance degradada',
        'Major Outage': 'Indisponibilidade geral',
        'Under Maintenance': 'Em manutenção',
        Unknown: 'Status indisponível'
      }
      const txt = map[this.statusOverall] || this.statusOverall || 'Status dos sistemas TBDC em tempo real'
      return txt
    },
    statusColor () {
      const s = this.statusOverall
      if (s === 'Operational') return 'success'
      if (s === 'Partially Degraded Service' || s === 'Degraded Performance' || s === 'Under Maintenance') return 'warning'
      if (s === 'Major Outage') return 'error'
      return 'info'
    },
    statusIcon () {
      const s = this.statusOverall
      if (s === 'Operational') return 'mdi-check-circle'
      if (s === 'Major Outage') return 'mdi-alert-circle'
      if (s === 'Partially Degraded Service' || s === 'Degraded Performance') return 'mdi-alert'
      if (s === 'Under Maintenance') return 'mdi-wrench-clock'
      return 'mdi-help-circle'
    }
  },
  mounted () {
    this.refreshStatus()
    this.statusTimer = window.setInterval(this.refreshStatus, 30000)
  },
  beforeDestroy () {
    if (this.statusTimer) {
      window.clearInterval(this.statusTimer)
      this.statusTimer = null
    }
  },
  methods: {
    async refreshStatus () {
      try {
        const resp = await fetch('/status/summary', {
          method: 'GET',
          credentials: 'same-origin'
        })
        if (!resp.ok) return
        const data = await resp.json()
        this.statusOverall = data && data.overall ? data.overall : ''
      } catch (err) {
        // Silent fallback to avoid noisy footer errors.
      }
    }
  }
}
</script>

<style lang="scss">
  .v-footer {
    a {
      text-decoration: none;
    }

    &.altbg {
      background: mc('theme', 'primary');

      span {
        color: mc('blue', '300');
      }

      a {
        color: mc('blue', '200');
      }
    }
  }
</style>
