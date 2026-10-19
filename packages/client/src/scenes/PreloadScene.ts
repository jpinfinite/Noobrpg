import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  public preload(): void {
    const assetsBaseUrl = ((import.meta as any).env?.VITE_ASSETS_BASE_URL as string) || './assets';
    const cleanBase = assetsBaseUrl.endsWith('/') ? assetsBaseUrl.slice(0, -1) : assetsBaseUrl;
    this.load.tilemapTiledJSON('map_prototype', `${cleanBase}/maps/map_prototype.json`);

    // Carregamento dos spritesheets pixel art das 4 classes de personagens (Fase 3.4)
    const heroSheets = [
      // Warrior
      { key: 'sheet_warrior_idle_down', path: `${cleanBase}/sprites/warrior/experimental_16x24/sheets/warrior_idle_down.png`, width: 20, height: 24 },
      { key: 'sheet_warrior_walk_down', path: `${cleanBase}/sprites/warrior/experimental_16x24/sheets/warrior_walk_down.png`, width: 20, height: 24 },
      { key: 'sheet_warrior_walk_up', path: `${cleanBase}/sprites/warrior/experimental_16x24/sheets/warrior_walk_up.png`, width: 16, height: 24 },
      { key: 'sheet_warrior_walk_left', path: `${cleanBase}/sprites/warrior/experimental_16x24/sheets/warrior_walk_left.png`, width: 16, height: 24 },
      { key: 'sheet_warrior_walk_right', path: `${cleanBase}/sprites/warrior/experimental_16x24/sheets/warrior_walk_right.png`, width: 16, height: 24 },
      { key: 'sheet_warrior_attack_down', path: `${cleanBase}/sprites/warrior/experimental_16x24/sheets/warrior_attack_down.png`, width: 24, height: 24 },
      { key: 'sheet_warrior_hurt', path: `${cleanBase}/sprites/warrior/experimental_16x24/sheets/warrior_hurt.png`, width: 16, height: 24 },
      { key: 'sheet_warrior_death', path: `${cleanBase}/sprites/warrior/experimental_16x24/sheets/warrior_death.png`, width: 24, height: 24 },

      // Ranger
      { key: 'sheet_ranger_idle_down', path: `${cleanBase}/sprites/ranger/experimental_16x24/sheets/ranger_idle_down.png`, width: 18, height: 24 },
      { key: 'sheet_ranger_walk_down', path: `${cleanBase}/sprites/ranger/experimental_16x24/sheets/ranger_walk_down.png`, width: 18, height: 24 },
      { key: 'sheet_ranger_walk_up', path: `${cleanBase}/sprites/ranger/experimental_16x24/sheets/ranger_walk_up.png`, width: 16, height: 24 },
      { key: 'sheet_ranger_walk_left', path: `${cleanBase}/sprites/ranger/experimental_16x24/sheets/ranger_walk_left.png`, width: 16, height: 24 },
      { key: 'sheet_ranger_attack_right', path: `${cleanBase}/sprites/ranger/experimental_16x24/sheets/ranger_attack_right.png`, width: 54, height: 24 },
      { key: 'sheet_ranger_hurt', path: `${cleanBase}/sprites/ranger/experimental_16x24/sheets/ranger_hurt.png`, width: 18, height: 24 },
      { key: 'sheet_ranger_death', path: `${cleanBase}/sprites/ranger/experimental_16x24/sheets/ranger_death.png`, width: 24, height: 24 },

      // Mage
      { key: 'sheet_mage_idle_down', path: `${cleanBase}/sprites/mage/experimental_16x24/sheets/mage_idle_down.png`, width: 20, height: 24 },
      { key: 'sheet_mage_walk_down', path: `${cleanBase}/sprites/mage/experimental_16x24/sheets/mage_walk_down.png`, width: 20, height: 24 },
      { key: 'sheet_mage_walk_up', path: `${cleanBase}/sprites/mage/experimental_16x24/sheets/mage_walk_up.png`, width: 16, height: 24 },
      { key: 'sheet_mage_attack_down', path: `${cleanBase}/sprites/mage/experimental_16x24/sheets/mage_attack_down.png`, width: 60, height: 24 },
      { key: 'sheet_mage_hurt', path: `${cleanBase}/sprites/mage/experimental_16x24/sheets/mage_hurt.png`, width: 20, height: 24 },
      { key: 'sheet_mage_death', path: `${cleanBase}/sprites/mage/experimental_16x24/sheets/mage_death.png`, width: 26, height: 24 },

      // Druid
      { key: 'sheet_druid_idle_down', path: `${cleanBase}/sprites/druid/experimental_16x24/sheets/druid_idle_down.png`, width: 20, height: 24 },
      { key: 'sheet_druid_walk_down', path: `${cleanBase}/sprites/druid/experimental_16x24/sheets/druid_walk_down.png`, width: 20, height: 24 },
      { key: 'sheet_druid_walk_up', path: `${cleanBase}/sprites/druid/experimental_16x24/sheets/druid_walk_up.png`, width: 16, height: 24 },
      { key: 'sheet_druid_walk_left', path: `${cleanBase}/sprites/druid/experimental_16x24/sheets/druid_walk_left.png`, width: 16, height: 24 },
      { key: 'sheet_druid_attack_down', path: `${cleanBase}/sprites/druid/experimental_16x24/sheets/druid_attack_down.png`, width: 58, height: 24 },
      { key: 'sheet_druid_hurt', path: `${cleanBase}/sprites/druid/experimental_16x24/sheets/druid_hurt.png`, width: 18, height: 24 },
      { key: 'sheet_druid_death', path: `${cleanBase}/sprites/druid/experimental_16x24/sheets/druid_death.png`, width: 24, height: 24 }
    ];

    heroSheets.forEach(sheet => {
      this.load.spritesheet(sheet.key, sheet.path, {
        frameWidth: sheet.width,
        frameHeight: sheet.height
      });
    });
  }

  public create(): void {
    this.createHeroAnimations();
    this.createMonsterAnimations();
    this.scene.start('LoginScene');
  }

  private createHeroAnimations(): void {
    const classConfigs: Array<{
      cls: string;
      heroKey: string;
      walkLeftSheet?: string;
      walkRightSheet?: string;
      attackSheet: string;
    }> = [
      {
        cls: 'warrior',
        heroKey: 'hero_warrior',
        walkLeftSheet: 'sheet_warrior_walk_left',
        walkRightSheet: 'sheet_warrior_walk_right',
        attackSheet: 'sheet_warrior_attack_down'
      },
      {
        cls: 'ranger',
        heroKey: 'hero_ranger',
        walkLeftSheet: 'sheet_ranger_walk_left',
        attackSheet: 'sheet_ranger_attack_right'
      },
      {
        cls: 'mage',
        heroKey: 'hero_mage',
        attackSheet: 'sheet_mage_attack_down'
      },
      {
        cls: 'druid',
        heroKey: 'hero_druid',
        walkLeftSheet: 'sheet_druid_walk_left',
        attackSheet: 'sheet_druid_attack_down'
      }
    ];

    classConfigs.forEach(cfg => {
      const prefixes = [cfg.heroKey];
      if (cfg.cls === 'warrior') {
        prefixes.push('hero'); // Compatibilidade retroativa
      }

      prefixes.forEach(prefix => {
        // 1. IDLE DOWN (4 quadros a 5 fps)
        if (this.textures.exists(`sheet_${cfg.cls}_idle_down`)) {
          this.anims.create({
            key: `${prefix}_idle_down`,
            frames: this.anims.generateFrameNumbers(`sheet_${cfg.cls}_idle_down`, { start: 0, end: 3 }),
            frameRate: 5,
            repeat: -1
          });
        }

        // 2. WALK DOWN (4 quadros a 8 fps)
        if (this.textures.exists(`sheet_${cfg.cls}_walk_down`)) {
          this.anims.create({
            key: `${prefix}_walk_down`,
            frames: this.anims.generateFrameNumbers(`sheet_${cfg.cls}_walk_down`, { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
          });
        }

        // 3. IDLE UP & WALK UP
        if (this.textures.exists(`sheet_${cfg.cls}_walk_up`)) {
          this.anims.create({
            key: `${prefix}_idle_up`,
            frames: [{ key: `sheet_${cfg.cls}_walk_up`, frame: 0 }],
            frameRate: 1
          });
          this.anims.create({
            key: `${prefix}_walk_up`,
            frames: this.anims.generateFrameNumbers(`sheet_${cfg.cls}_walk_up`, { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
          });
        }

        // 4. IDLE RIGHT & WALK RIGHT (ou lateral espelhado com flipX)
        const sideSheet = cfg.walkRightSheet || cfg.walkLeftSheet || `sheet_${cfg.cls}_walk_down`;
        if (this.textures.exists(sideSheet)) {
          this.anims.create({
            key: `${prefix}_idle_right`,
            frames: [{ key: sideSheet, frame: 0 }],
            frameRate: 1
          });
          this.anims.create({
            key: `${prefix}_walk_right`,
            frames: this.anims.generateFrameNumbers(sideSheet, { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
          });
        }

        // 5. WALK LEFT (se houver sheet dedicada)
        if (cfg.walkLeftSheet && this.textures.exists(cfg.walkLeftSheet)) {
          this.anims.create({
            key: `${prefix}_idle_left`,
            frames: [{ key: cfg.walkLeftSheet, frame: 0 }],
            frameRate: 1
          });
          this.anims.create({
            key: `${prefix}_walk_left`,
            frames: this.anims.generateFrameNumbers(cfg.walkLeftSheet, { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
          });
        }

        // 6. ATTACK
        if (this.textures.exists(cfg.attackSheet)) {
          this.anims.create({
            key: `${prefix}_attack`,
            frames: this.anims.generateFrameNumbers(cfg.attackSheet, { start: 0, end: 3 }),
            frameRate: 10,
            repeat: 0
          });
        }

        // 7. HURT (Reação a dano em 2 quadros)
        if (this.textures.exists(`sheet_${cfg.cls}_hurt`)) {
          this.anims.create({
            key: `${prefix}_hurt`,
            frames: this.anims.generateFrameNumbers(`sheet_${cfg.cls}_hurt`, { start: 0, end: 1 }),
            frameRate: 8,
            repeat: 0
          });
        }

        // 8. DEATH (Queda e morte em 4 quadros)
        if (this.textures.exists(`sheet_${cfg.cls}_death`)) {
          this.anims.create({
            key: `${prefix}_death`,
            frames: this.anims.generateFrameNumbers(`sheet_${cfg.cls}_death`, { start: 0, end: 3 }),
            frameRate: 6,
            repeat: 0
          });
        }

        // Fallback procedural transparente caso a spritesheet externa não esteja carregada
        if (!this.anims.exists(`${prefix}_idle_down`)) {
          this.anims.create({
            key: `${prefix}_idle_down`,
            frames: [{ key: cfg.heroKey, frame: 0 }],
            frameRate: 1
          });
        }
        if (!this.anims.exists(`${prefix}_walk_down`)) {
          this.anims.create({
            key: `${prefix}_walk_down`,
            frames: [
              { key: cfg.heroKey, frame: 1 },
              { key: cfg.heroKey, frame: 0 },
              { key: cfg.heroKey, frame: 3 },
              { key: cfg.heroKey, frame: 0 }
            ],
            frameRate: 8,
            repeat: -1
          });
        }
        if (!this.anims.exists(`${prefix}_idle_up`)) {
          this.anims.create({
            key: `${prefix}_idle_up`,
            frames: [{ key: cfg.heroKey, frame: 4 }],
            frameRate: 1
          });
        }
        if (!this.anims.exists(`${prefix}_walk_up`)) {
          this.anims.create({
            key: `${prefix}_walk_up`,
            frames: [
              { key: cfg.heroKey, frame: 5 },
              { key: cfg.heroKey, frame: 4 },
              { key: cfg.heroKey, frame: 7 },
              { key: cfg.heroKey, frame: 4 }
            ],
            frameRate: 8,
            repeat: -1
          });
        }
        if (!this.anims.exists(`${prefix}_idle_right`)) {
          this.anims.create({
            key: `${prefix}_idle_right`,
            frames: [{ key: cfg.heroKey, frame: 8 }],
            frameRate: 1
          });
        }
        if (!this.anims.exists(`${prefix}_walk_right`)) {
          this.anims.create({
            key: `${prefix}_walk_right`,
            frames: [
              { key: cfg.heroKey, frame: 9 },
              { key: cfg.heroKey, frame: 8 },
              { key: cfg.heroKey, frame: 11 },
              { key: cfg.heroKey, frame: 8 }
            ],
            frameRate: 8,
            repeat: -1
          });
        }
      });
    });
  }

  private createMonsterAnimations(): void {
    // 1. Slime (Frames 0: normal, 1: squash)
    this.anims.create({
      key: 'mob_slime_idle',
      frames: [{ key: 'mob_slime', frame: 0 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'mob_slime_walk',
      frames: [
        { key: 'mob_slime', frame: 0 },
        { key: 'mob_slime', frame: 1 },
        { key: 'mob_slime', frame: 0 }
      ],
      frameRate: 4,
      repeat: -1
    });

    // 2. Goblin (Frames 0: normal, 1: passo e ataque)
    this.anims.create({
      key: 'mob_goblin_idle',
      frames: [{ key: 'mob_goblin', frame: 0 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'mob_goblin_walk',
      frames: [
        { key: 'mob_goblin', frame: 0 },
        { key: 'mob_goblin', frame: 1 }
      ],
      frameRate: 5,
      repeat: -1
    });
    this.anims.create({
      key: 'mob_goblin_attack',
      frames: [{ key: 'mob_goblin', frame: 1 }],
      frameRate: 1
    });

    // 3. Esqueleto Guerreiro (Frames 0: idle ereto, 1: passo e corte com espada)
    this.anims.create({
      key: 'mob_skeleton_idle',
      frames: [{ key: 'mob_skeleton', frame: 0 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'mob_skeleton_walk',
      frames: [
        { key: 'mob_skeleton', frame: 0 },
        { key: 'mob_skeleton', frame: 1 }
      ],
      frameRate: 4,
      repeat: -1
    });
    this.anims.create({
      key: 'mob_skeleton_attack',
      frames: [{ key: 'mob_skeleton', frame: 1 }],
      frameRate: 2
    });
  }
}
