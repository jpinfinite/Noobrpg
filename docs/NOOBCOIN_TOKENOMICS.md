# NOOBCOIN (NOOB) — DOCUMENTO FORMAL DE TOKENOMICS
## Projeto NoobRPG | Antigravity Pro | Missão 29

> [!WARNING]
> **AVISO IMPORTANTE DE CONFORMIDADE E SEGURANÇA:**
> Este documento representa uma **proposta de planejamento econômico e arquitetural preliminar**.
> O NoobCoin **NÃO FOI IMPLANTADO**, **NÃO POSSUI MINT REAL CRIADA**, **NÃO ESTÁ EM CIRCULAÇÃO**, **NÃO POSSUI POOLS DE LIQUIDEZ OU LISTAGEM EM CORRETORAS** e **NÃO CONSTITUI PROMESSA DE RENTABILIDADE, LUCRO OU INVESTIMENTO**.
> A alocação aqui apresentada é estritamente conceitual e **NÃO AUTORIZA a emissão, cunhagem ou transferência de quaisquer ativos on-chain**.

---

## 1. Configuração Planejada do Token

| Parâmetro | Definição de Engenharia | Observações de Governança |
| :--- | :--- | :--- |
| **Nome** | NoobCoin | Ativo de ecossistema e reputação do NoobRPG |
| **Símbolo Pretendido** | `NOOB` | Sujeito à verificação de disponibilidade e colisões de ticker |
| **Supply Máximo Planejado (Cap)** | **1.000.000.000 NOOB** | Limite absoluto programático e inalterável |
| **Decimais Propostos** | **6 (seis casas decimais)** | 1 NOOB = $1.000.000$ unidades mínimas (compatível com precisão SPL/Solana e USDC) |
| **Blockchain Alvo** | Solana | Alta taxa de transferência (TPS), finalidade subsegundo e taxas previsíveis |
| **Padrão em Avaliação** | SPL Token original vs. Token-2022 | Ver comparativo técnico completo em [NOOBCOIN_DEVNET_PLAN.md](file:///d:/NoobRPG/NOOBCOIN_DEVNET_PLAN.md) |
| **Distribuição Principal** | Recompensas do jogo (Game Rewards) | Submetida a tetos diários, prova de gameplay autoritativo e antifraude |
| **Conversão Ouro (Gold) $\leftrightarrow$ NOOB** | **ESTRITAMENTE DESATIVADA** | Sem taxa de conversão; sem câmbio direto para mitigar hiperinflação e farming |
| **Primeira Rede de Testes** | **Solana Devnet** | Apenas mediante aprovação humana explícita em missão posterior |
| **Mainnet** | **Fora de Escopo** | Condicionada a auditorias externas de contratos, segurança e conformidade legal |
| **Estado Atual do Ativo** | **Planejado (Off-chain Ledger Interno)** | Implementado apenas como livro-razão relacional no banco de dados |

---

## 2. Proposta Inicial de Alocação de Tokens

A tabela a seguir apresenta a proposta estrutural para submissão à diretoria e comunidade. **Esta alocação é provisória e não constitui direito adquirido ou distribuição definitiva:**

| Categoria de Alocação | Percentual Proposto | Quantidade Proposta (NOOB) | Quantidade em Unidades Mínimas (6 Decimais) | Finalidade e Mecanismo de Salvaguarda |
| :--- | :---: | :---: | :---: | :--- |
| **Recompensas do Jogo (Play & Earn)** | **40%** | **400.000.000** | $400.000.000.000.000$ | Temporadas competitivas, torneios de arena, abates de chefes globais e conquistas mestre. Emissão fracionada ao longo de 48 meses. |
| **Tesouraria & Desenvolvimento** | **20%** | **200.000.000** | $200.000.000.000.000$ | Custos de infraestrutura, servidores autoritativos, contratação de arte/devs e manutenção técnica. Vesting linear com cliff de 12 meses. |
| **Comunidade, Marketing & Eventos** | **15%** | **150.000.000** | $150.000.000.000.000$ | Airdrops controlados de teste, eventos temáticos, parcerias com criadores e expansão do ecossistema NoobRPG. |
| **Provisão de Liquidez Futura** | **15%** | **150.000.000** | $150.000.000.000.000$ | Reservado exclusivamente para garantir rotação saudável e emparelhamento em corretoras descentralizadas (DEX), caso e quando aprovado. |
| **Reserva de Segurança & Contingência** | **10%** | **100.000.000** | $100.000.000.000.000$ | Cobertura contra exploits, fundos de seguros, auditorias adicionais e compensação de emergência em incidentes. |
| **Total Global Planejado** | **100%** | **1.000.000.000** | $1.000.000.000.000.000$ | Teto inviolável |

---

## 3. Dinâmica de Suprimento: Circulante vs. Reservado

### 3.1 Fase Atual (Pré-Devnet / Engenharia Interna)
- **Supply Circulante Real On-Chain:** **$0$ NOOB** (Nenhum token emitido na blockchain).
- **Supply em Ledger Interno:** Rastreia exclusivamente pontos de auditoria em staging e testes unitários.
- **Supply Reservado:** **$1.000.000.000$ NOOB** em planejamento.

### 3.2 Cronograma Teórico de Liberação (Vesting e Desbloqueio Gradual)
Caso ocorra autorização formal para transição on-chain futura:
1. **Cliff de 12 Meses para Equipe e Tesouraria:** Nenhum token da categoria Tesouraria/Desenvolvimento poderá ser desbloqueado antes de 365 dias do lançamento oficial.
2. **Vesting Linear Contínuo:** Desbloqueio em parcelas mensais lineares ao longo de 36 meses ($1/36$ por mês) após o cliff.
3. **Curva de Decaimento de Recompensas (Halving por Época):**
   - Ano 1: Até 40% do pool de recompensas ($160.000.000$ NOOB).
   - Ano 2: Até 30% do pool de recompensas ($120.000.000$ NOOB).
   - Ano 3: Até 20% do pool de recompensas ($80.000.000$ NOOB).
   - Ano 4 em diante: Até 10% do pool de recompensas ($40.000.000$ NOOB) restante em modelo perpétuo estrito.

---

## 4. Política de Emissão e Regras de Recompensa

### 4.1 Separação Absoluta de Moedas (Gold vs. NOOB)
- **Gold do Jogo:**
  - Moeda fiduciária interna gerada por drops de monstros, venda a NPCs e missões locais.
  - Usada para custos do mundo (forja, poções, reparos, taxa de 5% de mercado).
  - **Não possui indexação financeira nem paridade fixa com o NOOB.**
  - **A conversão direta entre Gold e NOOB está permanentemente desativada.** Esta decisão protege a estabilidade do jogo contra hiperinflação interna provocada por macroscripts de farm.
- **NoobCoin (NOOB):**
  - Concedido exclusivamente por **eventos de alto mérito autoritativo**:
    1. Recompensas de encerramento de Temporada Competitiva (Season Rankings).
    2. Conclusão de Conquistas de Nível Mestre (Master Achievements).
    3. Torneios PvP sancionados pelo servidor.
    4. Eventos globais únicos com controle de emissão em lote.

### 4.2 Tetos Diários e por Temporada (Emission Caps)
Para mitigar riscos de drenagem por farming automatizado:
- **Teto Diário por Personagem (`daily_character_limit_raw`):** Máximo de **100 NOOB** ($100.000.000$ unidades mínimas) por ciclo de 24 horas.
- **Teto Diário por Conta (`daily_account_limit_raw`):** Máximo de **250 NOOB** ($250.000.000$ unidades mínimas) por ciclo de 24 horas, independentemente de quantos personagens a conta possua.
- **Teto Sazonal Global (Global Season Cap):** A soma de todas as emissões em uma temporada de 90 dias não poderá exceder a cota trimestral estipulada pela Tesouraria.

### 4.3 Tratamento de Tokens Não Distribuídos
- Tokens alocados para temporadas ou eventos que não forem reivindicados ou que sobrarem de orçamentos conservadores **NÃO SERÃO EMITIDOS LIVREMENTE**.
- Eles retornarão para o cofre de reserva da Tesouraria ou serão submetidos a queima programada após encerramento do ciclo anual.

---

## 5. Mecanismo de Queima (Burn Mechanisms) e Consequências

O tokenomics prevê a implementação de **sumidouros deflacionários (Deflationary Sinks)** para sustentabilidade de longo prazo:
1. **Taxa de Governança / Customização:** Desbloqueio de títulos exclusivos, cosméticos lendários e inscrições em torneios exigirão a queima permanente de tokens NOOB.
2. **Procedimento de Queima On-Chain:** Executado via instrução nativa SPL `Burn`, reduzindo o supply total em circulação de forma auditável e irreversível no explorador da Solana.
3. **Consequências Econômicas:**
   - Diminuição da oferta circulante.
   - Mitigação de pressões inflacionárias decorrentes de recompensas contínuas.
   - Transparência total via eventos `onchain_burn` registrados no livro-razão.

---

## 6. Riscos Econômicos e Proteções Antifraude

| Vetor de Risco | Impacto Potencial | Mecanismo de Blindagem no NoobRPG |
| :--- | :--- | :--- |
| **Ataque Sybil (Criação massiva de contas)** | Esgotamento de recompensas por fazendas de bots | Exigência de Nível Mínimo 5, tempo de jogo registrado ($\ge 24\text{h}$) e validação de hardware/IP no registro. |
| **Exploração de Race Conditions** | Duplicação de resgates de recompensas | Chaves de idempotência (`idempotency_key`) únicas e transações atômicas com lock no banco relacional. |
| **Hiperinflação de Tokens** | Perda abrupta de relevância do ativo | Tetos rígidos diários e sazonais verificados no backend antes de qualquer aprovação. |
| **Concentração Oligárquica** | Monopólio de governança por poucas carteiras (baleias) | Limites máximos de holding por carteira individual vinculada ao jogo e teto de recompensas por temporada. |
| **Desvio de Fluxo de Recompensa** | Injeção de requisições arbitrárias via cliente Phaser modificado | **Zero Client Trust:** O cliente apenas envia intenções de ação de jogo; o servidor autoritativo calcula e emite a recompensa. |

---

## 7. Governança da Mint Authority e Irreversibilidade

> [!CAUTION]
> **ATENÇÃO TÉCNICA SOBRE AUTORIDADE DE EMISSÃO (MINT AUTHORITY):**
> 1. Na blockchain Solana, a `mint_authority` possui o poder de emitir novos tokens até o supply limite.
> 2. Se a autoridade de emissão for revogada (renúncia definitiva via `spl-token authorize <mint> mint --disable`), **A OPERAÇÃO É 100% IRREVERSÍVEL**.
> 3. Uma vez revogada, **NUNCA MAIS SERÁ POSSÍVEL CUNHAR UM ÚNICO TOKEN NOOB**, fixando o supply máximo existente no momento da revogação.
> 4. **Decisão de Arquitetura:**
>    - Na fase inicial e Devnet, a `mint_authority` deve ser mantida em um cofre Multi-Sig (Squads Protocol) exigindo quórum de 3 de 5 signatários.
>    - A renúncia definitiva da autoridade de cunhagem só poderá ser deliberada após a distribuição programada completa de todos os 1.000.000.000 NOOB ou conforme auditoria final de mainnet.

---

## 8. Métricas para Modelagem e Simulação da Economia

Antes de qualquer implementação em rede pública, as seguintes métricas devem ser simuladas via modelos matemáticos (Monte Carlo):
1. **DAU / MAU (Daily / Monthly Active Users):** Relação de jogadores ativos gerando elegibilidade.
2. **Velocity of Token (Velocidade do Token):** Frequência com que o NOOB transita entre carteiras e sumidouros.
3. **Burn-to-Mint Ratio:** Proporção ideal de queima vs emissão para manter o equilíbrio econômico.
4. **Gini Coefficient:** Medição da distribuição de tokens entre jogadores ativos para prevenir hiperconcentração.

---

## 9. Critérios Obrigatórios para Revisão Pré-Mainnet

A transição da Solana Devnet para a Solana Mainnet dependerá dos seguintes marcos mandatórios:
- [ ] Auditoria completa de código do contrato inteligente / Token Program por firma de segurança independente.
- [ ] 90 dias ininterruptos de testes em Solana Devnet com simulação de carga sem falhas de reconciliação.
- [ ] Auditoria contábil e de concorrência com 0 divergências entre o ledger interno e a blockchain.
- [ ] Validação jurídica final com parecer formal emitido por escritório especializado em direito digital e valores mobiliários no Brasil.
- [ ] Aprovação humana explícita documentada em atas da liderança do NoobRPG.
