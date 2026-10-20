# NOOBCOIN — RUNBOOK OPERACIONAL DO WORKER SOLANA DEVNET
## Projeto NoobRPG | Antigravity Pro | Missão 30

Este guia detalha o procedimento seguro de operação, monitoramento e resposta a incidentes do worker de distribuição do NoobCoin na rede de testes da Solana (Devnet).

---

## 1. Configuração de Variáveis de Ambiente

Crie o arquivo `.env.worker` no diretório `packages/solana-worker/` (nunca versione este arquivo no Git):

```ini
# Configuração Obrigatória de Rede
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_COMMITMENT=confirmed

# Identificador da Mint de Teste (Criada após o Gate de Aprovação)
NOOB_TEST_MINT_ADDRESS=

# Caminho para o Keypair de Teste da Devnet (Formato JSON de Array de Bytes)
SOLANA_PAYER_KEYPAIR_PATH=./secrets/devnet-payer-keypair.json

# Parâmetros Operacionais
WORKER_POLL_INTERVAL_MS=5000
WORKER_BATCH_SIZE=10
WORKER_MAX_RETRIES=3
WORKER_DRY_RUN=false
```

---

## 2. Procedimento de Preparação da Carteira de Teste (Devnet Faucet)

1. Gere um Keypair exclusivo para a Devnet:
   ```bash
   solana-keygen new --outfile packages/solana-worker/secrets/devnet-payer-keypair.json --no-bip39-passphrase
   ```
2. Obtenha SOL de teste gratuitamente via faucet oficial da Devnet:
   ```bash
   solana airdrop 2 <PUBLIC_KEY_GERADA> --url https://api.devnet.solana.com
   ```
3. Verifique o saldo:
   ```bash
   solana balance <PUBLIC_KEY_GERADA> --url https://api.devnet.solana.com
   ```

---

## 3. Inicialização e Monitoramento do Worker

Para iniciar o worker em modo de desenvolvimento isolado:
```bash
cmd /c npm run dev --workspace=@noobrpg/solana-worker
```

Para executar a suíte automatizada de testes do worker (com mocks e simulações de falhas):
```bash
cmd /c npm run test --workspace=@noobrpg/solana-worker
```

---

## 4. Procedimentos de Emergência e Resposta a Incidentes

### 4.1 Pausa Imediata de Emergência (Kill Switch)
Caso seja observada qualquer anomalia no processamento ou reporte de falhas de RPC:
1. Acesse o banco de dados do jogo e ative a flag de pausa:
   ```sql
   UPDATE noobcoin_config SET value = '1' WHERE key = 'distribution_paused';
   ```
2. O servidor de jogo rejeita imediatamente a aprovação de novas recompensas.
3. Encerre o processo do worker via sinal `SIGINT` (Ctrl+C). Nenhuma transação pendente em `SUBMITTED` será corrompida.

### 4.2 Recuperação de Operações Pendentes em SUBMITTED
Se o worker for interrompido durante o envio de uma transação:
1. O registro permanece em `SUBMITTED` com o hash `onchain_tx_signature`.
2. Ao reiniciar o worker, o primeiro passo executado é a **Reconciliação Preventiva**, que consulta o nó RPC da Solana antes de tentar enviar qualquer novo lote.
3. Se a assinatura já foi minerada no bloco da Devnet, o worker atualiza o status para `CONFIRMED`.
4. Se a assinatura expirou sem ser minerada, o worker cancela a tentativa e autoriza reenvio seguro sem duplicação de saldo.
