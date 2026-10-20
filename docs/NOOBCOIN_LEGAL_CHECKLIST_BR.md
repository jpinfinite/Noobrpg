# NOOBCOIN (NOOB) — CHECKLIST DE CONFORMIDADE JURÍDICA E REGULATÓRIA BRASILEIRA
## Projeto NoobRPG | Antigravity Pro | Missão 29

> [!WARNING]
> **AVISO LEGAL OBRIGATÓRIO (DISCLAIMER):**
> Este documento constitui um **roteiro técnico-consultivo de engenharia de software** elaborado para orientar consultas com **advogados e pareceristas habilitados**.
> **ESTE DOCUMENTO NÃO É UM PARECER JURÍDICO.**
> O NoobRPG **não declara que o NoobCoin está automaticamente isento de regulação por ser utilizado em um jogo eletrônico**.
> São estritamente proibidas quaisquer promessas públicas de valorização, lucro, rentabilidade, liquidez futura ou listagem em corretoras de criptoativos.

---

## 1. Enquadramento Regulatório e CVM (Valores Mobiliários)

| Item de Verificação | Base Legal e Regulamentar | Questão a Validar com Advogado Especialista | Status no Projeto |
| :--- | :--- | :--- | :---: |
| **Teste de Howey e Parecer de Orientação CVM nº 40/2022** | Lei nº 6.385/1976 (Art. 2º, IX) e Parecer CVM 40/22 | O NoobCoin se qualifica como Contrato de Investimento Coletivo (CIC)? Para mitigar esse risco: (i) não há venda pública ou captação antecipada de recursos; (ii) não há esforço de terceiros gerando expectativa de lucro passivo; (iii) o token atua unicamente como ativo de utilidade/mérito de gameplay. | **Em Análise Técnica** |
| **Classificação do Ativo** | Resoluções CVM e Marco Legal dos Criptoativos | Validação da classificação estrita como *Utility Token* (token de utilidade e reputação de ecossistema) e não *Security Token*. | **Pendente Parecer Externo** |
| **Proibição de Promessas Financeiras** | Código de Defesa do Consumidor e Normas CVM | Toda comunicação, documentação e interface de jogo deve abster-se de expressões como "investimento", "lucro", "rendimento" ou "retorno financeiro". | **Implementado nas Diretrizes** |

---

## 2. Marco Legal dos Criptoativos e Banco Central (BACEN)

| Item de Verificação | Base Legal e Regulamentar | Questão a Validar com Advogado Especialista | Status no Projeto |
| :--- | :--- | :--- | :---: |
| **Lei nº 14.478/2022 (Marco dos Criptoativos)** | Lei nº 14.478/2022 e Decretos Regulamentadores | O NoobRPG atua como Prestadora de Serviços de Ativos Virtuais (PSAV / VASP)? Como os tokens são de autocustódia do jogador (self-custody) e não há custódia terceirizada ou intermediação fiduciária, a equipe deve confirmar se há dispensa de licença PSAV perante o BACEN. | **Pendente Parecer Externo** |
| **Prevenção à Lavagem de Dinheiro (PLD/CFT)** | Lei nº 9.613/1998 e Resoluções COAF | Adoção de monitoramento de transações suspeitas e limites rígidos diários para mitigar riscos de lavagem de capitais dentro da economia do jogo. | **Mitigado via Tetos Diários** |

---

## 3. Marco Legal dos Games (Lei nº 14.852/2024)

| Item de Verificação | Base Legal e Regulamentar | Questão a Validar com Advogado Especialista | Status no Projeto |
| :--- | :--- | :--- | :---: |
| **Definição de Jogos Eletrônicos** | Art. 2º da Lei nº 14.852/2024 | O NoobRPG se enquadra plenamente no Marco Legal dos Games como jogo de computador multiplayer interativo. | **Conforme** |
| **Diferenciação de Jogos de Azar / Apostas (Bets)** | Decreto-Lei nº 3.688/1941 e Lei nº 14.790/2023 | O recebimento de NoobCoin decorre estritamente de **mérito, habilidade e desempenho competitivo em jogo** (skill-based gaming), **não havendo qualquer aposta fiduciária ou dependência de sorte/azar**, distanciando o projeto do regime de apostas de quota fixa. | **Conforme no Design** |
| **Proteção de Propriedade Intelectual** | Arts. 6º a 12 da Lei nº 14.852/2024 | Registro de código-fonte e marcas do NoobRPG e NoobCoin junto ao INPI. | **Planejado** |

---

## 4. Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018)

| Item de Verificação | Artigo da LGPD | Desafio Técnico-Jurídico e Solução Adotada | Status no Projeto |
| :--- | :--- | :--- | :---: |
| **Chave Pública como Dado Pessoal** | Art. 5º, I da LGPD | Uma chave pública associada a uma conta identificada pode constituir dado pessoal indireto. O NoobRPG deve tratar o vínculo com estrito consentimento do usuário. | **Mapeado** |
| **Direito à Eliminação vs. Imutabilidade Blockchain** | Art. 18, VI da LGPD | Transações na blockchain Solana são imutáveis e não podem ser apagadas. A solução técnica consiste em: **nenhum dado pessoal identificável (nome, e-mail, IP) é gravado na blockchain**. Se o usuário solicitar exclusão, a conta de jogo é anonimizada no banco relacional, tornando a chave pública na blockchain um dado totalmente pseudonimizado e dissociado. | **Arquitetura Aderente** |
| **Segurança e Encriptação** | Art. 46 da LGPD | Credenciais e sessões protegidas por Argon2id e cookies seguros; ausência total de chaves privadas pessoais no banco de dados. | **Implementado** |

---

## 5. Obrigações Fiscais e Tributárias (Receita Federal do Brasil)

| Item de Verificação | Norma Aplicável | Exigência Legal a Ser Acompanhada | Status no Projeto |
| :--- | :--- | :--- | :---: |
| **Instrução Normativa RFB nº 1.888/2019** | IN RFB 1888/19 | Avaliar a obrigatoriedade de prestação de informações à Receita Federal sobre operações com criptoativos caso o volume mensal de emissões e movimentações atinja os patamares previstos nas normas fiscais. | **Em Monitoramento** |
| **Tributação de Prêmios e Recompensas** | Regulamento do Imposto de Renda (RIR) | Verificar incidência de Imposto de Renda Retido na Fonte (IRRF) ou regime fiscal aplicável sobre premiações distribuídas em eventos e torneios competitivos. | **Pendente Parecer Contábil** |

---

## 6. Proteção ao Consumidor e Menores de Idade (CDC e ECA)

| Item de Verificação | Base Legal | Requisito de Conformidade Obrigatório | Status no Projeto |
| :--- | :--- | :--- | :---: |
| **Estatuto da Criança e do Adolescente (ECA)** | Lei nº 8.069/1990 e Art. 14 da LGPD | Caso o jogo admita menores de 18 anos, deve haver **consentimento específico dos pais/responsáveis legais** para a vinculação de carteiras e participação em atividades com tokens, ou restringir o subsistema de recompensas exclusivamente para usuários maiores de idade (18+). | **Recomendação: 18+ para Wallets** |
| **Transparência e Termos de Uso (CDC)** | Lei nº 8.078/1990 (Código do Consumidor) | Informações claras, inequívocas e em língua portuguesa sobre: volatilidade de ativos digitais, irreversibilidade de transações on-chain, inexistência de garantia de liquidez e canais formais de suporte e contestação. | **Em Elaboração** |
| **Direito de Encerramento e Rescisão** | Princípios Gerais de Direito Contratual | Cláusulas expressas regulando hipóteses de suspensão por fraude, banimento por uso de bots/hacks e manutenção do serviço. | **Em Elaboração** |
