# Guia de Operação, Publicação e Manutenção — NoobRPG

Este documento consolida os procedimentos para inicialização local, configuração de variáveis de ambiente, migração de banco de dados, publicação em produção e solução de problemas.

---

## 1. Pré-Requisitos do Sistema

- **Node.js:** versão 22.x LTS ou superior.
- **npm:** versão 10.x ou superior (com suporte a `npm workspaces`).
- **Git:** instalado e configurado.
- **Banco de Dados:**
  - Desenvolvimento: SQLite (gerado automaticamente em `packages/server/noobrpg.sqlite`).
  - Produção: PostgreSQL 14+ ou cluster compatível (com suporte a transações ACID).

---

## 2. Inicialização do Ambiente de Desenvolvimento

Execute os serviços em terminais separados no diretório raiz do projeto:

### 2.1 Backend (Servidor Express + WebSocket a 20 Hz)
```powershell
npm --workspace=@noobrpg/server run dev
```
- Endpoint HTTP: `http://localhost:4000/api`
- Endpoint WebSocket: `ws://localhost:4000/ws`
- Health check: `http://localhost:4000/api/health`

### 2.2 Frontend (Vite + Phaser 3)
```powershell
npm run dev
# ou
npm --workspace=@noobrpg/client run dev
```
- Aplicação web acessível em: `http://localhost:3000`

### 2.3 Exposição Externa via Cloudflare Tunnel (Opcional)
Para permitir que amigos ou testadores remotos acessem o backend local com HTTPS/WSS:
```powershell
npm run tunnel
```
O console exibirá uma URL pública (ex: `https://<nome-aleatorio>.trycloudflare.com`).

---

## 3. Variáveis de Ambiente

As variáveis de ambiente devem ser configuradas nos respectivos arquivos `.env` ou nas configurações do provedor de hospedagem:

### 3.1 Cliente Web (`packages/client/.env`)
| Variável | Exemplo de Valor | Descrição |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://api.meudominio.com/api` ou `/api` | URL base da API REST do backend. Em dev local, o proxy do Vite já encaminha `/api` para a porta 4000. |
| `VITE_WS_URL` | `wss://api.meudominio.com/ws` | URL do servidor WebSocket. Em produção no Cloudflare Pages, esta variável é **obrigatória**. |
| `VITE_ASSETS_BASE_URL` | `./assets` ou `https://cdn.meudominio.com/assets` | URL base para carregamento de spritesheets e mapas. |

### 3.2 Servidor Backend (`packages/server/.env`)
| Variável | Exemplo de Valor | Descrição |
| :--- | :--- | :--- |
| `PORT` | `4000` | Porta TCP onde o Express e o WebSocket ouvirão. |
| `NODE_ENV` | `production` ou `development` | Define comportamento de cookies seguros (`Secure`) e logs. |
| `CLIENT_ORIGIN` | `https://noobrpg.pages.dev,http://localhost:3000` | Lista de origens autorizadas separadas por vírgula para CORS e upgrade de WebSocket (Anti-CSWSH). |
| `DATABASE_URL` | `postgres://usuario:senha@host:5432/noobrpg` | String de conexão com o PostgreSQL (se omitida, o servidor utiliza SQLite automaticamente). |

---

## 4. Banco de Dados e Migrações

O servidor possui um executor de migrações idempotente em [`packages/server/src/db/migrationRunner.ts`](file:///d:/NoobRPG/packages/server/src/db/migrationRunner.ts).

As migrações são aplicadas automaticamente na inicialização do servidor em ordem sequencial:
1. `001_create_accounts.sql`: Contas e credenciais com hash Argon2id.
2. `002_create_characters.sql`: Personagens com constraint `CHECK (gold >= 0)`.
3. `003_create_inventory_and_equipment.sql`: Inventário de 24 slots e slots de equipamento.
4. `004_create_gold_ledger.sql`: Livro-razão financeiro com constraint `CHECK (balance_after >= 0)`.
5. `005_create_sessions.sql`: Sessões criptográficas com expiração de 7 dias.
6. `006_add_character_version_and_anti_tamper.sql`: Coluna `version` para controle de concorrência otimista.

### Backup e Recuperação
- **SQLite (Dev):** Fazer cópia de segurança do arquivo `packages/server/noobrpg.sqlite`.
- **PostgreSQL (Prod):**
  ```bash
  # Backup
  pg_dump -Fc noobrpg > backup_noobrpg_$(date +%Y%m%d).dump
  # Restauração
  pg_restore -d noobrpg backup_noobrpg_*.dump
  ```

---

## 5. Publicação no Cloudflare Pages (Frontend)

O frontend do NoobRPG está preparado para hospedagem estática no Cloudflare Pages:

1. **Configuração de Build no Cloudflare Pages:**
   - **Framework Preset:** Vite
   - **Build Command:** `npm --workspace=@noobrpg/shared run build && npm --workspace=@noobrpg/client run build`
   - **Build Output Directory:** `packages/client/dist`
   - **Node.js Version:** `22.x`
2. **Variáveis de Ambiente de Produção:**
   - Adicionar no painel do Cloudflare Pages:
     - `VITE_API_URL`: URL pública com `/api` (ex: `https://meu-servidor.com/api` ou URL do túnel Cloudflare).
     - `VITE_WS_URL`: URL pública WebSocket (ex: `wss://meu-servidor.com/ws` ou `wss://meu-tunel.trycloudflare.com/ws`).

---

## 6. Diagnóstico e Solução de Problemas (Troubleshooting)

### Problema: "Servidor multiplayer não acessível" ou tela operando offline
- **Causa:** O cliente não conseguiu estabelecer a conexão WebSocket no endereço configurado.
- **Solução:**
  1. Verifique se o servidor backend está rodando (`http://localhost:4000/api/health`).
  2. Em produção no Cloudflare Pages, certifique-se de que a variável `VITE_WS_URL` foi configurada na dashboard e o deploy foi reexecutado.
  3. No chat do jogo, o sistema exibirá o endereço exato que falhou (ex: `wss://noobrpg.pages.dev:4000/ws`).

### Problema: Erro 403 Forbidden no salvamento HTTP
- **Causa:** O cliente tentou enviar alterações de `goldChange` ou `xpGained` via REST.
- **Solução:** O jogo adota Zero Client Trust; Gold e XP são creditados exclusivamente pela simulação autoritativa do servidor.

### Problema: "Origem não autorizada pela política de CORS"
- **Causa:** O domínio do frontend não está incluído na variável `CLIENT_ORIGIN` do backend.
- **Solução:** Adicione o domínio ao `.env` do servidor (ex: `CLIENT_ORIGIN=https://noobrpg.pages.dev`).
