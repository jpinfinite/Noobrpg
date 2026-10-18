import Phaser from 'phaser';
import { CharacterClass, Direction, PlayerData, CLASS_BASE_ATTRIBUTES, normalizeVector } from '@noobrpg/shared';

export class Player extends Phaser.Physics.Arcade.Sprite {
  public playerData: PlayerData;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private currentDirection: Direction = Direction.DOWN;

  constructor(scene: Phaser.Scene, x: number, y: number, characterClass: CharacterClass = CharacterClass.WARRIOR) {
    super(scene, x, y, 'hero_prototype', 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const baseAttrs = CLASS_BASE_ATTRIBUTES[characterClass];
    this.playerData = {
      id: 'local_player_1',
      name: 'HeroiIniciante',
      characterClass,
      level: 1,
      currentXp: 0,
      gold: 100,
      meritPoints: 0,
      attributes: { ...baseAttrs },
      position: { x, y },
      direction: Direction.DOWN
    };

    this.initPhysics();
    this.initInput();
  }

  private initPhysics(): void {
    // Configura o ponto de âncora nos pés para profundidade correta
    this.setOrigin(0.5, 0.85);

    // Hitbox física calibrada nos pés do personagem
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 8);
    body.setOffset(2, 16);
    body.setCollideWorldBounds(true);
  }

  private initInput(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;

    this.cursors = keyboard.createCursorKeys();
    this.wasdKeys = {
      W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
  }

  public update(): void {
    this.handleMovement();
    // Y-Sorting dinâmico: profundidade no canvas é exatamente a coordenada Y dos pés
    this.setDepth(this.y);
    this.playerData.position.x = Math.round(this.x);
    this.playerData.position.y = Math.round(this.y);
    this.playerData.direction = this.currentDirection;
  }

  private handleMovement(): void {
    let inputX = 0;
    let inputY = 0;

    // Leitura simultânea de WASD e Setas do teclado
    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
      inputX -= 1;
    }
    if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
      inputX += 1;
    }
    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
      inputY -= 1;
    }
    if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
      inputY += 1;
    }

    // Normalização matemática do vetor 2D (previne velocidade extra na diagonal)
    const normalized = normalizeVector(inputX, inputY);
    const speed = this.playerData.attributes.speed;

    const velocityX = normalized.x * speed;
    const velocityY = normalized.y * speed;

    this.setVelocity(velocityX, velocityY);

    // Controle de Animação e Orientação
    const isMoving = inputX !== 0 || inputY !== 0;

    if (isMoving) {
      if (inputY > 0) {
        this.currentDirection = Direction.DOWN;
        this.setFlipX(false);
        this.anims.play('hero_walk_down', true);
      } else if (inputY < 0) {
        this.currentDirection = Direction.UP;
        this.setFlipX(false);
        this.anims.play('hero_walk_up', true);
      } else if (inputX > 0) {
        this.currentDirection = Direction.RIGHT;
        this.setFlipX(false);
        this.anims.play('hero_walk_right', true);
      } else if (inputX < 0) {
        this.currentDirection = Direction.LEFT;
        this.setFlipX(true);
        this.anims.play('hero_walk_right', true); // Reutiliza animação Leste espelhada
      }
    } else {
      // Parado (Idle) na última direção voltada
      if (this.currentDirection === Direction.DOWN) {
        this.setFlipX(false);
        this.anims.play('hero_idle_down', true);
      } else if (this.currentDirection === Direction.UP) {
        this.setFlipX(false);
        this.anims.play('hero_idle_up', true);
      } else if (this.currentDirection === Direction.RIGHT) {
        this.setFlipX(false);
        this.anims.play('hero_idle_right', true);
      } else if (this.currentDirection === Direction.LEFT) {
        this.setFlipX(true);
        this.anims.play('hero_idle_right', true);
      }
    }
  }
}
