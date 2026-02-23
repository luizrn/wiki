# Busca Unificada e Ferramentas de Artigo

Melhorias focadas na descoberta de conteúdo e utilidade das páginas.

## 🔍 Busca Unificada
A barra de pesquisa principal foi estendida para pesquisar além das páginas tradicionais da Wiki.

### Filtros Granulares
O usuário pode filtrar os resultados por:
- **Processos e Serviços**: Páginas padrão da wiki.
- **Permissões**: Consultas diretas na base de permissões TBDC.
- **Novidades**: Postagens feitas no sistema de updates.

### Implementação
- **Engine**: Modificado `server/modules/search/db/engine.js` para realizar buscas paralelas no banco.
- **GraphQL**: Extensão da query `search` com parâmetros `filterPermissions`, `filterPages` e `filterUpdates`.

## 📤 Exportação de Artigos
Adicionada funcionalidade de exportação sob demanda, disponível diretamente no cabeçalho da página.

### Formatos Suportados
- **PDF**: Documento pronto para impressão/distribuição.
- **DOCX**: Word.
- **XLSX / CSV**: Planilhas de dados.
- **PPTX**: Apresentações de slides.

### Lógica
- **Helper**: `server/helpers/article-export.js` gerencia a geração dos arquivos em memória.
- **Rota**: `/x/:format/:locale/*` processa o download sem salvar arquivos físicos no servidor.
