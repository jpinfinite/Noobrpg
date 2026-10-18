# Combate, Atributos e Balanceamento — NoobRPG

## 1. Modelo Matemático de Progressão e XP

### 1.1 Fórmulas Canônicas
O sistema utiliza a curva de progressão definida no Master Prompt:

$$\text{XP\_total}(L) = 100 \times (L - 1)^2 + 400 \times (L - 1)$$

$$\text{XP\_para\_proximo\_nivel}(L) = \text{XP\_total}(L + 1) - \text{XP\_total}(L) = 200 \times (L - 1) + 500$$

- **Nível Máximo Inicial Recomendado (Cap de Lançamento):** Nível **30** (expansível via configuração no backend).

### 1.2 Tabela de Progressão de XP e Tempo Médio Estimado

| Nível ($L$) | XP Total Acumulado | XP para Próximo Nível | Média de Monstros Iguais ($L$) | Tempo Estimado no Nível |
| :---: | :---: | :---: | :---: | :---: |
| **1** | 0 | 500 | 20 mobs (25 XP cada) | ~ 5 a 10 min |
| **2** | 500 | 700 | 20 mobs (35 XP cada) | ~ 10 a 15 min |
| **3** | 1.200 | 900 | 20 mobs (45 XP cada) | ~ 15 a 20 min |
| **4** | 2.100 | 1.100 | 20 mobs (55 XP cada) | ~ 20 a 25 min |
| **5** | 3.200 | 1.300 | 20 mobs (65 XP cada) | ~ 25 a 35 min |
| **6** | 4.500 | 1.500 | 20 mobs (75 XP cada) | ~ 35 a 45 min |
| **7** | 6.000 | 1.700 | 20 mobs (85 XP cada) | ~ 45 a 60 min |
| **8** | 7.700 | 1.900 | 20 mobs (95 XP cada) | ~ 60 a 75 min |
| **9** | 9.600 | 2.100 | 20 mobs (105 XP cada) | ~ 75 a 90 min |
| **10** | 11.700 | 2.300 | 20 mobs (115 XP cada) | ~ 90 a 120 min |
| **15** | 25.200 | 3.300 | 20 mobs (165 XP cada) | ~ 2 a 3 horas |
| **20** | 43.700 | 4.300 | 20 mobs (215 XP cada) | ~ 4 a 5 horas |
| **30** | 95.700 | 6.300 | 20 mobs (315 XP cada) | ~ 8 a 10 horas |

### 1.3 Regras de Distribuição de XP e Proteção contra Farming Abusivo
1. **Diferença de Nível (Level Delta Penalty):**
   - Monstros com mais de **5 níveis abaixo** do jogador sofrem redução drástica de XP:
     - Diferença de 1 a 4 níveis abaixo: 100% XP.
     - 5 níveis abaixo: 50% XP.
     - 6 a 9 níveis abaixo: 20% XP.
     - 10+ níveis abaixo: **0 XP** (evita bots farmando áreas iniciais infinitamente).
2. **Distribuição em Grupo (Party System):**
   - Bônus de cooperação: $+10\%$ de XP extra por membro do grupo próximo (raio de 300px).
   - A soma do XP é dividida igualmente entre os membros elegíveis próximos ao abate.

---

## 2. Sistema e Fórmulas de Combate

### 2.1 Fórmula de Dano Básico e Variações
A base do cálculo físico é:

$$\text{Dano\_Bruto} = \text{Ataque\_Efetivo} \times (1 \pm \text{Variância}_{10\%})$$

$$\text{Dano\_Final} = \max\left(1, \text{Dano\_Bruto} - \text{Defesa\_Efetiva}\right)$$

- **Dano Crítico:**
  - Chance Crítica padrão: $5\%$ base + bônus de itens/atributos.
  - Multiplicador Crítico: $\text{Dano\_Final} \times 1.50$ (ou $2.00$ para Arqueiro especializado).
- **Redução Mágica / Resistência Elemental:**
  - Resistência (\%) reduz dano de feitiços de forma multiplicativa:
    $$\text{Dano\_Mágico} = \max\left(1, \text{Poder\_Mágico} \times (1 - \text{Resistência\_Elemental})\right)$$

### 2.2 Atributos e Escalonamento das Quatro Classes

| Classe | HP Base + Por Nível | MP Base + Por Nível | Ataque Físico/Mágico | Defesa | Velocidade Mov. | Alcance / CD Ataque |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Guerreiro** | $120 + 15 \times (L-1)$ | $30 + 2 \times (L-1)$ | $12 + 2.0 \times (L-1)$ | $8 + 2.0 \times (L-1)$ | 90 px/s | 32 px (1.0s CD) |
| **Arqueiro** | $80 + 8 \times (L-1)$ | $40 + 4 \times (L-1)$ | $14 + 3.0 \times (L-1)$ | $4 + 1.0 \times (L-1)$ | 110 px/s | 160 px (0.8s CD) |
| **Mago** | $70 + 6 \times (L-1)$ | $100 + 12 \times (L-1)$ | $16 + 3.5 \times (L-1)$ | $3 + 0.8 \times (L-1)$ | 95 px/s | 128 px (1.2s CD) |
| **Druida** | $95 + 11 \times (L-1)$ | $70 + 7 \times (L-1)$ | $10 + 2.0 \times (L-1)$ | $5 + 1.5 \times (L-1)$ | 100 px/s | 96 px (1.0s CD) |

---

## 3. Matriz de Simulação de Combate

### 3.1 Amostra de Monstros por Faixa de Nível

| Monstro | Nível | HP | Ataque | Defesa | XP Drop | Gold Drop |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Slime Verde** | 1 | 35 | 5 | 1 | 25 | 1 - 3 |
| **Rato Selvagem** | 2 | 55 | 8 | 2 | 35 | 2 - 5 |
| **Lobo da Floresta** | 3 | 85 | 12 | 4 | 45 | 4 - 8 |
| **Goblin Soldado** | 5 | 160 | 18 | 8 | 65 | 8 - 15 |
| **Golen de Pedra (Elite)** | 10 | 550 | 38 | 22 | 230 | 35 - 60 |

### 3.2 Cenários Críticos de Teste

1. **Personagem Nível 1 vs Monstro Nível 1 (Slime Verde):**
   - Guerreiro L1: Dano por golpe = $12 - 1 = 11$. Golpes necessários: $\lceil 35 / 11 \rceil = 4$ ataques (~4.0s).
   - Slime L1 causa $5 - 8 = -3 \rightarrow 1$ de dano mínimo. Dano no Guerreiro: 4 de dano total ($3\%$ do HP).
   - *Resultado:* Combate justo, intuitivo e seguro para aprendizado inicial.

2. **Personagem Nível 1 vs Monstro Nível 10 (Golen de Pedra):**
   - Guerreiro L1: Dano por golpe = $\max(1, 12 - 22) = 1$ de dano mínimo.
   - Golpes necessários para matar o Golen: **550 ataques** (550 segundos ininterruptos).
   - Golen L10 no Guerreiro L1: Dano por golpe = $38 - 8 = 30$ de dano.
   - Com 120 HP, o Guerreiro morre em exatamente **4 golpes** (~4.8 segundos).
   - *Conclusão:* **Impossível para um jogador nível 1 solar um monstro nível 10**, garantindo a integridade da progressão e impedindo explorações absurdas de bugs.

3. **Personagem Nível 5 vs Monstro Nível 5 (Goblin Soldado):**
   - Guerreiro L5 (HP: 180, Atq: 20, Def: 16):
     - Causa ao Goblin: $20 - 8 = 12$ de dano. Golpes: $\lceil 160 / 12 \rceil = 14$ ataques (~14s, ou ~8s usando habilidades).
     - Goblin causa: $18 - 16 = 2$ de dano por ataque. Em 14s, causa ~14 de dano ($8\%$ do HP do Guerreiro).
   - Mago L5 (HP: 94, Poder Mágico: 30, Def: 6):
     - Bola de Fogo + Ataques: Dano de 40 a cada 4s. Derrota o Goblin em ~6s.
     - Se atingido: sofre $18 - 6 = 12$ de dano por golpe (perde $25\%$ do HP em 2 ataques).
     - *Conclusão:* Mago mata mais rápido, mas corre risco alto se não controlar a distância (kiting). Dinâmica de classes perfeitamente equilibrada.

---

## 4. Regras de Morte, Reaparecimento e Durabilidade
- **Ao atingir 0 HP:** O personagem entra em estado de incapacitação e retorna ao ponto de renascimento da última vila segura registrada.
- **Penalidade de Morte:**
  - Perda de $5\%$ da durabilidade dos equipamentos equipados (custo de reparo em Gold na forja).
  - Sem perda de XP ou perda de itens do inventário (evita frustração excessiva em jogos web).
  - Imunidade temporária a dano (Ghosting) por 3 segundos ao reaparecer na vila.
