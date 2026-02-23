# Sistema de Novidades (Updates)

Um canal de comunicação premium inspirado no UserGuiding para manter os usuários informados sobre as atualizações da plataforma.

## 🚀 Funcionalidades Principais

### Interface Pública (`/novidades`)
- **Feed Cronológico**: Visualização clara de todas as atualizações.
- **Filtros por Produto**: Sidebar que permite filtrar por categorias (Produtor, Consultoria, App, etc).
- **Pesquisa de Satisfação**: Sistema de micro-feedback com emojis em cada post.
- **Badge de Notificação**: Ponto vermelho pulsante no cabeçalho que avisa sobre novos conteúdos não lidos.

### Painel Administrativo (`/a/tbdc-updates`)
- **Dashboard de Engajamento**: Médias de satisfação (Feliz, Neutro, Triste) exibidas no topo.
- **Editor Markdown**: Interface intuitiva para criação de novas postagens.
- **Gestão de Master Data**: Configuração de Categorias (cores/ícones) e Públicos-Alvo.

## 🛠️ Detalhes Técnicos

### Backend
- **Modelos (Objection.js)**: 
  - `tbdc_updates`: Conteúdo principal.
  - `tbdc_update_categories`: Categorização de produtos.
  - `tbdc_update_votes`: Registro de satisfação.
- **GraphQL**: Schema e Resolutores em `server/graph/`.

### Frontend
- **Componentes**: `tbdc-updates-public.vue` e `admin-tbdc-updates.vue`.
- **LocalStorage**: Utilizado para rastrear a leitura dos posts e gerenciar o estado da notificação no cabeçalho.
