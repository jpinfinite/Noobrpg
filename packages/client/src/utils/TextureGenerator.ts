import Phaser from 'phaser';

/**
 * Utilitário responsável por gerar texturas procedurais em pixel art limpas e de alta qualidade
 * diretamente no gerenciador de texturas do Phaser, permitindo execução instantânea sem depender
 * de ferramentas externas e facilitando a substituição futura por arquivos PNG do Aseprite.
 */
export class TextureGenerator {
  /**
   * Gera todos os assets pixel art necessários para a Fase 1.
   */
  public static generateAll(scene: Phaser.Scene): void {
    if (!scene.textures.exists('tileset_prototype')) {
      this.generateTileset(scene);
    }
    if (!scene.textures.exists('hero_prototype')) {
      this.generateHeroSpritesheet(scene);
    }
    if (!scene.textures.exists('prop_tree')) {
      this.generateTreeProp(scene);
    }
    if (!scene.textures.exists('prop_pillar')) {
      this.generatePillarProp(scene);
    }
  }

  /**
   * Gera o tileset 16x16 com 8 colunas e 2 linhas (128x32 px)
   */
  private static generateTileset(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('tileset_prototype', 128, 32);
    if (!canvas) return;
    const ctx = canvas.getContext();

    // Limpa o canvas
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
    // Linhas de rejunte das pedras
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
   * Gera o spritesheet do personagem (64x72 px = 4 frames x 3 direções, 16x24 por frame)
   */
  private static generateHeroSpritesheet(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('hero_prototype', 64, 72);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 64, 72);

    // Desenha os 4 frames para as 3 direções cardinais
    for (let dir = 0; dir < 3; dir++) {
      const yOffset = dir * 24;
      for (let frame = 0; frame < 4; frame++) {
        const xOffset = frame * 16;
        this.drawHeroFrame(ctx, xOffset, yOffset, dir, frame);
      }
    }

    canvas.refresh();
  }

  /**
   * Desenha um frame individual de 16x24 do herói
   */
  private static drawHeroFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: number, // 0 = Down, 1 = Up, 2 = Right
    frame: number
  ): void {
    // Sombra sutil sob os pés
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 22, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const legOffset = (frame === 1) ? -1 : (frame === 3) ? 1 : 0;

    if (direction === 0) {
      // --- FRENTE (DOWN) ---
      // Botas
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 4);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 4);

      // Calça
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 4, y + 16, 8, 3);

      // Túnica e Armadura Peitoral
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x + 3, y + 10, 10, 6);
      ctx.fillStyle = '#f59e0b'; // Cinto e fivela
      ctx.fillRect(x + 4, y + 15, 8, 1);
      ctx.fillRect(x + 7, y + 14, 2, 2);

      // Braços
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x + 2, y + 11 + legOffset, 2, 4);
      ctx.fillRect(x + 12, y + 11 - legOffset, 2, 4);

      // Cabeça / Elmo
      ctx.fillStyle = '#94a3b8'; // Metal do elmo
      ctx.fillRect(x + 4, y + 3, 8, 7);
      ctx.fillStyle = '#fed7aa'; // Rosto visível
      ctx.fillRect(x + 5, y + 6, 6, 3);
      ctx.fillStyle = '#0f172a'; // Olhos
      ctx.fillRect(x + 6, y + 7, 1, 1);
      ctx.fillRect(x + 9, y + 7, 1, 1);

      // Penacho do elmo
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x + 7, y + 1, 2, 3);
    } else if (direction === 1) {
      // --- COSTAS (UP) ---
      // Botas
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 4, y + 19 + (legOffset > 0 ? -1 : 0), 3, 4);
      ctx.fillRect(x + 9, y + 19 + (legOffset < 0 ? -1 : 0), 3, 4);

      // Calça
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 4, y + 16, 8, 3);

      // Capa azul nas costas
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x + 3, y + 10, 10, 7);

      // Braços por trás
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x + 2, y + 11 - legOffset, 2, 4);
      ctx.fillRect(x + 12, y + 11 + legOffset, 2, 4);

      // Elmo por trás
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 4, y + 3, 8, 7);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 5, y + 6, 6, 3);

      // Penacho
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x + 7, y + 1, 2, 3);
    } else {
      // --- PERFIL DIREITO (RIGHT) ---
      // Botas
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 6 + legOffset, y + 19, 4, 4);
      ctx.fillRect(x + 4 - legOffset, y + 19, 4, 4);

      // Calça
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 5, y + 16, 6, 3);

      // Tronco e armadura
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x + 4, y + 10, 7, 6);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 5, y + 15, 6, 1);

      // Braço e Espada embainhada
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x + 7 + legOffset, y + 11, 2, 4);
      ctx.fillStyle = '#cbd5e1'; // Lâmina
      ctx.fillRect(x + 2, y + 11, 2, 6);

      // Cabeça / Elmo de perfil
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 5, y + 3, 7, 7);
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(x + 9, y + 6, 3, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 10, y + 7, 1, 1);

      // Penacho
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x + 6, y + 1, 3, 3);
    }
  }

  /**
   * Gera o sprite de árvore frondosa (32x48 px) para o teste rigoroso de profundidade Y-sorting
   */
  private static generateTreeProp(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('prop_tree', 32, 48);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 32, 48);

    // Sombra no chão na base do tronco
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(16, 45, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tronco de madeira (y: 30..46)
    ctx.fillStyle = '#582f0e';
    ctx.fillRect(12, 30, 8, 15);
    ctx.fillStyle = '#7f4f24';
    ctx.fillRect(14, 30, 4, 15);

    // Copa da árvore em camadas esféricas (y: 2..34)
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

  /**
   * Gera o sprite de pilar de pedra talhada (16x32 px)
   */
  private static generatePillarProp(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas('prop_pillar', 16, 32);
    if (!canvas) return;
    const ctx = canvas.getContext();

    ctx.clearRect(0, 0, 16, 32);

    // Sombra na base
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(8, 30, 7, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Base do pilar
    ctx.fillStyle = '#343a40';
    ctx.fillRect(2, 24, 12, 7);

    // Corpo do pilar
    ctx.fillStyle = '#495057';
    ctx.fillRect(4, 6, 8, 18);
    ctx.fillStyle = '#6c757d';
    ctx.fillRect(5, 6, 3, 18);

    // Topo decorado
    ctx.fillStyle = '#343a40';
    ctx.fillRect(2, 2, 12, 5);
    ctx.fillStyle = '#adb5bd';
    ctx.fillRect(4, 3, 8, 2);

    canvas.refresh();
  }
}
