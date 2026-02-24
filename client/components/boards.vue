<template lang='pug'>
v-app(:dark='$vuetify.theme.dark').boards
  nav-header
  v-navigation-drawer(app, fixed, clipped, width='320', permanent)
    v-toolbar(flat, dense, color='primary', dark)
      .subtitle-1 Boards
      v-spacer
      v-btn(icon, small, @click='showCreateBoard = true'): v-icon mdi-plus
    v-list(dense, two-line)
      v-list-item(v-for='b in boards' :key='b.id' @click='selectBoard(b.id)')
        v-list-item-avatar: v-icon(:color='b.color || `primary`') {{ b.icon || 'mdi-view-kanban' }}
        v-list-item-content
          v-list-item-title {{ b.title }}
          v-list-item-subtitle {{ b.cardsCount }} cards
    v-divider
    v-toolbar(flat, dense)
      .subtitle-2 Times
      v-spacer
      v-btn(icon, small, @click='openTeam()'): v-icon mdi-account-multiple-plus
    v-list(dense)
      v-list-item(v-for='t in teams' :key='t.id' @click='openTeam(t)')
        v-list-item-avatar: v-icon(:color='t.color || `blue-grey`') mdi-account-group
        v-list-item-title {{ t.name }}

  v-content(:class='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-4`')
    v-container(fluid)
      v-card(v-if='!board')
        v-card-text.text-center.py-12
          v-icon(size='72', color='grey') mdi-view-kanban
          .subtitle-1.mt-3 Selecione um board
      template(v-else)
        v-toolbar(flat, color='transparent')
          v-icon.mr-2(:color='board.color || `primary`') {{board.icon || 'mdi-view-kanban'}}
          .headline {{ board.title }}
          v-spacer
          v-btn.mr-2(outlined, color='primary', @click='openBoardSettings'): Configurar
          v-btn(color='primary', @click='openStage()'): Nova etapa
        draggable.d-flex(style='gap:12px;overflow-x:auto', v-model='board.stages', group='stages', handle='.stage-handle', @change='moveStage')
          v-card(v-for='s in board.stages' :key='s.id', style='min-width:300px;max-width:300px')
            v-toolbar(flat, dense)
              v-icon.stage-handle.mr-1(color='grey') mdi-drag
              .subtitle-2 {{ s.title }}
              v-spacer
              v-btn(icon, x-small, @click='openStage(s)'): v-icon(small) mdi-pencil
              v-btn(icon, x-small, @click='delStage(s)'): v-icon(small, color='red') mdi-delete
            v-divider
            draggable(:list='s.cards', :group='{name:`cards`}', ghost-class='card-ghost', @change='moveCard(s, $event)')
              v-card.mx-2.my-2(v-for='c in s.cards' :key='c.id' outlined @click='openCard(c)')
                v-card-text.py-2
                  .body-2.font-weight-bold {{ c.title }}
                  .caption.grey--text {{ c.assigneeName || 'sem responsável' }}
            v-card-actions
              v-btn(text, small, color='primary', @click='openCard({ stageId: s.id })')
                v-icon(left, small) mdi-plus
                span Novo card

  v-dialog(v-model='showCreateBoard', max-width='700')
    v-card
      v-card-title Novo board
      v-card-text
        v-text-field(v-model='fBoard.title', label='Título', outlined, dense)
        v-textarea(v-model='fBoard.description', label='Descrição', outlined, dense, rows='3')
        v-row
          v-col(cols='6'): v-text-field(v-model='fBoard.color', label='Cor', outlined, dense)
          v-col(cols='6'): v-text-field(v-model='fBoard.icon', label='Ícone', outlined, dense)
        v-switch(v-model='fBoard.isPublic', label='Público')
        v-select(v-model='fBoard.groupIds', :items='groups', item-text='name', item-value='id', multiple, label='Grupos', outlined, dense)
      v-card-actions
        v-spacer
        v-btn(text, @click='showCreateBoard=false') Cancelar
        v-btn(color='primary', @click='createBoard') Criar

  v-dialog(v-model='showBoardSettings', max-width='900')
    v-card
      v-card-title Configurações do board
      v-card-text
        v-text-field(v-model='fBoard.title', label='Título', outlined, dense)
        v-textarea(v-model='fBoard.description', label='Descrição', outlined, dense, rows='3')
        v-row
          v-col(cols='4'): v-text-field(v-model='fBoard.color', label='Cor', outlined, dense)
          v-col(cols='4'): v-text-field(v-model='fBoard.icon', label='Ícone', outlined, dense)
          v-col(cols='4'): v-switch(v-model='fBoard.isArchived', label='Arquivado')
        v-switch(v-model='fBoard.isPublic', label='Público')
        v-row(v-for='(g,idx) in fGroups' :key='idx')
          v-col(cols='7'): v-select(v-model='g.groupId', :items='groups', item-text='name', item-value='id', label='Grupo', outlined, dense)
          v-col(cols='4'): v-select(v-model='g.accessLevel', :items='[`view`,`edit`,`admin`]', label='Acesso', outlined, dense)
          v-col(cols='1'): v-btn(icon, @click='fGroups.splice(idx,1)'): v-icon(color='red') mdi-delete
        v-btn(text, small, color='primary', @click='fGroups.push({groupId:null,accessLevel:`edit`})') Adicionar grupo
        v-divider.my-3
        v-select(v-model='fTeamIds', :items='teams', item-text='name', item-value='id', multiple, chips, label='Times vinculados', outlined, dense)
      v-card-actions
        v-spacer
        v-btn(text, @click='showBoardSettings=false') Cancelar
        v-btn(color='primary', @click='saveBoardSettings') Salvar

  v-dialog(v-model='showStage', max-width='560')
    v-card
      v-card-title {{ fStage.id ? 'Editar etapa' : 'Nova etapa' }}
      v-card-text
        v-text-field(v-model='fStage.title', label='Título', outlined, dense)
        v-text-field(v-model='fStage.color', label='Cor', outlined, dense)
        v-text-field(v-model.number='fStage.wipLimit', label='WIP limit', type='number', outlined, dense)
        v-switch(v-model='fStage.isDone', label='Etapa final')
      v-card-actions
        v-spacer
        v-btn(text, @click='showStage=false') Cancelar
        v-btn(color='primary', @click='saveStage') Salvar

  v-dialog(v-model='showCard', max-width='1000')
    v-card
      v-card-title {{ fCard.id ? 'Editar card' : 'Novo card' }}
      v-card-text
        v-row
          v-col(cols='8')
            v-text-field(v-model='fCard.title', label='Título', outlined, dense)
            v-textarea(v-model='fCard.description', label='Descrição', outlined, dense, rows='5')
          v-col(cols='4')
            v-select(v-model='fCard.stageId', :items='board ? board.stages : []', item-text='title', item-value='id', label='Etapa', outlined, dense)
            v-select(v-model='fCard.priority', :items='[`low`,`medium`,`high`,`critical`]', label='Prioridade', outlined, dense)
            v-select(v-model='fCard.status', :items='[`open`,`blocked`,`in-progress`,`review`,`done`]', label='Status', outlined, dense)
            v-select(v-model='fCard.assigneeId', :items='users', item-text='name', item-value='id', label='Responsável', clearable, outlined, dense)
            v-text-field(v-model.number='fCard.estimatePoints', label='Story points', type='number', outlined, dense)
        v-row
          v-col(cols='6'): v-text-field(v-model='fCard.startDate', label='Início YYYY-MM-DD', outlined, dense)
          v-col(cols='6'): v-text-field(v-model='fCard.dueDate', label='Prazo YYYY-MM-DD', outlined, dense)
        v-combobox(v-model='fCard.labels', label='Labels', multiple, chips, outlined, dense)
        v-combobox(v-model='fCard.checklist', label='Checklist', multiple, chips, outlined, dense)
        v-combobox(v-model='fCard.attachments', label='Anexos/URLs', multiple, chips, outlined, dense)
        v-select(v-model='fCard.watchers', :items='users', item-text='name', item-value='id', label='Observadores', multiple, chips, outlined, dense)
        v-textarea(v-model='fCard.customFields', label='JSON de campos customizados', outlined, dense, rows='3')
      v-card-actions
        v-btn(v-if='fCard.id', text, color='red', @click='delCard') Excluir
        v-spacer
        v-btn(text, @click='showCard=false') Cancelar
        v-btn(color='primary', @click='saveCard') Salvar

  v-dialog(v-model='showTeam', max-width='760')
    v-card
      v-card-title {{ fTeam.id ? 'Editar time' : 'Novo time' }}
      v-card-text
        v-text-field(v-model='fTeam.name', label='Nome', outlined, dense)
        v-textarea(v-model='fTeam.description', label='Descrição', outlined, dense, rows='3')
        v-text-field(v-model='fTeam.color', label='Cor', outlined, dense)
        v-switch(v-model='fTeam.isArchived', label='Arquivado')
        v-select(v-model='fTeam.memberIds', :items='users', item-text='name', item-value='id', multiple, chips, label='Membros', outlined, dense)
        v-select(v-model='fTeam.boardIds', :items='boards', item-text='title', item-value='id', multiple, chips, label='Boards', outlined, dense)
      v-card-actions
        v-btn(v-if='fTeam.id', text, color='red', @click='delTeam') Excluir
        v-spacer
        v-btn(text, @click='showTeam=false') Cancelar
        v-btn(color='primary', @click='saveTeam') Salvar

  nav-footer
  notify
  search-results
  chat-widget(v-if='$store.state.user.authenticated')
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import draggable from 'vuedraggable'

const Q = {
  sidebar: gql`query { boards { list { id title description color icon cardsCount stagesCount } groups { id name } teams { id name description color isArchived members { id name email pictureUrl } boardIds } } }`,
  board: gql`query ($id:Int!) { boards { board(id:$id) { id title description color icon isArchived isPublic groups { groupId accessLevel } teams { id } stages { id title color wipLimit isDone cards { id boardId stageId title description priority status startDate dueDate assigneeId assigneeName estimatePoints labels checklist attachments watchers customFields } } } } }`,
  users: gql`query ($boardId:Int!) { boards { users(boardId:$boardId) { id name email pictureUrl } } }`
}
const M = {
  createBoard: gql`mutation ($title:String!,$description:String,$color:String,$icon:String,$isPublic:Boolean,$groupIds:[Int!]) { boards { createBoard(title:$title,description:$description,color:$color,icon:$icon,isPublic:$isPublic,groupIds:$groupIds){ id } } }`,
  updateBoard: gql`mutation ($id:Int!,$title:String,$description:String,$color:String,$icon:String,$isArchived:Boolean,$isPublic:Boolean,$settings:String){ boards { updateBoard(id:$id,title:$title,description:$description,color:$color,icon:$icon,isArchived:$isArchived,isPublic:$isPublic,settings:$settings){ id } } }`,
  saveGroups: gql`mutation ($boardId:Int!,$groups:[BoardGroupAccessInput!]!){ boards { saveBoardGroups(boardId:$boardId,groups:$groups){ id } } }`,
  createStage: gql`mutation ($boardId:Int!,$title:String!,$color:String,$wipLimit:Int,$isDone:Boolean){ boards { createStage(boardId:$boardId,title:$title,color:$color,wipLimit:$wipLimit,isDone:$isDone){ id } } }`,
  updateStage: gql`mutation ($id:Int!,$title:String,$color:String,$wipLimit:Int,$isDone:Boolean){ boards { updateStage(id:$id,title:$title,color:$color,wipLimit:$wipLimit,isDone:$isDone){ id } } }`,
  moveStage: gql`mutation ($boardId:Int!,$stageId:Int!,$targetPosition:Int!){ boards { moveStage(boardId:$boardId,stageId:$stageId,targetPosition:$targetPosition){ id } } }`,
  delStage: gql`mutation ($id:Int!){ boards { deleteStage(id:$id){ responseResult{ succeeded } } } }`,
  createCard: gql`mutation ($boardId:Int!,$stageId:Int!,$title:String!,$description:String,$priority:String,$status:String,$startDate:String,$dueDate:String,$assigneeId:Int,$estimatePoints:Int,$coverColor:String,$labels:[String!],$checklist:[String!],$attachments:[String!],$watchers:[Int!],$customFields:String){ boards { createCard(boardId:$boardId,stageId:$stageId,title:$title,description:$description,priority:$priority,status:$status,startDate:$startDate,dueDate:$dueDate,assigneeId:$assigneeId,estimatePoints:$estimatePoints,coverColor:$coverColor,labels:$labels,checklist:$checklist,attachments:$attachments,watchers:$watchers,customFields:$customFields){ id } } }`,
  updateCard: gql`mutation ($id:Int!,$title:String,$description:String,$priority:String,$status:String,$startDate:String,$dueDate:String,$completedAt:String,$assigneeId:Int,$estimatePoints:Int,$coverColor:String,$labels:[String!],$checklist:[String!],$attachments:[String!],$watchers:[Int!],$customFields:String){ boards { updateCard(id:$id,title:$title,description:$description,priority:$priority,status:$status,startDate:$startDate,dueDate:$dueDate,completedAt:$completedAt,assigneeId:$assigneeId,estimatePoints:$estimatePoints,coverColor:$coverColor,labels:$labels,checklist:$checklist,attachments:$attachments,watchers:$watchers,customFields:$customFields){ id } } }`,
  moveCard: gql`mutation ($cardId:Int!,$targetStageId:Int!,$targetPosition:Int!){ boards { moveCard(cardId:$cardId,targetStageId:$targetStageId,targetPosition:$targetPosition){ id } } }`,
  delCard: gql`mutation ($id:Int!){ boards { deleteCard(id:$id){ responseResult{ succeeded } } } }`,
  createTeam: gql`mutation ($name:String!,$description:String,$color:String,$memberIds:[Int!]){ boards { createTeam(name:$name,description:$description,color:$color,memberIds:$memberIds){ id } } }`,
  updateTeam: gql`mutation ($id:Int!,$name:String,$description:String,$color:String,$isArchived:Boolean,$memberIds:[Int!]){ boards { updateTeam(id:$id,name:$name,description:$description,color:$color,isArchived:$isArchived,memberIds:$memberIds){ id } } }`,
  delTeam: gql`mutation ($id:Int!){ boards { deleteTeam(id:$id){ responseResult{ succeeded } } } }`,
  linkTeam: gql`mutation ($teamId:Int!,$boardId:Int!){ boards { linkTeamBoard(teamId:$teamId,boardId:$boardId){ responseResult{ succeeded } } } }`,
  unlinkTeam: gql`mutation ($teamId:Int!,$boardId:Int!){ boards { unlinkTeamBoard(teamId:$teamId,boardId:$boardId){ responseResult{ succeeded } } } }`
}

export default {
  components: { draggable },
  data: () => ({
    boards: [],
    groups: [],
    teams: [],
    board: null,
    users: [],
    selectedBoardId: null,
    showCreateBoard: false,
    showBoardSettings: false,
    showStage: false,
    showCard: false,
    showTeam: false,
    fBoard: { title: '', description: '', color: '#1976d2', icon: 'mdi-view-kanban', isPublic: false, isArchived: false, groupIds: [] },
    fGroups: [],
    fTeamIds: [],
    fStage: { id: null, title: '', color: '#90a4ae', wipLimit: null, isDone: false },
    fCard: { id: null, stageId: null, title: '', description: '', priority: 'medium', status: 'open', startDate: '', dueDate: '', assigneeId: null, estimatePoints: null, coverColor: '', labels: [], checklist: [], attachments: [], watchers: [], customFields: '{}' },
    fTeam: { id: null, name: '', description: '', color: '#546e7a', isArchived: false, memberIds: [], boardIds: [] }
  }),
  created() {
    this.$store.commit('page/SET_MODE', 'boards')
    this.refresh()
  },
  methods: {
    async refresh(selectId = null) {
      const r = await this.$apollo.query({ query: Q.sidebar, fetchPolicy: 'network-only' })
      this.boards = _.get(r, 'data.boards.list', [])
      this.groups = _.get(r, 'data.boards.groups', [])
      this.teams = _.get(r, 'data.boards.teams', [])
      const nextId = selectId || this.selectedBoardId || _.get(this.boards, '[0].id')
      if (nextId) await this.selectBoard(nextId)
    },
    async selectBoard(id) {
      this.selectedBoardId = id
      const [b, u] = await Promise.all([
        this.$apollo.query({ query: Q.board, variables: { id }, fetchPolicy: 'network-only' }),
        this.$apollo.query({ query: Q.users, variables: { boardId: id }, fetchPolicy: 'network-only' })
      ])
      this.board = _.get(b, 'data.boards.board')
      this.users = _.get(u, 'data.boards.users', [])
    },
    async createBoard() {
      await this.$apollo.mutate({ mutation: M.createBoard, variables: this.fBoard })
      this.showCreateBoard = false
      await this.refresh()
    },
    openBoardSettings() {
      this.fBoard = { ...this.fBoard, ..._.pick(this.board, ['id', 'title', 'description', 'color', 'icon', 'isPublic', 'isArchived']) }
      this.fGroups = (this.board.groups || []).map(g => ({ groupId: g.groupId, accessLevel: g.accessLevel }))
      this.fTeamIds = (this.board.teams || []).map(t => t.id)
      this.showBoardSettings = true
    },
    async saveBoardSettings() {
      await this.$apollo.mutate({ mutation: M.updateBoard, variables: { ..._.pick(this.fBoard, ['id', 'title', 'description', 'color', 'icon', 'isPublic', 'isArchived']), settings: '{}' } })
      await this.$apollo.mutate({ mutation: M.saveGroups, variables: { boardId: this.board.id, groups: this.fGroups.filter(g => g.groupId) } })
      const prev = new Set((this.board.teams || []).map(t => t.id))
      const next = new Set(this.fTeamIds || [])
      for (const teamId of next) if (!prev.has(teamId)) await this.$apollo.mutate({ mutation: M.linkTeam, variables: { teamId, boardId: this.board.id } })
      for (const teamId of prev) if (!next.has(teamId)) await this.$apollo.mutate({ mutation: M.unlinkTeam, variables: { teamId, boardId: this.board.id } })
      this.showBoardSettings = false
      await this.refresh(this.board.id)
    },
    openStage(s = null) {
      this.fStage = s ? _.pick(s, ['id', 'title', 'color', 'wipLimit', 'isDone']) : { id: null, title: '', color: '#90a4ae', wipLimit: null, isDone: false }
      this.showStage = true
    },
    async saveStage() {
      if (this.fStage.id) await this.$apollo.mutate({ mutation: M.updateStage, variables: this.fStage })
      else await this.$apollo.mutate({ mutation: M.createStage, variables: { boardId: this.board.id, ...this.fStage } })
      this.showStage = false
      await this.selectBoard(this.board.id)
    },
    async delStage(s) {
      if (!confirm(`Remover etapa ${s.title}?`)) return
      await this.$apollo.mutate({ mutation: M.delStage, variables: { id: s.id } })
      await this.selectBoard(this.board.id)
    },
    async moveStage(evt) {
      if (!evt || !evt.moved) return
      await this.$apollo.mutate({ mutation: M.moveStage, variables: { boardId: this.board.id, stageId: evt.moved.element.id, targetPosition: evt.moved.newIndex } })
    },
    openCard(c = {}) {
      this.fCard = {
        id: c.id || null,
        stageId: c.stageId || c.stageId || null,
        title: c.title || '',
        description: c.description || '',
        priority: c.priority || 'medium',
        status: c.status || 'open',
        startDate: c.startDate || '',
        dueDate: c.dueDate || '',
        assigneeId: c.assigneeId || null,
        estimatePoints: c.estimatePoints || null,
        coverColor: c.coverColor || '',
        labels: c.labels || [],
        checklist: c.checklist || [],
        attachments: c.attachments || [],
        watchers: c.watchers || [],
        customFields: c.customFields || '{}'
      }
      this.showCard = true
    },
    async saveCard() {
      if (this.fCard.id) {
        await this.$apollo.mutate({ mutation: M.updateCard, variables: this.fCard })
        await this.$apollo.mutate({ mutation: M.moveCard, variables: { cardId: this.fCard.id, targetStageId: this.fCard.stageId, targetPosition: 9999 } })
      } else {
        await this.$apollo.mutate({ mutation: M.createCard, variables: { boardId: this.board.id, ...this.fCard } })
      }
      this.showCard = false
      await this.selectBoard(this.board.id)
    },
    async moveCard(stage, evt) {
      const c = evt.added || evt.moved
      if (!c) return
      await this.$apollo.mutate({ mutation: M.moveCard, variables: { cardId: c.element.id, targetStageId: stage.id, targetPosition: c.newIndex } })
    },
    async delCard() {
      if (!confirm('Excluir card?')) return
      await this.$apollo.mutate({ mutation: M.delCard, variables: { id: this.fCard.id } })
      this.showCard = false
      await this.selectBoard(this.board.id)
    },
    openTeam(t = null) {
      this.fTeam = t ? { id: t.id, name: t.name, description: t.description || '', color: t.color || '#546e7a', isArchived: !!t.isArchived, memberIds: (t.members || []).map(m => m.id), boardIds: t.boardIds || [] } :
        { id: null, name: '', description: '', color: '#546e7a', isArchived: false, memberIds: [], boardIds: this.board ? [this.board.id] : [] }
      this.showTeam = true
    },
    async saveTeam() {
      let teamId = this.fTeam.id
      if (teamId) await this.$apollo.mutate({ mutation: M.updateTeam, variables: _.pick(this.fTeam, ['id', 'name', 'description', 'color', 'isArchived', 'memberIds']) })
      else {
        const r = await this.$apollo.mutate({ mutation: M.createTeam, variables: _.pick(this.fTeam, ['name', 'description', 'color', 'memberIds']) })
        teamId = _.get(r, 'data.boards.createTeam.id')
      }
      const cur = _.find(this.teams, ['id', teamId]) || { boardIds: [] }
      const prev = new Set(cur.boardIds || [])
      const next = new Set(this.fTeam.boardIds || [])
      for (const boardId of next) if (!prev.has(boardId)) await this.$apollo.mutate({ mutation: M.linkTeam, variables: { teamId, boardId } })
      for (const boardId of prev) if (!next.has(boardId)) await this.$apollo.mutate({ mutation: M.unlinkTeam, variables: { teamId, boardId } })
      this.showTeam = false
      await this.refresh(this.board ? this.board.id : null)
    },
    async delTeam() {
      if (!confirm('Excluir time?')) return
      await this.$apollo.mutate({ mutation: M.delTeam, variables: { id: this.fTeam.id } })
      this.showTeam = false
      await this.refresh(this.board ? this.board.id : null)
    }
  }
}
</script>

<style lang='scss'>
.stage-handle { cursor: grab; }
.card-ghost { opacity: .45; }
</style>
