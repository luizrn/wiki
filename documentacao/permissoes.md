# Sistema de Permissões TBDC

Infraestrutura para gestão de acessos e master data das empresas do grupo TBDC.

## 💼 Estrutura de Dados
O sistema organiza as permissões em quatro níveis:
1.  **Empresas**: Cadastro de clientes/empresas.
2.  **Produtos**: Softwares ou serviços (ex: TBDC App).
3.  **Módulos**: Funcionalidades específicas de um produto.
4.  **Staff**: Colaboradores vinculados às regras.

## 🔑 Funcionalidades
- **Gestor de Master Data**: Aba central de administração para Produtos, Módulos e Staff.
- **Grid de Empresas**: Visualização consolidada de todas as empresas e suas permissões ativas.
- **Filtros Avançados**: Busca rápida por empresa, módulo ou status da permissão.
- **Cadastro Guiado**: Formulário passo-a-passo para registro de novas empresas e regras.

## 🔧 Componentes Chave
- `admin-tbdc-master.vue`: Gestão de tabelas base.
- `admin-tbdc-companies-edit.vue`: Editor de empresas e regras.
- `tbdc_permissions`: Tabela central que vincula todas as entidades.
