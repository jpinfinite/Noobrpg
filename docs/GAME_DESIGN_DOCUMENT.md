# Game Design Document (GDD) — NoobRPG

## 1. Visão Geral do Produto
- **Título Provisório:** NoobRPG
- **Gênero:** RPG 2D Top-Down Online Persistente (Sandbox / Theme-park híbrido)
- **Plataforma:** Navegadores Web (Desktop-first com suporte a telas responsivas)
- **Público-alvo:** Jogadores casuais a dedicados de RPGs clássicos de exploração, coleta, crafting e comércio.
- **Diferencial:** Curva de progressão determinística e justa, economia viva orientada por comércio de jogadores (5% marketplace fee), arte pixel art nostálgica e arquitetura server-authoritative segura sem client trust.

---

## 2. Pilares de Gameplay
1. **Identidade e Papel de Classe:** Quatro classes jogáveis com sinergia para grupo e viabilidade 100% solo.
2. **Ciclo Central de Recompensa (Core Loop):**
   - Explorar mapas e masmorras -> Combater monstros e bosses -> Coletar recursos do ambiente -> Fabricar equipamentos (Crafting) -> Negociar no Mercado -> Evoluir níveis e atributos.
3. **Economia Viva e Confiável:** Gold gerado de forma controlada com sumidouros (sinks) balanceados e mercado entre jogadores com taxa de 5%.
4. **Segurança e Integridade Server-Authoritative:** O cliente apenas renderiza o estado e envia intenções de comando; o servidor valida todas as regras, danos, drops e transações financeiras.

---

## 3. As Quatro Classes Jogáveis

### 3.1 Guerreiro (Warrior)
- **Papel:** Tanque de combate corpo a corpo (Melee Bruiser / Frontliner).
- **Atributos Iniciais:**
  - HP: 120 | MP: 30
  - Ataque: 12 | Defesa: 8 | Velocidade: 90 px/s
  - Alcance: 32 px (1 tile) | Intervalo de Ataque: 1.0s
- **Crescimento por Nível:**
  - HP +15 | MP +2 | Ataque +2 | Defesa +2
- **Habilidades:**
  1. *Golpe Pesado (Heavy Strike)*: Causa 150% do dano físico e atordoa o alvo por 0.8s (Cooldown: 6s).
  2. *Grito Provocador (War Cry)*: Aumenta a defesa em +30% por 8s e força monstros na área a atacá-lo (Cooldown: 15s).
  3. *Redemoinho de Aço (Whirlwind)* (Nível 10+): Ataque circular em área de 48px causando 120% do dano a até 4 alvos (Cooldown: 10s).
- **Equipamentos:** Espadas, machados, escudos, armaduras de placas e malha.
- **Forças e Fraquezas:** Alta sobrevivência e controle de combate corpo a corpo; baixa mobilidade e vulnerável a ataques à distância (kiting).

### 3.2 Arqueiro (Ranger)
- **Papel:** Dano físico à distância sustentado e mobilidade (Ranged DPS / Scout).
- **Atributos Iniciais:**
  - HP: 80 | MP: 40
  - Ataque: 14 | Defesa: 4 | Velocidade: 110 px/s
  - Alcance: 160 px (5 tiles) | Intervalo de Ataque: 0.8s
- **Crescimento por Nível:**
  - HP +8 | MP +4 | Ataque +3 | Defesa +1
- **Habilidades:**
  1. *Disparo Preciso (Aimed Shot)*: Disparo de alta velocidade causando 180% de dano com chance crítica aumentada (Cooldown: 5s).
  2. *Salto Evasivo (Tumble)*: Desloca-se 64px na direção oposta ao cursor e ganha +20% de velocidade por 2s (Cooldown: 8s).
  3. *Chuva de Flechas (Arrow Volley)* (Nível 10+): Bombardeia uma área circular de 64px causando 60% de dano por segundo por 3s (Cooldown: 12s).
- **Equipamentos:** Arcos, bestas, adagas leves, armaduras de couro.
- **Forças e Fraquezas:** Excelente kiting e dano monoponto à distância; baixa vida e vulnerável se encurralado.

### 3.3 Mago (Mage)
- **Papel:** Dano elemental em área e controle de grupo (AoE Burst / Controller).
- **Atributos Iniciais:**
  - HP: 70 | MP: 100
  - Ataque: 16 (Poder Mágico) | Defesa: 3 | Velocidade: 95 px/s
  - Alcance: 128 px (4 tiles) | Intervalo de Ataque: 1.2s
- **Crescimento por Nível:**
  - HP +6 | MP +12 | Ataque +3.5 | Defesa +0.8
- **Habilidades:**
  1. *Bola de Fogo (Fireball)*: Projétil que explode ao impacto em 40px causando 160% de dano de fogo (Cooldown: 4s).
  2. *Nova Congelante (Frost Nova)*: Explosão radial de gelo que enraíza inimigos por 1.5s e causa 80% de dano (Cooldown: 10s).
  3. *Barreira Arcana (Arcane Ward)* (Nível 10+): Cria escudo absorvendo dano igual a 200% do poder mágico por 6s (Cooldown: 20s).
- **Equipamentos:** Cajados, varinhas, tomos, túnicas de tecido.
- **Forças e Fraquezas:** Dano catastrófico em grupo e alcance; dependência extrema de mana e defesa física mínima.

### 3.4 Druida (Druid)
- **Papel:** Suporte híbrido, sustentação e versatilidade (Support / Off-tank / Healer).
- **Atributos Iniciais:**
  - HP: 95 | MP: 70
  - Ataque: 10 | Defesa: 5 | Velocidade: 100 px/s
  - Alcance: 96 px (3 tiles) | Intervalo de Ataque: 1.0s
- **Crescimento por Nível:**
  - HP +11 | MP +7 | Ataque +2 | Defesa +1.5
- **Habilidades:**
  1. *Bênção da Natureza (Rejuvenation)*: Regenera 25% do HP máximo de si ou de um aliado ao longo de 5s (Cooldown: 8s).
  2. *Raízes Espinhosas (Entangling Briars)*: Retarda inimigos em 50% em uma linha reta causando dano periódico (Cooldown: 9s).
  3. *Forma de Fera (Beast Form)* (Nível 10+): Transforma-se temporariamente em Urso (defesa +50%) ou Leopardo (velocidade +35%) por 15s (Cooldown: 30s).
- **Equipamentos:** Maças, bastões, talismãs, armaduras de couro e madeira tratada.
- **Forças e Fraquezas:** Autossuficiência extrema e excelente sinergia de equipe; dano de pico menor do que DPS puros.

---

## 4. Estrutura do Mundo e Mapas
- **Mundo em Blocos de Regiões:**
  1. *Aldeia Inicial (Havenbrook)*: Zona segura (Safe Zone), lojas de NPCs, armazém, bancadas de crafting, praça do mercado e área de treino.
  2. *Bosque Sussurrante (Whispering Woods)*: Níveis 1 a 5. Monstros: Slimes, Ratos selvagens, Lobos. Recursos: Madeira comum, ervas, pedras simples.
  3. *Minas Abandonadas (Forgotten Caverns)*: Níveis 6 a 10. Monstros: Morcegos, Goblins mineiros, Golens de pedra. Recursos: Minério de ferro, cobre, gemas brutas.
  4. *Pântano Sombrio (Murkwood Mire)*: Níveis 11 a 15. Monstros: Aranhas venenosas, Mortos-vivos, Nagas. Recursos: Couro espesso, plantas venenosas, fungos mágicos.
- **Propriedades dos Tiles:** Colisão, grama navegável, água profunda (bloqueia movimento), zona de teletransporte entre mapas e zonas de pesca/coleta.

---

## 5. Profissões e Coleta
1. **Mineração (Mining):** Picaretas usadas em veios de minério espalhados pelo mapa (Gera Minério de Cobre, Ferro, Prata).
2. **Herbologia (Herbalism):** Coleta de plantas selvagens para alquimia de poções de cura e mana.
3. **Madeireira (Woodcutting):** Machados em árvores do cenário para obtenção de madeira de construção e cabos de armas.
4. **Agricultura (Farming):** Pequenos canteiros em áreas dedicadas para cultivo de sementes e ingredientes alimentares com ciclo de tempo real.
5. **Crafting (Ferraria / Alfaiataria / Alquimia):** Receitas que combinam recursos brutos + refino + pequena taxa de Gold para criar equipamentos e consumíveis comercializáveis.

---

## 6. Missões e Conquistas
- **Quests Principais (Storyline):** Guiam o jogador pelas regiões, ensinando mecânicas e desbloqueando novos pontos de viagem rápida.
- **Quests Diárias/Repetíveis (Bounties):** Limite diário por conta (3 a 5 missões) para evitar abuso, concedendo Gold e Pontos de Mérito.
- **Conquistas:** Marcas de exploração ("Derrotou 100 Goblins", "Coletou 500 Minérios") que desbloqueiam títulos visuais e cosméticos não-negociáveis.
