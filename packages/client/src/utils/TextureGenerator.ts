import Phaser from 'phaser';

export class TextureGenerator {
  public static generateAll(scene: Phaser.Scene): void {
    if (!scene.textures.exists('tileset_prototype')) {
      this.generateTileset(scene);
    }
    // 4 Classes de heróis com silhuetas, adereços e armas exclusivas
    if (!scene.textures.exists('hero_warrior')) {
      this.generateWarriorSpritesheet(scene);
    }
    if (!scene.textures.exists('hero_ranger')) {
      this.generateRangerSpritesheet(scene);
    }
    if (!scene.textures.exists('hero_mage')) {
      this.generateMageSpritesheet(scene);
    }
    if (!scene.textures.exists('hero_druid')) {
      this.generateDruidSpritesheet(scene);
    }

    // Props básicos
    if (!scene.textures.exists('prop_tree')) {
      this.generateTreeProp(scene);
    }
    if (!scene.textures.exists('prop_tree_trunk')) {
      this.generateTreeSeparatedProps(scene);
    }
    if (!scene.textures.exists('prop_pillar')) {
      this.generatePillarProp(scene);
    }

    // Monstros
    if (!scene.textures.exists('mob_slime')) {
      this.generateSlimeSpritesheet(scene);
    }
    if (!scene.textures.exists('mob_goblin')) {
      this.generateGoblinSpritesheet(scene);
    }
    if (!scene.textures.exists('mob_skeleton')) {
      this.generateSkeletonSpritesheet(scene);
    }

    // Efeitos visuais de combate (FX) — Fase 2.2
    if (!scene.textures.exists('fx_slash')) {
      this.generateSlashFx(scene);
    }
    if (!scene.textures.exists('fx_projectile')) {
      this.generateProjectileFx(scene);
    }
    if (!scene.textures.exists('fx_arrow')) {
      this.generateArrowFx(scene);
    }
    if (!scene.textures.exists('fx_magic_orb')) {
      this.generateMagicOrbFx(scene);
    }
    if (!scene.textures.exists('fx_nature_burst')) {
      this.generateNatureBurstFx(scene);
    }
    if (!scene.textures.exists('fx_impact_spark')) {
      this.generateImpactSparkFx(scene);
    }
    if (!scene.textures.exists('fx_heal_aura')) {
      this.generateHealAuraFx(scene);
    }

    // --- ASSETS DA FASE 3: ITENS, NÓS DE COLETA E CRAFTING ---
    if (!scene.textures.exists('node_ore')) {
      this.generateOreNode(scene);
    }
    if (!scene.textures.exists('node_herb')) {
      this.generateHerbNode(scene);
    }
    if (!scene.textures.exists('prop_anvil')) {
      this.generateAnvilProp(scene);
    }
    if (!scene.textures.exists('item_drop_bag')) {
      this.generateDropBag(scene);
    }

    // Ícones de itens
    this.generateItemIcons(scene);
  }

  private static generateTileset(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('tileset_prototype', 128, 64);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 128, 64);

    // ==========================================
    // LINHA 0 (y = 0..15): TILES 1 A 8 (CANÔNICOS PRESERVADOS)
    // ==========================================

    // 1. Grama Verde Rica (Tile 1 - GID 1)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#40916c';
    ctx.fillRect(2, 2, 3, 2);
    ctx.fillRect(8, 4, 2, 2);
    ctx.fillRect(4, 9, 3, 2);
    ctx.fillRect(11, 11, 2, 2);
    ctx.fillStyle = '#1b4332';
    ctx.fillRect(3, 4, 1, 1);
    ctx.fillRect(9, 6, 1, 1);
    ctx.fillRect(5, 11, 1, 1);

    // 2. Terra / Caminho Rústico (Tile 2 - GID 2)
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(16, 0, 16, 16);
    ctx.fillStyle = '#a06a3b';
    ctx.fillRect(18, 3, 4, 3);
    ctx.fillRect(24, 8, 3, 3);
    ctx.fillRect(19, 11, 4, 2);
    ctx.fillStyle = '#6f4518';
    ctx.fillRect(20, 5, 2, 1);
    ctx.fillRect(22, 12, 1, 1);

    // 3. Pavimento de Pedra Cinza (Tile 3 - GID 3)
    ctx.fillStyle = '#6c757d';
    ctx.fillRect(32, 0, 16, 16);
    ctx.fillStyle = '#495057';
    ctx.fillRect(32, 7, 16, 1);
    ctx.fillRect(32, 15, 16, 1);
    ctx.fillRect(39, 0, 1, 7);
    ctx.fillRect(44, 8, 1, 7);
    ctx.fillStyle = '#adb5bd';
    ctx.fillRect(33, 1, 5, 2);
    ctx.fillRect(41, 9, 3, 2);

    // 4. Parede de Masmorra / Tijolos Sólidos (Tile 4 - GID 4)
    ctx.fillStyle = '#343a40';
    ctx.fillRect(48, 0, 16, 16);
    ctx.fillStyle = '#212529';
    ctx.strokeRect(48.5, 0.5, 15, 15);
    ctx.fillRect(48, 8, 16, 1);
    ctx.fillRect(55, 0, 1, 8);
    ctx.fillRect(59, 8, 1, 8);
    ctx.fillStyle = '#495057';
    ctx.fillRect(49, 1, 5, 3);
    ctx.fillRect(56, 9, 3, 3);

    // 5. Água Azul com Ondulação (Tile 5 - GID 5)
    ctx.fillStyle = '#0077b6';
    ctx.fillRect(64, 0, 16, 16);
    ctx.fillStyle = '#0096c7';
    ctx.fillRect(66, 3, 5, 2);
    ctx.fillRect(72, 8, 6, 2);
    ctx.fillRect(65, 12, 4, 2);
    ctx.fillStyle = '#90e0ef';
    ctx.fillRect(67, 3, 2, 1);
    ctx.fillRect(73, 8, 3, 1);

    // 6. Flores Amarelas sobre Grama (Tile 6 - GID 6)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(80, 0, 16, 16);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(83, 4, 3, 3);
    ctx.fillRect(89, 9, 3, 3);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(84, 5, 1, 1);
    ctx.fillRect(90, 10, 1, 1);

    // 7. Flores Vermelhas sobre Grama (Tile 7 - GID 7)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(96, 0, 16, 16);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(99, 4, 3, 3);
    ctx.fillRect(104, 10, 3, 3);
    ctx.fillStyle = '#ffe4e6';
    ctx.fillRect(100, 5, 1, 1);
    ctx.fillRect(105, 11, 1, 1);

    // 8. Cerca de Madeira Rústica (Tile 8 - GID 8)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(112, 0, 16, 16);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(114, 2, 3, 14);
    ctx.fillRect(122, 2, 3, 14);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(112, 5, 16, 3);
    ctx.fillRect(112, 11, 16, 3);

    // ==========================================
    // LINHA 1 (y = 16..31): TILES 9 A 16 (VARIAÇÕES DE TERRENO E LAGO)
    // ==========================================

    // 9. Grama Variação 1: Tufos Densos de Relva (Tile 9 - GID 9)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(0, 16, 16, 16);
    ctx.fillStyle = '#52b788';
    ctx.fillRect(3, 19, 2, 4);
    ctx.fillRect(4, 18, 1, 2);
    ctx.fillRect(10, 24, 2, 4);
    ctx.fillRect(9, 25, 1, 3);
    ctx.fillStyle = '#1b4332';
    ctx.fillRect(2, 23, 4, 1);
    ctx.fillRect(9, 28, 4, 1);

    // 10. Grama Variação 2: Seixos e Cascalho (Tile 10 - GID 10)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(16, 16, 16, 16);
    ctx.fillStyle = '#6c757d';
    ctx.fillRect(19, 20, 3, 2);
    ctx.fillRect(26, 26, 4, 3);
    ctx.fillStyle = '#adb5bd';
    ctx.fillRect(20, 20, 1, 1);
    ctx.fillRect(27, 26, 2, 1);
    ctx.fillStyle = '#343a40';
    ctx.fillRect(19, 22, 3, 1);
    ctx.fillRect(26, 29, 4, 1);

    // 11. Grama Variação 3: Trevos e Ervas Silvestres (Tile 11 - GID 11)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(32, 16, 16, 16);
    ctx.fillStyle = '#74c69d';
    // Trevo 1
    ctx.fillRect(35, 20, 1, 3);
    ctx.fillRect(34, 21, 3, 1);
    // Trevo 2
    ctx.fillRect(43, 25, 1, 3);
    ctx.fillRect(42, 26, 3, 1);
    ctx.fillStyle = '#1b4332';
    ctx.fillRect(35, 21, 1, 1);
    ctx.fillRect(43, 26, 1, 1);

    // 12. Margem do Lago Norte (Areia/Terra acima, Água abaixo) (Tile 12 - GID 12)
    ctx.fillStyle = '#0077b6';
    ctx.fillRect(48, 16, 16, 16);
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(48, 16, 16, 5);
    ctx.fillStyle = '#b08968';
    ctx.fillRect(48, 20, 16, 1);
    ctx.fillStyle = '#caf0f8'; // Espuma ondulada
    ctx.fillRect(49, 21, 4, 1);
    ctx.fillRect(55, 21, 5, 1);
    ctx.fillRect(61, 22, 3, 1);

    // 13. Margem do Lago Sul (Água acima, Areia/Terra abaixo) (Tile 13 - GID 13)
    ctx.fillStyle = '#0077b6';
    ctx.fillRect(64, 16, 16, 16);
    ctx.fillStyle = '#caf0f8'; // Espuma
    ctx.fillRect(65, 26, 5, 1);
    ctx.fillRect(72, 25, 6, 1);
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(64, 27, 16, 5);
    ctx.fillStyle = '#b08968';
    ctx.fillRect(64, 27, 16, 1);

    // 14. Margem do Lago Oeste (Areia à esquerda, Água à direita) (Tile 14 - GID 14)
    ctx.fillStyle = '#0077b6';
    ctx.fillRect(80, 16, 16, 16);
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(80, 16, 5, 16);
    ctx.fillStyle = '#b08968';
    ctx.fillRect(84, 16, 1, 16);
    ctx.fillStyle = '#caf0f8';
    ctx.fillRect(85, 18, 1, 4);
    ctx.fillRect(85, 25, 1, 5);

    // 15. Margem do Lago Leste (Água à esquerda, Areia à direita) (Tile 15 - GID 15)
    ctx.fillStyle = '#0077b6';
    ctx.fillRect(96, 16, 16, 16);
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(107, 16, 5, 16);
    ctx.fillStyle = '#b08968';
    ctx.fillRect(107, 16, 1, 16);
    ctx.fillStyle = '#caf0f8';
    ctx.fillRect(106, 19, 1, 5);
    ctx.fillRect(106, 27, 1, 4);

    // 16. Água com Cintilação / Reflexo de Luz (Tile 16 - GID 16)
    ctx.fillStyle = '#0077b6';
    ctx.fillRect(112, 16, 16, 16);
    ctx.fillStyle = '#0096c7';
    ctx.fillRect(114, 19, 6, 2);
    ctx.fillRect(121, 25, 5, 2);
    ctx.fillStyle = '#caf0f8'; // Reflexo brilhante
    ctx.fillRect(115, 19, 3, 1);
    ctx.fillRect(122, 25, 3, 1);
    ctx.fillStyle = '#ffffff'; // Ponto de brilho estelar
    ctx.fillRect(117, 20, 1, 1);
    ctx.fillRect(123, 26, 1, 1);

    // ==========================================
    // LINHA 2 (y = 32..47): TILES 17 A 24 (BORDAS E CANTOS DE TRILHA)
    // ==========================================

    // 17. Trilha Borda Norte (Grama ao Norte, Terra ao Sul) (Tile 17 - GID 17)
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(0, 32, 16, 16);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(0, 32, 16, 5);
    ctx.fillStyle = '#40916c';
    ctx.fillRect(2, 36, 3, 2);
    ctx.fillRect(8, 36, 4, 1);
    ctx.fillRect(13, 36, 2, 2);

    // 18. Trilha Borda Sul (Terra ao Norte, Grama ao Sul) (Tile 18 - GID 18)
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(16, 32, 16, 16);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(16, 43, 16, 5);
    ctx.fillStyle = '#40916c';
    ctx.fillRect(18, 41, 3, 2);
    ctx.fillRect(24, 42, 4, 1);
    ctx.fillRect(29, 41, 2, 2);

    // 19. Trilha Borda Oeste (Grama a Oeste, Terra a Leste) (Tile 19 - GID 19)
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(32, 32, 16, 16);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(32, 32, 5, 16);
    ctx.fillStyle = '#40916c';
    ctx.fillRect(36, 34, 2, 3);
    ctx.fillRect(36, 41, 2, 4);

    // 20. Trilha Borda Leste (Terra a Oeste, Grama a Leste) (Tile 20 - GID 20)
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(48, 32, 16, 16);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(59, 32, 5, 16);
    ctx.fillStyle = '#40916c';
    ctx.fillRect(57, 35, 2, 3);
    ctx.fillRect(57, 42, 2, 4);

    // 21. Trilha Canto Noroeste (NW - Grama em cima e esquerda) (Tile 21 - GID 21)
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(64, 32, 16, 16);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(64, 32, 16, 5);
    ctx.fillRect(64, 32, 5, 16);
    ctx.fillStyle = '#40916c';
    ctx.fillRect(68, 36, 3, 2);
    ctx.fillRect(68, 40, 2, 3);

    // 22. Trilha Canto Nordeste (NE - Grama em cima e direita) (Tile 22 - GID 22)
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(80, 32, 16, 16);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(80, 32, 16, 5);
    ctx.fillRect(91, 32, 5, 16);
    ctx.fillStyle = '#40916c';
    ctx.fillRect(89, 36, 3, 2);
    ctx.fillRect(89, 40, 2, 3);

    // 23. Trilha Canto Sudoeste (SW - Grama embaixo e esquerda) (Tile 23 - GID 23)
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(96, 32, 16, 16);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(96, 43, 16, 5);
    ctx.fillRect(96, 32, 5, 16);
    ctx.fillStyle = '#40916c';
    ctx.fillRect(100, 41, 3, 2);
    ctx.fillRect(100, 36, 2, 3);

    // 24. Trilha Canto Sudeste (SE - Grama embaixo e direita) (Tile 24 - GID 24)
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(112, 32, 16, 16);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(112, 43, 16, 5);
    ctx.fillRect(123, 32, 5, 16);
    ctx.fillStyle = '#40916c';
    ctx.fillRect(120, 41, 3, 2);
    ctx.fillRect(120, 36, 2, 3);

    // ==========================================
    // LINHA 3 (y = 48..63): TILES 25 A 32 (PRAÇA DA FORJA, DECORAÇÕES E ÁRVORE)
    // ==========================================

    // 25. Calçamento Nobre da Praça da Forja (Tile 25 - GID 25)
    ctx.fillStyle = '#374151'; // Lajes de basalto polido
    ctx.fillRect(0, 48, 16, 16);
    ctx.fillStyle = '#1f2937'; // Linhas de rejunte escuro
    ctx.strokeRect(0.5, 48.5, 15, 15);
    ctx.fillRect(0, 55, 16, 1);
    ctx.fillRect(7, 48, 1, 7);
    ctx.fillRect(10, 56, 1, 8);
    ctx.fillStyle = '#4b5563'; // Realce das bordas da pedra
    ctx.fillRect(1, 49, 5, 1);
    ctx.fillRect(8, 57, 5, 1);
    ctx.fillStyle = '#ea580c'; // Faísca / brasa incandescente da forja
    ctx.fillRect(4, 52, 1, 1);
    ctx.fillRect(12, 60, 1, 1);

    // 26. Poste / Marco de Sinalização da Vila (Tile 26 - GID 26)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(16, 48, 16, 16);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(23, 50, 2, 14); // Haste
    ctx.fillStyle = '#a16207';
    ctx.fillRect(19, 51, 10, 4); // Placa de madeira
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(20, 52, 6, 2); // Inscrição

    // 27. Arbusto Florido Decorativo (Tile 27 - GID 27)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(32, 48, 16, 16);
    ctx.fillStyle = '#1b4332';
    ctx.beginPath();
    ctx.arc(40, 56, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.arc(38, 55, 4, 0, Math.PI * 2);
    ctx.arc(42, 55, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8'; // Bagas azuis reluzentes
    ctx.fillRect(36, 54, 2, 2);
    ctx.fillRect(42, 55, 2, 2);

    // 28. Rocha Lisa Decorativa (Tile 28 - GID 28)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(48, 48, 16, 16);
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(56, 56, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8'; // Luz superior
    ctx.beginPath();
    ctx.ellipse(55, 54, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b'; // Sombra na base
    ctx.fillRect(52, 59, 8, 1);

    // 29. Copa de Árvore - Topo / Centro (Tile 29 - GID 29)
    ctx.fillStyle = '#1b4332';
    ctx.beginPath();
    ctx.arc(72, 57, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.arc(72, 55, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#52b788';
    ctx.fillRect(70, 52, 4, 2);

    // 30. Copa de Árvore - Borda Esquerda (Tile 30 - GID 30)
    ctx.fillStyle = '#1b4332';
    ctx.beginPath();
    ctx.arc(88, 56, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.arc(90, 56, 5, 0, Math.PI * 2);
    ctx.fill();

    // 31. Copa de Árvore - Borda Direita (Tile 31 - GID 31)
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.arc(104, 56, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#52b788';
    ctx.beginPath();
    ctx.arc(102, 54, 4, 0, Math.PI * 2);
    ctx.fill();

    // 32. Tronco e Raízes de Árvore (Tile 32 - GID 32)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(112, 48, 16, 16);
    ctx.fillStyle = '#582f0e';
    ctx.fillRect(118, 50, 5, 12);
    ctx.fillStyle = '#7f4f24';
    ctx.fillRect(120, 50, 2, 12);
    // Raízes se abrindo no solo
    ctx.fillStyle = '#3d200a';
    ctx.fillRect(116, 60, 3, 2);
    ctx.fillRect(122, 60, 3, 2);

    canvas.refresh();
  }

  // --- 1. GUERREIRO (Elmo integral de aço, penacho carmesim, ombreiras reforçadas, escudo de carvalho e espada curta) ---
  private static generateWarriorSpritesheet(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('hero_warrior', 64, 72);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, 64, 72);

    for (let dir = 0; dir < 3; dir++) {
      const yOffset = dir * 24;
      for (let frame = 0; frame < 4; frame++) {
        const xOffset = frame * 16;
        this.drawWarriorFrame(ctx, xOffset, yOffset, dir, frame);
        const frameIndex = dir * 4 + frame;
        canvas.add(frameIndex, 0, xOffset, yOffset, 16, 24);
      }
    }
    canvas.refresh();
  }

  private static drawWarriorFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: number,
    frame: number
  ): void {
    // Sombra padronizada
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 22, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const legOffset = frame === 1 ? -1 : frame === 3 ? 1 : 0;

    if (direction === 0) {
      // FRENTE (DOWN)
      // Botas e grevas de ferro escuro
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 4);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 4);
      ctx.fillStyle = '#475569';
      ctx.fillRect(x + 4, y + 20 + (legOffset > 0 ? -1 : 0), 3, 1);
      ctx.fillRect(x + 9, y + 20 + (legOffset < 0 ? -1 : 0), 3, 1);

      // Cinto de couro com fivela dourada
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 4, y + 16, 8, 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 7, y + 16, 2, 2);

      // Túnica azul sob peitoral de aço
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x + 3, y + 10, 10, 6);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 5, y + 10, 6, 5); // Placa de aço
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 6, y + 11, 4, 1); // Brilho de metal

      // Ombreiras reforçadas de ferro
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 1, y + 9, 3, 3);
      ctx.fillRect(x + 12, y + 9, 3, 3);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 1, y + 9, 3, 1);
      ctx.fillRect(x + 12, y + 9, 3, 1);

      // Escudo de Carvalho no braço esquerdo (lado direito do sprite)
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 12, y + 11 - legOffset, 4, 7);
      ctx.fillStyle = '#94a3b8'; // Borda de aço
      ctx.strokeRect(x + 12.5, y + 11.5 - legOffset, 3, 6);
      ctx.fillStyle = '#ef4444'; // Brasão carmesim no escudo
      ctx.fillRect(x + 13, y + 13 - legOffset, 2, 2);

      // Espada curta no braço direito (lado esquerdo do sprite)
      ctx.fillStyle = '#f59e0b'; // Guarda
      ctx.fillRect(x + 1, y + 13 + legOffset, 3, 1);
      ctx.fillStyle = '#e2e8f0'; // Lâmina de aço
      ctx.fillRect(x + 2, y + 14 + legOffset, 1, 6);

      // Elmo integral de ferro
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 4, y + 3, 8, 7);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 3, y + 5, 1, 4);
      ctx.fillRect(x + 12, y + 5, 1, 4);
      // Fenda escura do visor
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 5, y + 6, 6, 2);
      ctx.fillStyle = '#38bdf8'; // Brilho nos olhos através do visor
      ctx.fillRect(x + 6, y + 6, 1, 1);
      ctx.fillRect(x + 9, y + 6, 1, 1);

      // Penacho carmesim no topo do elmo
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x + 7, y + 0, 2, 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + 7, y + 1, 2, 2);
    } else if (direction === 1) {
      // COSTAS (UP)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 4);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 4);

      // Capa azul cobrindo as costas
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x + 3, y + 10, 10, 8);
      ctx.fillStyle = '#1e40af';
      ctx.fillRect(x + 4, y + 12, 8, 6);

      // Ombreiras de aço
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 1, y + 9, 3, 3);
      ctx.fillRect(x + 12, y + 9, 3, 3);

      // Borda do escudo visível à esquerda
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 12, y + 11 + legOffset, 3, 6);

      // Bainha da espada visível à direita
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 1, y + 12 - legOffset, 2, 7);

      // Elmo visto de trás
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 4, y + 3, 8, 7);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 5, y + 8, 6, 2);

      // Penacho vermelho caindo para trás
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x + 7, y + 0, 2, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + 7, y + 1, 2, 2);
    } else {
      // DIREITA (RIGHT)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 6 + legOffset, y + 19, 4, 4);
      ctx.fillRect(x + 4 - legOffset, y + 19, 4, 4);

      // Peitoral e capa de perfil
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x + 2, y + 10, 4, 8);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 5, y + 10, 5, 6);

      // Escudo à frente (posição defensiva)
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 9, y + 10, 4, 8);
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeRect(x + 9.5, y + 10.5, 3, 7);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + 10, y + 13, 2, 2);

      // Espada embainhada na cintura de trás
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 1, y + 13, 2, 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(x + 2, y + 15, 1, 5);

      // Elmo de perfil com visor angular
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 4, y + 3, 8, 7);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 8, y + 6, 4, 2); // Fenda do visor
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + 9, y + 6, 1, 1);

      // Penacho inclinado
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x + 5, y + 0, 3, 3);
      ctx.fillRect(x + 4, y + 1, 2, 2);
    }
  }

  // --- 2. ARQUEIRO (Capuz de caçador com pena dourada, arco recurvo de madeira e aljava diagonal com flechas) ---
  private static generateRangerSpritesheet(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('hero_ranger', 64, 72);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, 64, 72);

    for (let dir = 0; dir < 3; dir++) {
      const yOffset = dir * 24;
      for (let frame = 0; frame < 4; frame++) {
        const xOffset = frame * 16;
        this.drawRangerFrame(ctx, xOffset, yOffset, dir, frame);
        const frameIndex = dir * 4 + frame;
        canvas.add(frameIndex, 0, xOffset, yOffset, 16, 24);
      }
    }
    canvas.refresh();
  }

  private static drawRangerFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: number,
    frame: number
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 22, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const legOffset = frame === 1 ? -1 : frame === 3 ? 1 : 0;

    if (direction === 0) {
      // FRENTE (DOWN)
      // Botas de couro de viagem ajustadas
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 4);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 4);
      ctx.fillStyle = '#14532d'; // Calças verdes
      ctx.fillRect(x + 4, y + 16, 8, 3);

      // Túnica verde com colete de couro
      ctx.fillStyle = '#15803d';
      ctx.fillRect(x + 3, y + 10, 10, 6);
      ctx.fillStyle = '#92400e'; // Colete de couro
      ctx.fillRect(x + 4, y + 10, 8, 5);
      // Correia transversal da aljava
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 4, y + 10, 2, 2);
      ctx.fillRect(x + 6, y + 12, 2, 2);
      ctx.fillRect(x + 8, y + 14, 2, 2);

      // Arco Curto empunhado na mão direita (lado esquerdo do sprite)
      ctx.fillStyle = '#b45309'; // Madeira do arco
      ctx.fillRect(x + 1, y + 8 + legOffset, 2, 1);
      ctx.fillRect(x + 0, y + 9 + legOffset, 2, 7);
      ctx.fillRect(x + 1, y + 16 + legOffset, 2, 1);
      ctx.fillStyle = '#f8fafc'; // Corda do arco
      ctx.fillRect(x + 2, y + 9 + legOffset, 1, 7);

      // Braço esquerdo do arqueiro (lado direito do sprite)
      ctx.fillStyle = '#78350f'; // Braçadeira de tiro
      ctx.fillRect(x + 12, y + 11 - legOffset, 2, 4);

      // Capuz de caçador verde floresta
      ctx.fillStyle = '#15803d';
      ctx.fillRect(x + 4, y + 2, 8, 8);
      ctx.fillStyle = '#166534'; // Sombra do capuz
      ctx.fillRect(x + 3, y + 3, 1, 6);
      ctx.fillRect(x + 12, y + 3, 1, 6);

      // Rosto do Arqueiro com olhos atentos e mecha de cabelo
      ctx.fillStyle = '#fed7aa'; // Pele
      ctx.fillRect(x + 5, y + 5, 6, 4);
      ctx.fillStyle = '#fef08a'; // Mecha de cabelo loira/castanha clara
      ctx.fillRect(x + 4, y + 4, 3, 2);
      ctx.fillStyle = '#0f172a'; // Olhos
      ctx.fillRect(x + 6, y + 6, 1, 1);
      ctx.fillRect(x + 9, y + 6, 1, 1);

      // Pena dourada no topo do capuz
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 3, y + 1, 2, 3);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + 4, y + 0, 1, 2);
    } else if (direction === 1) {
      // COSTAS (UP)
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 4);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 4);

      // Capa curta verde floresta
      ctx.fillStyle = '#15803d';
      ctx.fillRect(x + 3, y + 10, 10, 7);

      // Aljava de couro nas costas com flechas diagonais
      ctx.fillStyle = '#92400e';
      ctx.fillRect(x + 8, y + 9, 3, 7);
      // Penas das flechas saindo da aljava
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + 9, y + 6, 1, 3);
      ctx.fillRect(x + 11, y + 7, 1, 3);
      ctx.fillStyle = '#dc2626'; // Detalhe da pena
      ctx.fillRect(x + 9, y + 6, 1, 1);
      ctx.fillRect(x + 11, y + 7, 1, 1);

      // Arco visível seguro na mão esquerda
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x + 1, y + 9 - legOffset, 2, 8);

      // Capuz visto de trás com ponta triangular
      ctx.fillStyle = '#166534';
      ctx.fillRect(x + 4, y + 2, 8, 7);
      ctx.fillStyle = '#14532d';
      ctx.fillRect(x + 7, y + 8, 2, 2); // Ponta do capuz caindo
    } else {
      // DIREITA (RIGHT)
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 6 + legOffset, y + 19, 4, 4);
      ctx.fillRect(x + 4 - legOffset, y + 19, 4, 4);

      ctx.fillStyle = '#15803d';
      ctx.fillRect(x + 4, y + 10, 7, 6);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(x + 5, y + 11, 5, 5);

      // Aljava visível nas costas
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 2, y + 8, 3, 7);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + 2, y + 5, 2, 3); // Pontas das flechas

      // Arco à frente na mão dianteira
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x + 12, y + 7, 2, 1);
      ctx.fillRect(x + 13, y + 8, 2, 8);
      ctx.fillRect(x + 12, y + 16, 2, 1);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + 13, y + 8, 1, 8); // Corda

      // Capuz perfilado com a pena
      ctx.fillStyle = '#15803d';
      ctx.fillRect(x + 4, y + 2, 7, 8);
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(x + 8, y + 5, 3, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 9, y + 6, 1, 1);

      // Pena inclinada
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 3, y + 1, 3, 2);
    }
  }

  // --- 3. MAGO (Chapéu pontudo clássico de abas largas, túnica longa cerimonial e cajado arcano com cristal pulsante) ---
  private static generateMageSpritesheet(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('hero_mage', 64, 72);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, 64, 72);

    for (let dir = 0; dir < 3; dir++) {
      const yOffset = dir * 24;
      for (let frame = 0; frame < 4; frame++) {
        const xOffset = frame * 16;
        this.drawMageFrame(ctx, xOffset, yOffset, dir, frame);
        const frameIndex = dir * 4 + frame;
        canvas.add(frameIndex, 0, xOffset, yOffset, 16, 24);
      }
    }
    canvas.refresh();
  }

  private static drawMageFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: number,
    frame: number
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 22, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const legOffset = frame === 1 ? -1 : frame === 3 ? 1 : 0;

    if (direction === 0) {
      // FRENTE (DOWN)
      // Túnica longa roxa escura até o chão (passos sutis)
      ctx.fillStyle = '#3b0764'; // Fundo/sombra da barra
      ctx.fillRect(x + 3, y + 18, 10, 4);
      // Pontas dos sapatos aparecendo sutilmente
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(x + 5, y + 21 + (legOffset > 0 ? -1 : 0), 2, 2);
      ctx.fillRect(x + 9, y + 21 + (legOffset < 0 ? -1 : 0), 2, 2);

      // Túnica cerimonial roxa com estola mágica
      ctx.fillStyle = '#6b21a8';
      ctx.fillRect(x + 3, y + 10, 10, 9);
      ctx.fillStyle = '#06b6d4'; // Estola mística central ciano
      ctx.fillRect(x + 7, y + 10, 2, 9);
      ctx.fillStyle = '#f59e0b'; // Fivela/amuleto dourado no cinto
      ctx.fillRect(x + 7, y + 15, 2, 2);

      // Mangas largas de conjurador
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(x + 1, y + 11 + legOffset, 3, 5);
      ctx.fillRect(x + 12, y + 11 - legOffset, 3, 5);

      // Cajado Arcano no braço esquerdo (lado direito do sprite)
      ctx.fillStyle = '#78350f'; // Haste de madeira entalhada
      ctx.fillRect(x + 14, y + 4 - legOffset, 1, 17);
      // Cristal Arcano no topo com brilho pulsante
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(x + 13, y + 2 - legOffset, 3, 3);
      ctx.fillStyle = '#ffffff'; // Núcleo brilhante
      ctx.fillRect(x + 14, y + 3 - legOffset, 1, 1);

      // Rosto sob a sombra da aba do chapéu
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(x + 5, y + 6, 6, 4);
      // Barba sábia grisalha
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 6, y + 8, 4, 3);
      // Olhos arcanos brilhantes
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(x + 6, y + 7, 1, 1);
      ctx.fillRect(x + 9, y + 7, 1, 1);

      // Chapéu Pontudo de Mago de Abas Largas
      ctx.fillStyle = '#581c87'; // Aba circular larga
      ctx.fillRect(x + 1, y + 5, 14, 2);
      ctx.fillStyle = '#06b6d4'; // Fita ciano
      ctx.fillRect(x + 4, y + 4, 8, 1);
      // Cone do chapéu com ponta dobrada
      ctx.fillStyle = '#6b21a8';
      ctx.fillRect(x + 4, y + 2, 8, 2);
      ctx.fillRect(x + 5, y + 1, 6, 1);
      ctx.fillRect(x + 7, y + 0, 3, 1); // Ponta dobrada
      ctx.fillStyle = '#f59e0b'; // Fivela na fita do chapéu
      ctx.fillRect(x + 7, y + 4, 2, 1);
    } else if (direction === 1) {
      // COSTAS (UP)
      ctx.fillStyle = '#3b0764';
      ctx.fillRect(x + 3, y + 18, 10, 4);

      // Túnica longa cobrindo as costas com grande runa arcana
      ctx.fillStyle = '#6b21a8';
      ctx.fillRect(x + 3, y + 8, 10, 11);
      // Runa arcana bordada nas costas (losango ciano)
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(x + 7, y + 11, 2, 4);
      ctx.fillRect(x + 6, y + 12, 4, 2);

      // Cajado erguido acima do ombro direito
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 14, y + 4 + legOffset, 1, 17);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(x + 13, y + 2 + legOffset, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 14, y + 3 + legOffset, 1, 1);

      // Chapéu de Mago visto por trás
      ctx.fillStyle = '#581c87';
      ctx.fillRect(x + 1, y + 5, 14, 2);
      ctx.fillStyle = '#6b21a8';
      ctx.fillRect(x + 4, y + 2, 8, 3);
      ctx.fillRect(x + 7, y + 0, 3, 2);
    } else {
      // DIREITA (RIGHT)
      ctx.fillStyle = '#3b0764';
      ctx.fillRect(x + 3, y + 18, 9, 4);

      // Túnica de perfil ondulando
      ctx.fillStyle = '#6b21a8';
      ctx.fillRect(x + 4, y + 8, 7, 11);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(x + 6, y + 9, 3, 10);

      // Cajado erguido à frente com cristal brilhante
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 12, y + 4, 1, 17);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(x + 11, y + 2, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 12, y + 3, 1, 1);

      // Chapéu de perfil com cone inclinado
      ctx.fillStyle = '#581c87';
      ctx.fillRect(x + 2, y + 5, 12, 2);
      ctx.fillStyle = '#6b21a8';
      ctx.fillRect(x + 4, y + 2, 7, 3);
      ctx.fillRect(x + 3, y + 0, 4, 2); // Ponta caída para trás
    }
  }

  // --- 4. DRUIDA (Capuz orgânico com galhos de cervo brotando, talismã rúnico de madeira e manto de folhas) ---
  private static generateDruidSpritesheet(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('hero_druid', 64, 72);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, 64, 72);

    for (let dir = 0; dir < 3; dir++) {
      const yOffset = dir * 24;
      for (let frame = 0; frame < 4; frame++) {
        const xOffset = frame * 16;
        this.drawDruidFrame(ctx, xOffset, yOffset, dir, frame);
        const frameIndex = dir * 4 + frame;
        canvas.add(frameIndex, 0, xOffset, yOffset, 16, 24);
      }
    }
    canvas.refresh();
  }

  private static drawDruidFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: number,
    frame: number
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 22, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const legOffset = frame === 1 ? -1 : frame === 3 ? 1 : 0;

    if (direction === 0) {
      // FRENTE (DOWN)
      // Botas rústicas de couro com tiras de vinha
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 4);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 4);
      ctx.fillStyle = '#365314'; // Tornozeleiras de folhagens
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 1);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 1);

      // Túnica de tecido cru e verde-oliva
      ctx.fillStyle = '#3f6212';
      ctx.fillRect(x + 3, y + 10, 10, 6);
      ctx.fillStyle = '#65a30d'; // Manto assimétrico de folhas
      ctx.fillRect(x + 3, y + 10, 4, 6);

      // Cinto rústico de vinhas com nó
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 4, y + 15, 8, 1);

      // Talismã Rúnico no peito (Madeira sagrada com gema verde esmeralda)
      ctx.fillStyle = '#713f12'; // Moldura de madeira
      ctx.fillRect(x + 7, y + 12, 2, 3);
      ctx.fillStyle = '#10b981'; // Gema brilhante
      ctx.fillRect(x + 7, y + 13, 2, 1);

      // Bordão de Carvalho Vivo no braço direito (lado esquerdo do sprite)
      ctx.fillStyle = '#713f12'; // Madeira retorcida
      ctx.fillRect(x + 1, y + 7 + legOffset, 2, 14);
      ctx.fillStyle = '#84cc16'; // Pequenos brotos verdes no topo
      ctx.fillRect(x + 0, y + 6 + legOffset, 2, 2);
      ctx.fillRect(x + 2, y + 8 + legOffset, 1, 2);

      // Braço esquerdo com pulseira de folhas
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(x + 12, y + 11 - legOffset, 2, 4);

      // Capuz orgânico de folhas e peles
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(x + 4, y + 3, 8, 7);
      ctx.fillStyle = '#fed7aa'; // Rosto
      ctx.fillRect(x + 5, y + 6, 6, 3);
      ctx.fillStyle = '#0f172a'; // Olhos
      ctx.fillRect(x + 6, y + 7, 1, 1);
      ctx.fillRect(x + 9, y + 7, 1, 1);
      ctx.fillStyle = '#84cc16'; // Pintura ritual verde sob os olhos
      ctx.fillRect(x + 6, y + 8, 1, 1);
      ctx.fillRect(x + 9, y + 8, 1, 1);

      // Chifres de Cervo / Galhos bifurcados saindo do capuz
      // Galho esquerdo
      ctx.fillStyle = '#a16207';
      ctx.fillRect(x + 3, y + 2, 2, 2);
      ctx.fillRect(x + 2, y + 0, 1, 3);
      ctx.fillRect(x + 3, y + 1, 1, 1);
      ctx.fillStyle = '#84cc16'; // Broto na ponta
      ctx.fillRect(x + 2, y + 0, 1, 1);

      // Galho direito
      ctx.fillStyle = '#a16207';
      ctx.fillRect(x + 11, y + 2, 2, 2);
      ctx.fillRect(x + 13, y + 0, 1, 3);
      ctx.fillRect(x + 12, y + 1, 1, 1);
      ctx.fillStyle = '#84cc16'; // Broto na ponta
      ctx.fillRect(x + 13, y + 0, 1, 1);
    } else if (direction === 1) {
      // COSTAS (UP)
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 4);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 4);

      // Capa de folhas em camadas sobrepostas
      ctx.fillStyle = '#365314';
      ctx.fillRect(x + 3, y + 9, 10, 8);
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(x + 4, y + 11, 8, 5);
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(x + 5, y + 13, 6, 4);

      // Bordão de madeira viva seguro na mão
      ctx.fillStyle = '#713f12';
      ctx.fillRect(x + 1, y + 7 - legOffset, 2, 14);

      // Capuz visto de trás
      ctx.fillStyle = '#3f6212';
      ctx.fillRect(x + 4, y + 3, 8, 6);

      // Galhos/chifres bifurcados bem destacados na silhueta
      ctx.fillStyle = '#a16207';
      ctx.fillRect(x + 2, y + 0, 1, 3);
      ctx.fillRect(x + 13, y + 0, 1, 3);
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(x + 2, y + 0, 1, 1);
      ctx.fillRect(x + 13, y + 0, 1, 1);
    } else {
      // DIREITA (RIGHT)
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 6 + legOffset, y + 19, 4, 4);
      ctx.fillRect(x + 4 - legOffset, y + 19, 4, 4);

      // Túnica e capa de folhas de perfil
      ctx.fillStyle = '#365314';
      ctx.fillRect(x + 3, y + 9, 4, 8);
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(x + 5, y + 10, 6, 6);

      // Bordão de madeira viva empunhado à frente
      ctx.fillStyle = '#713f12';
      ctx.fillRect(x + 11, y + 7, 2, 14);
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(x + 10, y + 6, 2, 2);

      // Capuz com galho de cervo de perfil
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(x + 4, y + 3, 7, 7);
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(x + 8, y + 6, 3, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 9, y + 7, 1, 1);

      // Galho projetado para trás e para cima
      ctx.fillStyle = '#a16207';
      ctx.fillRect(x + 5, y + 0, 2, 4);
      ctx.fillRect(x + 4, y + 1, 1, 2);
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(x + 5, y + 0, 1, 1);
    }
  }

  private static generateSlimeSpritesheet(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('mob_slime', 32, 16);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 32, 16);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(8, 14, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(8, 9, 6, Math.PI, 0);
    ctx.fillRect(2, 9, 12, 4);
    ctx.fill();

    ctx.fillStyle = '#34d399';
    ctx.fillRect(5, 5, 4, 2);

    ctx.fillStyle = '#064e3b';
    ctx.fillRect(5, 8, 2, 3);
    ctx.fillRect(9, 8, 2, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, 8, 1, 1);
    ctx.fillRect(9, 8, 1, 1);

    const x2 = 16;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x2 + 8, 14, 7, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.arc(x2 + 8, 10, 7, Math.PI, 0);
    ctx.fillRect(x2 + 1, 10, 14, 3);
    ctx.fill();

    ctx.fillStyle = '#6ee7b7';
    ctx.fillRect(x2 + 6, 6, 4, 2);

    ctx.fillStyle = '#064e3b';
    ctx.fillRect(x2 + 4, 9, 2, 2);
    ctx.fillRect(x2 + 10, 9, 2, 2);

    canvas.add(0, 0, 0, 0, 16, 16);
    canvas.add(1, 0, 16, 0, 16, 16);
    canvas.refresh();
  }

  private static generateGoblinSpritesheet(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('mob_goblin', 32, 24);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 32, 24);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(8, 22, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(5, 16, 6, 5);

    ctx.fillStyle = '#65a30d';
    ctx.fillRect(4, 10, 8, 6);

    ctx.fillStyle = '#84cc16';
    ctx.fillRect(5, 4, 6, 6);
    ctx.fillRect(2, 5, 3, 2);
    ctx.fillRect(11, 5, 3, 2);

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(6, 6, 1, 2);
    ctx.fillRect(9, 6, 1, 2);

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(12, 12, 2, 6);
    ctx.fillStyle = '#475569';
    ctx.fillRect(11, 14, 4, 1);

    const x2 = 16;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x2 + 8, 22, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(x2 + 4, 16, 8, 5);

    ctx.fillStyle = '#65a30d';
    ctx.fillRect(x2 + 5, 10, 7, 6);

    ctx.fillStyle = '#84cc16';
    ctx.fillRect(x2 + 6, 4, 6, 6);
    ctx.fillRect(x2 + 3, 5, 3, 2);
    ctx.fillRect(x2 + 12, 5, 3, 2);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x2 + 8, 6, 1, 2);
    ctx.fillRect(x2 + 10, 6, 1, 2);

    ctx.fillStyle = '#f87171';
    ctx.fillRect(x2 + 11, 10, 4, 2);

    canvas.add(0, 0, 0, 0, 16, 24);
    canvas.add(1, 0, 16, 0, 16, 24);
    canvas.refresh();
  }

  private static generateSkeletonSpritesheet(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('mob_skeleton', 32, 24);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 32, 24);

    // FRAME 0: Idle (x = 0..15)
    // Sombra suave no chão
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(8, 22, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pernas (ossos tibiais)
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(6, 17, 2, 5);
    ctx.fillRect(9, 17, 2, 5);

    // Pélvis e Coluna vertebral
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(6, 15, 5, 2);
    ctx.fillRect(7, 10, 3, 5);

    // Caixa torácica / Costelas
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(5, 9, 7, 2);
    ctx.fillRect(5, 12, 7, 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6, 11, 2, 1);
    ctx.fillRect(9, 11, 2, 1);

    // Crânio do esqueleto
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(5, 3, 7, 6);
    ctx.fillRect(6, 2, 5, 1);
    // Mandíbula / dentes
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(6, 7, 5, 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(7, 8, 1, 1);
    ctx.fillRect(9, 8, 1, 1);

    // Órbitas oculares com brilho violeta arcano
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6, 4, 2, 2);
    ctx.fillRect(9, 4, 2, 2);
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(7, 4, 1, 1);
    ctx.fillRect(10, 4, 1, 1);

    // Braço esquerdo e Espada Curva Enferrujada
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(3, 10, 2, 5);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(2, 14, 3, 1);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(3, 15, 1, 6);
    ctx.fillRect(4, 17, 1, 3);

    // FRAME 1: Walk / Attack (x = 16..31)
    const x2 = 16;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x2 + 8, 22, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pernas em passo de combate
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x2 + 5, 17, 2, 5);
    ctx.fillRect(x2 + 10, 16, 2, 6);

    // Coluna e pélvis
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x2 + 6, 15, 5, 2);
    ctx.fillRect(x2 + 7, 10, 3, 5);

    // Costelas
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x2 + 5, 9, 7, 2);
    ctx.fillRect(x2 + 5, 12, 7, 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x2 + 6, 11, 2, 1);
    ctx.fillRect(x2 + 9, 11, 2, 1);

    // Crânio inclinado
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x2 + 6, 3, 7, 6);
    ctx.fillRect(x2 + 7, 2, 5, 1);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(x2 + 7, 7, 5, 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x2 + 8, 8, 1, 1);
    ctx.fillRect(x2 + 10, 8, 1, 1);

    // Olhos com fogo espectral púrpura
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x2 + 7, 4, 2, 2);
    ctx.fillRect(x2 + 10, 4, 2, 2);
    ctx.fillStyle = '#e879f9';
    ctx.fillRect(x2 + 8, 4, 1, 1);
    ctx.fillRect(x2 + 11, 4, 1, 1);

    // Espada erguida em golpe
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x2 + 12, 8, 2, 4);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(x2 + 11, 7, 4, 1);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x2 + 12, 1, 2, 6);
    ctx.fillRect(x2 + 14, 2, 1, 3);

    canvas.add(0, 0, 0, 0, 16, 24);
    canvas.add(1, 0, 16, 0, 16, 24);
    canvas.refresh();
  }

  private static generateTreeProp(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('prop_tree', 32, 48);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 32, 48);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(16, 45, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#582f0e';
    ctx.fillRect(12, 30, 8, 15);
    ctx.fillStyle = '#7f4f24';
    ctx.fillRect(14, 30, 4, 15);

    ctx.fillStyle = '#1b4332';
    ctx.beginPath();
    ctx.arc(16, 20, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.arc(12, 16, 10, 0, Math.PI * 2);
    ctx.arc(20, 16, 10, 0, Math.PI * 2);
    ctx.arc(16, 12, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.arc(14, 13, 7, 0, Math.PI * 2);
    ctx.arc(19, 13, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#52b788';
    ctx.fillRect(13, 10, 3, 3);
    ctx.fillRect(18, 12, 2, 2);

    canvas.refresh();
  }

  private static generateTreeSeparatedProps(scene: Phaser.Scene): void {
    // 1. Tronco da Árvore com raízes e sombra (Base colidível)
    const trunkCanvas = scene.textures.createCanvas('prop_tree_trunk', 32, 48);
    if (trunkCanvas) {
      const ctx = trunkCanvas.getContext();
      ctx.clearRect(0, 0, 32, 48);

      // Sombra projetada na base dos pés
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(16, 45, 12, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tronco robusto de carvalho
      ctx.fillStyle = '#582f0e';
      ctx.fillRect(12, 28, 8, 17);
      ctx.fillStyle = '#7f4f24';
      ctx.fillRect(14, 28, 4, 17);
      ctx.fillStyle = '#935e38';
      ctx.fillRect(15, 29, 2, 12);

      // Raízes laterais fincadas no solo
      ctx.fillStyle = '#3d200a';
      ctx.fillRect(10, 42, 3, 3);
      ctx.fillRect(19, 42, 3, 3);

      trunkCanvas.refresh();
    }

    // 2. Copa visual exuberante (folhagem aérea para Y-sorting e see-through)
    const canopyCanvas = scene.textures.createCanvas('prop_tree_canopy', 32, 48);
    if (canopyCanvas) {
      const ctx = canopyCanvas.getContext();
      ctx.clearRect(0, 0, 32, 48);

      // Camada de base escura para volume e sombra
      ctx.fillStyle = '#1b4332';
      ctx.beginPath();
      ctx.arc(16, 20, 15, 0, Math.PI * 2);
      ctx.fill();

      // Camada intermediária de folhagem verde esmeralda
      ctx.fillStyle = '#2d6a4f';
      ctx.beginPath();
      ctx.arc(12, 16, 10, 0, Math.PI * 2);
      ctx.arc(20, 16, 10, 0, Math.PI * 2);
      ctx.arc(16, 12, 11, 0, Math.PI * 2);
      ctx.fill();

      // Realces superiores de luz
      ctx.fillStyle = '#40916c';
      ctx.beginPath();
      ctx.arc(14, 13, 7, 0, Math.PI * 2);
      ctx.arc(19, 13, 6, 0, Math.PI * 2);
      ctx.fill();

      // Detalhes brilhantes de folhas e brotos
      ctx.fillStyle = '#52b788';
      ctx.fillRect(13, 10, 3, 3);
      ctx.fillRect(18, 12, 2, 2);
      ctx.fillRect(11, 17, 2, 2);
      ctx.fillRect(20, 18, 2, 2);

      canopyCanvas.refresh();
    }
  }

  private static generatePillarProp(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('prop_pillar', 16, 32);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 16, 32);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(8, 30, 7, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#343a40';
    ctx.fillRect(2, 24, 12, 7);

    ctx.fillStyle = '#495057';
    ctx.fillRect(4, 6, 8, 18);
    ctx.fillStyle = '#6c757d';
    ctx.fillRect(5, 6, 3, 18);

    ctx.fillStyle = '#343a40';
    ctx.fillRect(2, 2, 12, 5);
    ctx.fillStyle = '#adb5bd';
    ctx.fillRect(4, 3, 8, 2);

    canvas.refresh();
  }

  private static generateSlashFx(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('fx_slash', 18, 18);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 18, 18);
    // Arco cortante exterior em branco puro
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(9, 9, 7, -Math.PI / 3, Math.PI / 2);
    ctx.stroke();

    // Rastro interior luminoso dourado / ciano
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(9, 9, 6, -Math.PI / 4, Math.PI / 2.2);
    ctx.stroke();

    // Faísca na ponta do arco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 9, 2, 2);

    canvas.refresh();
  }

  private static generateProjectileFx(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('fx_projectile', 12, 12);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 12, 12);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(6, 6, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, 5, 2, 2);

    canvas.refresh();
  }

  private static generateArrowFx(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('fx_arrow', 16, 7);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 16, 7);

    // Haste de madeira (centro y=3)
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(3, 3, 10, 1);

    // Ponta metálica afiada (à direita)
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(13, 2, 2, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 3, 1, 1);

    // Penas traseiras (à esquerda)
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillRect(1, 4, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 2, 1, 3);

    canvas.refresh();
  }

  private static generateMagicOrbFx(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('fx_magic_orb', 14, 14);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 14, 14);

    // Halo externo translúcido
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.beginPath();
    ctx.arc(7, 7, 6, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo energético azul
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(7, 7, 4, 0, Math.PI * 2);
    ctx.fill();

    // Centro branco resplandecente
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(7, 7, 2, 0, Math.PI * 2);
    ctx.fill();

    // Faíscas orbitais
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, 1, 1, 1);
    ctx.fillRect(12, 7, 1, 1);
    ctx.fillRect(7, 12, 1, 1);
    ctx.fillRect(1, 7, 1, 1);

    canvas.refresh();
  }

  private static generateNatureBurstFx(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('fx_nature_burst', 16, 16);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 16, 16);

    // Espiral de folhas verdes
    ctx.fillStyle = '#15803d';
    ctx.fillRect(6, 2, 4, 2);
    ctx.fillRect(12, 6, 2, 4);
    ctx.fillRect(6, 12, 4, 2);
    ctx.fillRect(2, 6, 2, 4);

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(7, 3, 2, 2);
    ctx.fillRect(11, 7, 2, 2);
    ctx.fillRect(7, 11, 2, 2);
    ctx.fillRect(3, 7, 2, 2);

    // Núcleo com seiva e esmeralda
    ctx.fillStyle = '#facc15';
    ctx.fillRect(7, 7, 2, 2);

    canvas.refresh();
  }

  private static generateImpactSparkFx(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('fx_impact_spark', 14, 14);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 14, 14);

    // Faíscas cruzadas
    ctx.fillStyle = '#facc15';
    ctx.fillRect(6, 1, 2, 12);
    ctx.fillRect(1, 6, 12, 2);

    // Pontas brancas de alto brilho
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6, 6, 2, 2);
    ctx.fillRect(6, 2, 2, 1);
    ctx.fillRect(6, 11, 2, 1);
    ctx.fillRect(2, 6, 1, 2);
    ctx.fillRect(11, 6, 1, 2);

    // Diagonais curtas
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(3, 3, 2, 2);
    ctx.fillRect(9, 3, 2, 2);
    ctx.fillRect(3, 9, 2, 2);
    ctx.fillRect(9, 9, 2, 2);

    canvas.refresh();
  }

  private static generateHealAuraFx(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('fx_heal_aura', 16, 16);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 16, 16);

    // Cruz medicinal esmeralda
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(6, 2, 4, 12);
    ctx.fillRect(2, 6, 12, 4);

    // Centro verde brilhante
    ctx.fillStyle = '#86efac';
    ctx.fillRect(7, 3, 2, 10);
    ctx.fillRect(3, 7, 10, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, 7, 2, 2);

    canvas.refresh();
  }

  // --- NÓS DE COLETA (GATHERING NODES) ---

  private static generateOreNode(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('node_ore', 20, 20);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 20, 20);

    // Sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(10, 17, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rocha base
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(3, 16);
    ctx.lineTo(6, 6);
    ctx.lineTo(14, 5);
    ctx.lineTo(17, 16);
    ctx.closePath();
    ctx.fill();

    // Veios de ferro metálico brilhante
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(8, 8, 4, 3);
    ctx.fillRect(11, 11, 3, 3);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(9, 8, 1, 2);
    ctx.fillRect(12, 11, 1, 1);

    canvas.refresh();
  }

  private static generateHerbNode(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('node_herb', 16, 16);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 16, 16);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(8, 14, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Folhagem da erva medicinal
    ctx.fillStyle = '#15803d';
    ctx.fillRect(4, 8, 8, 6);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(6, 4, 4, 6);
    ctx.fillRect(3, 6, 3, 3);
    ctx.fillRect(10, 6, 3, 3);

    // Flor medicinal lilás no topo
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(7, 3, 2, 2);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(7, 4, 1, 1);

    canvas.refresh();
  }

  private static generateAnvilProp(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('prop_anvil', 20, 24);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 20, 24);

    // Sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(10, 21, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tronco base de suporte
    ctx.fillStyle = '#78350f';
    ctx.fillRect(6, 12, 8, 9);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(7, 12, 6, 9);

    // Bigorna de metal fundido
    ctx.fillStyle = '#334155';
    ctx.fillRect(4, 7, 12, 5);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(2, 6, 16, 3);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(3, 6, 13, 1);

    canvas.refresh();
  }

  private static generateDropBag(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('item_drop_bag', 12, 12);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 12, 12);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(6, 10, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Saquinho de couro com fita dourada
    ctx.fillStyle = '#b45309';
    ctx.fillRect(3, 4, 6, 6);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(4, 3, 4, 2);
    ctx.fillRect(5, 5, 2, 1);

    canvas.refresh();
  }

  /**
   * Gera ícones de 16x16 pixels para cada um dos itens definidos
   */
  private static generateItemIcons(scene: Phaser.Scene): void {
    const icons: Array<{ key: string; draw: (ctx: CanvasRenderingContext2D) => void }> = [
      {
        key: 'icon_wood',
        draw: ctx => {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(3, 5, 10, 6);
          ctx.fillStyle = '#d97706';
          ctx.fillRect(3, 6, 2, 4);
          ctx.fillRect(11, 6, 2, 4);
        }
      },
      {
        key: 'icon_ore',
        draw: ctx => {
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(8, 8, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(6, 6, 3, 2);
          ctx.fillRect(9, 9, 2, 2);
        }
      },
      {
        key: 'icon_herb',
        draw: ctx => {
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(8, 8, 4, 6, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#86efac';
          ctx.fillRect(7, 7, 2, 2);
        }
      },
      {
        key: 'icon_gel',
        draw: ctx => {
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(8, 9, 5, Math.PI, 0);
          ctx.fillRect(3, 9, 10, 3);
          ctx.fill();
          ctx.fillStyle = '#a7f3d0';
          ctx.fillRect(6, 6, 2, 2);
        }
      },
      {
        key: 'icon_leather',
        draw: ctx => {
          ctx.fillStyle = '#92400e';
          ctx.fillRect(3, 4, 10, 8);
          ctx.fillStyle = '#fde68a';
          ctx.fillRect(5, 7, 6, 1);
        }
      },
      {
        key: 'icon_potion_hp',
        draw: ctx => {
          ctx.fillStyle = '#78350f'; // Rolha
          ctx.fillRect(6, 2, 4, 2);
          ctx.fillStyle = '#e11d48'; // Vidro e líquido vermelho
          ctx.beginPath();
          ctx.arc(8, 10, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fecdd3'; // Brilho
          ctx.fillRect(6, 8, 2, 2);
        }
      },
      {
        key: 'icon_potion_mp',
        draw: ctx => {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(6, 2, 4, 2);
          ctx.fillStyle = '#0284c7'; // Líquido azul
          ctx.beginPath();
          ctx.arc(8, 10, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#bae6fd';
          ctx.fillRect(6, 8, 2, 2);
        }
      },
      {
        key: 'icon_pickaxe',
        draw: ctx => {
          ctx.fillStyle = '#92400e'; // Cabo
          ctx.fillRect(4, 11, 2, 2);
          ctx.fillRect(6, 9, 2, 2);
          ctx.fillRect(8, 7, 2, 2);
          ctx.fillStyle = '#94a3b8'; // Lâmina curva
          ctx.fillRect(6, 3, 7, 2);
          ctx.fillRect(11, 4, 2, 3);
          ctx.fillRect(5, 4, 2, 3);
        }
      },
      {
        key: 'icon_sword',
        draw: ctx => {
          ctx.fillStyle = '#94a3b8'; // Lâmina
          ctx.fillRect(9, 3, 2, 7);
          ctx.fillRect(8, 4, 4, 1);
          ctx.fillStyle = '#f59e0b'; // Guarda
          ctx.fillRect(6, 10, 8, 2);
          ctx.fillStyle = '#78350f'; // Empunhadura
          ctx.fillRect(9, 12, 2, 3);
        }
      },
      {
        key: 'icon_armor',
        draw: ctx => {
          ctx.fillStyle = '#92400e';
          ctx.fillRect(4, 3, 8, 10);
          ctx.fillStyle = '#b45309';
          ctx.fillRect(3, 4, 10, 4);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(6, 7, 4, 2);
        }
      },
      {
        key: 'icon_ring',
        draw: ctx => {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.strokeRect(5, 6, 6, 6);
          ctx.fillStyle = '#ef4444'; // Gema vermelha
          ctx.fillRect(7, 3, 2, 3);
        }
      },
      {
        key: 'ui_action_interact',
        draw: ctx => {
          // Ícone de mãozinha/ferramenta de interação pixel art
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(5, 4, 2, 7);
          ctx.fillRect(8, 3, 2, 8);
          ctx.fillRect(11, 5, 2, 6);
          ctx.fillRect(4, 9, 9, 4);
          ctx.fillRect(2, 8, 3, 3);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(5, 5, 1, 3);
          ctx.fillRect(8, 4, 1, 4);
        }
      },
      {
        key: 'icon_bone',
        draw: ctx => {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(3, 3, 3, 3);
          ctx.fillRect(3, 10, 3, 3);
          ctx.fillRect(10, 3, 3, 3);
          ctx.fillRect(10, 10, 3, 3);
          ctx.fillRect(5, 5, 6, 6);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(5, 7, 6, 2);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(4, 11, 2, 2);
          ctx.fillRect(10, 11, 2, 2);
        }
      },
      {
        key: 'icon_potion_hp_medium',
        draw: ctx => {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(6, 1, 4, 2);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(5, 3, 6, 1);
          ctx.fillStyle = '#be123c';
          ctx.beginPath();
          ctx.arc(8, 10, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fda4af';
          ctx.fillRect(5, 7, 3, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(6, 8, 1, 1);
        }
      },
      {
        key: 'icon_bow',
        draw: ctx => {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(4, 2, 3, 2);
          ctx.fillRect(3, 4, 2, 3);
          ctx.fillRect(2, 7, 2, 3);
          ctx.fillRect(3, 10, 2, 3);
          ctx.fillRect(4, 13, 3, 2);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(2, 7, 2, 2);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(7, 3, 1, 11);
        }
      }
    ];

    icons.forEach(item => {
      if (!scene.textures.exists(item.key)) {
        const canvas = scene.textures.createCanvas(item.key, 16, 16);
        if (canvas) {
          const ctx = canvas.getContext();
          ctx.clearRect(0, 0, 16, 16);
          item.draw(ctx);
          canvas.refresh();
        }
      }
    });
  }
}
