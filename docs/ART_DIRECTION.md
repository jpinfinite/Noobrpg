# Direção de Arte e Pipeline Visual — NoobRPG

## 1. Visão Estética e Identidade Visual
O NoobRPG adota a estética clássica de **Pixel Art 2D Top-Down (perspectiva 3/4 clássica)**, combinando a nostalgia dos RPGs 16-bit com técnicas modernas de iluminação dinâmica, pós-processamento de partículas e legibilidade otimizada para monitores de alta resolução modernos.

---

## 2. Especificações de Resolução e Escala

### 2.1 Resolução Lógica (Virtual Canvas)
- **Resolução Nativa Interna:** `480 × 270` pixels (proporção widescreen 16:9 exata).
- **Escala de Exibição no Phaser:**
  - Telas 1080p (Full HD): Fator de escala inteiro **4×** (`1920 × 1080`).
  - Telas 1440p (2K): Fator de escala inteiro **5×** ou **6×** com barras laterais sutis (pixel-perfect letterboxing).
  - Telas 720p: Fator de escala inteiro **2×** ou **3×**.
- **Filtro de Renderização:**
  - CSS: `image-rendering: pixelated;` e `image-rendering: crisp-edges;`
  - Phaser Config: `pixelArt: true`, `roundPixels: true`, `antialias: false`.
  - Isso elimina borrões, artefatos e "shimmering" durante o movimento de câmera.

### 2.2 Tamanho de Grid e Tiles
- **Tamanho dos Tiles de Terreno:** `16 × 16` pixels.
  - *Justificativa:* Proporciona maior densidade no cenário, permite desenhar salas e masmorras compactas e mantém o escopo de produção de assets ágil e consistente.
- **Tamanho dos Personagens (Sprites):** `16 × 24` pixels ou `16 × 32` pixels (âncora no pé: `x: 0.5, y: 0.85`).
  - *Justificativa:* Personagens ligeiramente mais altos que um tile destacam-se visualmente do chão e exibem equipamentos (elmo, armadura, arma) com clareza.
- **Monstros:**
  - Pequenos (Slime, Rato): `16 × 16` pixels.
  - Médios (Goblin, Lobo, Guerreiro): `16 × 24` a `24 × 24` pixels.
  - Grandes / Chefes (Golen de Pedra, Dragão, Rainha Aranha): `48 × 48` a `64 × 64` pixels.

---

## 3. Paleta de Cores e Iluminação

### 3.1 Paleta Primária
- Paleta unificada baseada em **32 a 48 cores calibradas** (inspiração harmonizada em gamas naturais e vibrantes, evitando tons pretos ou brancos absolutos #000000 / #FFFFFF):
  - **Sombras:** Tons escuros puxados para azul-marinho e roxo profundo (`#1a1025`, `#241834`).
  - **Luz e Destaque:** Tons quentes e amarelados (`#fef3c7`, `#fed7aa`).
  - **Cores de Alerta e Vida:** Vermelho rubi para vida (`#e11d48`), Azul safira para mana (`#0284c7`), Amarelo âmbar para Gold (`#f59e0b`).

### 3.2 Contorno e Sombreamento
- **Outlines (Contornos):** Contornos escuros seletivos (*selective outlining* ou *sel-out*), nunca contorno preto puro uniforme.
- **Iluminação e Ciclo Dia/Noite:**
  - Shader de tint em Phaser (`Pipeline` ou overlay de canvas com modo de mesclagem `multiply`) para transição suave de 24 minutos por dia virtual (amanhecer dourado, meio-dia vívido, entardecer alaranjado, noite azulada).
  - Tochas e cristais emitem luz pontual com blend mode `ADD`.

---

## 4. Guia de Animação e Taxa de Quadros

### 4.1 Direções dos Sprites
- 4 Direções cardinais: **Baixo (Sul)**, **Cima (Norte)**, **Direita (Leste)**.
- A direção **Esquerda (Oeste)** é gerada espelhando o eixo X da direção Leste (`flipX = true`), otimizando espaço de textura e tempo de produção de sprites.

### 4.2 Tabela de Ciclos de Animação
| Animação | Quadros por Direção | Taxa (FPS) | Descrição |
| :--- | :--- | :--- | :--- |
| **Idle (Respiração)** | 2 a 4 quadros | 4 fps | Micro-movimento sutil de peito e ombros. |
| **Walk (Caminhada)** | 4 a 6 quadros | 8 fps | Ciclo completo de passos com oscilação da cabeça. |
| **Attack (Ataque Básico)** | 3 a 4 quadros | 12 fps | Quadro de antecipação (1), quadro de impacto/swing (2), recuperação (3-4). |
| **Cast (Conjuração)** | 3 quadros | 6 fps | Personagem eleva o braço/cajado com brilho de partículas. |
| **Hurt (Dano sofrido)** | 1 a 2 quadros | 10 fps | Flash avermelhado ou branco com leve recuo. |
| **Death (Morte)** | 4 quadros | 8 fps | Desabamento ao solo com fumaça sutil no quadro final. |

---

## 5. Diretrizes de Interface (UI/UX)
- **Estilo:** *Clean Pixel Interface* — janelas com molduras de madeira tratada ou metal escuro, cantos arredondados de 2px, fundo semitransparente (90% opacidade) para não obstruir o perigo ao redor.
- **Tipografia:** Fonte bitmap pixel-perfect legível em tamanhos 8px e 16px (ex: `Silkscreen`, `Press Start 2P` ou `Silver Pixel Font`).
- **Feedback Visual Instantâneo:**
  - Hover em botões e itens com borda dourada piscante.
  - Textos flutuantes de combate:
    - Dano normal sofrido pelo inimigo: Branco (`#ffffff`).
    - Dano crítico: Amarelo grande com exclamação (`#facc15`).
    - Cura recebida: Verde esmeralda (`#22c55e`).
    - Dano sofrido pelo jogador: Vermelho intenso (`#ef4444`).

---

## 6. Convenção de Nomes e Estrutura de Arquivos

Todos os assets seguem o padrão snake_case com prefixos semânticos estritos:

```plaintext
assets/
├── sprites/
│   ├── heroes/
│   │   ├── hero_warrior_sheet.png
│   │   ├── hero_ranger_sheet.png
│   │   ├── hero_mage_sheet.png
│   │   └── hero_druid_sheet.png
│   ├── monsters/
│   │   ├── mob_slime_green.png
│   │   ├── mob_goblin_warrior.png
│   │   └── mob_golem_rock.png
│   └── npcs/
│       ├── npc_merchant_shop.png
│       └── npc_blacksmith.png
├── tilesets/
│   ├── tileset_grassland_16x16.png
│   ├── tileset_dungeon_16x16.png
│   └── tileset_village_interior_16x16.png
├── maps/
│   ├── map_havenbrook_village.json
│   └── map_whispering_woods.json
├── ui/
│   ├── ui_dialog_box.png
│   ├── ui_inventory_slot.png
│   ├── ui_health_bar.png
│   └── ui_icons_items.png
└── audio/
    ├── sfx_sword_swing.wav
    ├── sfx_arrow_shot.wav
    ├── sfx_hit_impact.wav
    └── bgm_village_peaceful.ogg
```
