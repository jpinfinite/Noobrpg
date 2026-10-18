import Phaser from 'phaser';

/**
 * Utilitário responsável por gerar texturas procedurais em pixel art limpas e de alta qualidade
 * diretamente no gerenciador de texturas do Phaser para o NoobRPG.
 */
export class TextureGenerator {
  public static generateAll(scene: Phaser.Scene): void {
    if (!scene.textures.exists('tileset_prototype')) {
      this.generateTileset(scene);
    }
    // 4 Classes de heróis
    if (!scene.textures.exists('hero_warrior')) {
      this.generateHeroSpritesheet(scene, 'hero_warrior', '#2563eb', '#94a3b8', '#dc2626');
    }
    if (!scene.textures.exists('hero_ranger')) {
      this.generateHeroSpritesheet(scene, 'hero_ranger', '#15803d', '#22c55e', '#b45309');
    }
    if (!scene.textures.exists('hero_mage')) {
      this.generateHeroSpritesheet(scene, 'hero_mage', '#7c3aed', '#a855f7', '#06b6d4');
    }
    if (!scene.textures.exists('hero_druid')) {
      this.generateHeroSpritesheet(scene, 'hero_druid', '#4d7c0f', '#84cc16', '#eab308');
    }

    // Props
    if (!scene.textures.exists('prop_tree')) {
      this.generateTreeProp(scene);
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

    // Efeitos visuais (FX)
    if (!scene.textures.exists('fx_slash')) {
      this.generateSlashFx(scene);
    }
    if (!scene.textures.exists('fx_projectile')) {
      this.generateProjectileFx(scene);
    }
  }

  private static generateTileset(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('tileset_prototype', 128, 32);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 128, 32);

    // 1. Grama Verde Rica (Tile 1: x=0..15, y=0..15)
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

    // 2. Terra / Caminho Rústico (Tile 2: x=16..31, y=0..15)
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(16, 0, 16, 16);
    ctx.fillStyle = '#a06a3b';
    ctx.fillRect(18, 3, 4, 3);
    ctx.fillRect(24, 8, 3, 3);
    ctx.fillRect(19, 11, 4, 2);
    ctx.fillStyle = '#6f4518';
    ctx.fillRect(20, 5, 2, 1);
    ctx.fillRect(22, 12, 1, 1);

    // 3. Pavimento de Pedra Cinza (Tile 3: x=32..47, y=0..15)
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

    // 4. Parede de Masmorra / Tijolos Sólidos (Tile 4: x=48..63, y=0..15)
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

    // 5. Água Azul com Ondulação (Tile 5: x=64..79, y=0..15)
    ctx.fillStyle = '#0077b6';
    ctx.fillRect(64, 0, 16, 16);
    ctx.fillStyle = '#0096c7';
    ctx.fillRect(66, 3, 5, 2);
    ctx.fillRect(72, 8, 6, 2);
    ctx.fillRect(65, 12, 4, 2);
    ctx.fillStyle = '#90e0ef';
    ctx.fillRect(67, 3, 2, 1);
    ctx.fillRect(73, 8, 3, 1);

    // 6. Flores Amarelas sobre Grama (Tile 6: x=80..95, y=0..15)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(80, 0, 16, 16);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(83, 4, 3, 3);
    ctx.fillRect(89, 9, 3, 3);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(84, 5, 1, 1);
    ctx.fillRect(90, 10, 1, 1);

    // 7. Flores Vermelhas sobre Grama (Tile 7: x=96..111, y=0..15)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(96, 0, 16, 16);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(99, 4, 3, 3);
    ctx.fillRect(104, 10, 3, 3);
    ctx.fillStyle = '#ffe4e6';
    ctx.fillRect(100, 5, 1, 1);
    ctx.fillRect(105, 11, 1, 1);

    // 8. Cerca de Madeira Rústica (Tile 8: x=112..127, y=0..15)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(112, 0, 16, 16);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(114, 2, 3, 14);
    ctx.fillRect(122, 2, 3, 14);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(112, 5, 16, 3);
    ctx.fillRect(112, 11, 16, 3);

    canvas.refresh();
  }

  /**
   * Gera spritesheet de 64x72 para uma classe de herói customizada
   */
  private static generateHeroSpritesheet(
    scene: Phaser.Scene,
    textureKey: string,
    tunicColor: string,
    helmetColor: string,
    accentColor: string
  ): void {
    const canvas = scene.textures.createCanvas(textureKey, 64, 72);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 64, 72);

    for (let dir = 0; dir < 3; dir++) {
      const yOffset = dir * 24;
      for (let frame = 0; frame < 4; frame++) {
        const xOffset = frame * 16;
        this.drawHeroFrame(ctx, xOffset, yOffset, dir, frame, tunicColor, helmetColor, accentColor);
      }
    }

    canvas.refresh();
  }

  private static drawHeroFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: number,
    frame: number,
    tunicColor: string,
    helmetColor: string,
    accentColor: string
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 22, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const legOffset = frame === 1 ? -1 : frame === 3 ? 1 : 0;

    if (direction === 0) {
      // FRENTE (DOWN)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 4);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 4);

      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 4, y + 16, 8, 3);

      ctx.fillStyle = tunicColor;
      ctx.fillRect(x + 3, y + 10, 10, 6);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 4, y + 15, 8, 1);
      ctx.fillRect(x + 7, y + 14, 2, 2);

      ctx.fillStyle = tunicColor;
      ctx.fillRect(x + 2, y + 11 + legOffset, 2, 4);
      ctx.fillRect(x + 12, y + 11 - legOffset, 2, 4);

      ctx.fillStyle = helmetColor;
      ctx.fillRect(x + 4, y + 3, 8, 7);
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(x + 5, y + 6, 6, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 6, y + 7, 1, 1);
      ctx.fillRect(x + 9, y + 7, 1, 1);

      ctx.fillStyle = accentColor;
      ctx.fillRect(x + 7, y + 1, 2, 3);
    } else if (direction === 1) {
      // COSTAS (UP)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 4);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 4);

      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 4, y + 16, 8, 3);

      ctx.fillStyle = tunicColor;
      ctx.fillRect(x + 3, y + 10, 10, 7);

      ctx.fillStyle = tunicColor;
      ctx.fillRect(x + 2, y + 11 - legOffset, 2, 4);
      ctx.fillRect(x + 12, y + 11 + legOffset, 2, 4);

      ctx.fillStyle = helmetColor;
      ctx.fillRect(x + 4, y + 3, 8, 7);

      ctx.fillStyle = accentColor;
      ctx.fillRect(x + 7, y + 1, 2, 3);
    } else {
      // DIREITA (RIGHT)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 6 + legOffset, y + 19, 4, 4);
      ctx.fillRect(x + 4 - legOffset, y + 19, 4, 4);

      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 5, y + 16, 6, 3);

      ctx.fillStyle = tunicColor;
      ctx.fillRect(x + 4, y + 10, 7, 6);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 5, y + 15, 6, 1);

      ctx.fillStyle = tunicColor;
      ctx.fillRect(x + 7 + legOffset, y + 11, 2, 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 2, y + 11, 2, 6);

      ctx.fillStyle = helmetColor;
      ctx.fillRect(x + 5, y + 3, 7, 7);
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(x + 9, y + 6, 3, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 10, y + 7, 1, 1);

      ctx.fillStyle = accentColor;
      ctx.fillRect(x + 6, y + 1, 3, 3);
    }
  }

  /**
   * Spritesheet de Slime Verde (32x16 px, 2 quadros 16x16)
   */
  private static generateSlimeSpritesheet(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('mob_slime', 32, 16);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 32, 16);

    // Frame 0: Idle gelatinoso
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(8, 14, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#10b981'; // Verde esmeralda base
    ctx.beginPath();
    ctx.arc(8, 9, 6, Math.PI, 0);
    ctx.fillRect(2, 9, 12, 4);
    ctx.fill();

    ctx.fillStyle = '#34d399'; // Brilho superior
    ctx.fillRect(5, 5, 4, 2);

    // Olhos do Slime
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(5, 8, 2, 3);
    ctx.fillRect(9, 8, 2, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, 8, 1, 1);
    ctx.fillRect(9, 8, 1, 1);

    // Frame 1: Salto / Ataque (achatado e projetado)
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

    canvas.refresh();
  }

  /**
   * Spritesheet de Goblin Soldado (32x24 px, 2 quadros 16x24)
   */
  private static generateGoblinSpritesheet(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('mob_goblin', 32, 24);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 32, 24);

    // Frame 0: Goblin postura de guarda
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(8, 22, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pernas e tanga de couro
    ctx.fillStyle = '#78350f';
    ctx.fillRect(5, 16, 6, 5);

    // Tronco verde oliva
    ctx.fillStyle = '#65a30d';
    ctx.fillRect(4, 10, 8, 6);

    // Cabeça e orelhas pontudas
    ctx.fillStyle = '#84cc16';
    ctx.fillRect(5, 4, 6, 6);
    ctx.fillRect(2, 5, 3, 2); // Orelha esquerda
    ctx.fillRect(11, 5, 3, 2); // Orelha direita

    // Olhos vermelhos malévolos
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(6, 6, 1, 2);
    ctx.fillRect(9, 6, 1, 2);

    // Adaga enferrujada
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(12, 12, 2, 6);
    ctx.fillStyle = '#475569';
    ctx.fillRect(11, 14, 4, 1);

    // Frame 1: Goblin atacando (avanço da adaga)
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

    // Adaga projetada para a frente
    ctx.fillStyle = '#f87171';
    ctx.fillRect(x2 + 11, 10, 4, 2);

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

  /**
   * Efeito visual de corte de espada (16x16 px)
   */
  private static generateSlashFx(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('fx_slash', 16, 16);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 16, 16);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8, 8, 6, -Math.PI / 4, Math.PI / 2);
    ctx.stroke();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1;
    ctx.stroke();

    canvas.refresh();
  }

  /**
   * Efeito visual de projétil arcano / flecha (12x12 px)
   */
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
}
