import Phaser from 'phaser';
import {
  CharacterClass,
  Direction,
  PlayerData,
  CLASS_COMBAT_CONFIG,
  calculateAttributesForLevel,
  evaluateLevelProgression,
  calculateDamage,
  calculateDistance,
  normalizeVector
} from '@noobrpg/shared';
import { Monster } from './Monster.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
  public playerData: PlayerData;
  public isDead: boolean = false;
  public isInvulnerable: boolean = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private actionKeys!: {
    attack: Phaser.Input.Keyboard.Key;
    skill1: Phaser.Input.Keyboard.Key;
    class1: Phaser.Input.Keyboard.Key;
    class2: Phaser.Input.Keyboard.Key;
    class3: Phaser.Input.Keyboard.Key;
    class4: Phaser.Input.Keyboard.Key;
  };

  private currentDirection: Direction = Direction.DOWN;
  private lastAttackTime: number = 0;
  private lastSkill1Time: number = 0;
  private respawnPoint = { x: 180, y: 160 };

  constructor(scene: Phaser.Scene, x: number, y: number, characterClass: CharacterClass = CharacterClass.WARRIOR) {
    const textureKey = Player.getTextureKeyForClass(characterClass);
    super(scene, x, y, textureKey, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const initialAttrs = calculateAttributesForLevel(characterClass, 1);
    this.playerData = {
      id: 'local_player_1',
      name: 'HeroiIniciante',
      characterClass,
      level: 1,
      currentXp: 0,
      gold: 100,
      meritPoints: 0,
      attributes: { ...initialAttrs },
      position: { x, y },
      direction: Direction.DOWN
    };

    this.respawnPoint = { x, y };
    this.initPhysics();
    this.initInput();
  }

  private static getTextureKeyForClass(c: CharacterClass): string {
    switch (c) {
      case CharacterClass.WARRIOR:
        return 'hero_warrior';
      case CharacterClass.RANGER:
        return 'hero_ranger';
      case CharacterClass.MAGE:
        return 'hero_mage';
      case CharacterClass.DRUID:
        return 'hero_druid';
    }
  }

  private initPhysics(): void {
    this.setOrigin(0.5, 0.85);
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

    this.actionKeys = {
      attack: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      skill1: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      class1: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      class2: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      class3: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      class4: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR)
    };
  }

  public updatePlayer(time: number, monsters: Monster[]): void {
    if (this.isDead) return;

    this.handleMovement();
    this.handleCombatInputs(time, monsters);
    this.handleClassSwitchInputs();

    this.setDepth(this.y);
    this.playerData.position.x = Math.round(this.x);
    this.playerData.position.y = Math.round(this.y);
    this.playerData.direction = this.currentDirection;
  }

  private handleMovement(): void {
    let inputX = 0;
    let inputY = 0;

    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) inputX -= 1;
    if (this.cursors.right.isDown || this.wasdKeys.D.isDown) inputX += 1;
    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) inputY -= 1;
    if (this.cursors.down.isDown || this.wasdKeys.S.isDown) inputY += 1;

    const normalized = normalizeVector(inputX, inputY);
    const speed = this.playerData.attributes.speed;

    this.setVelocity(normalized.x * speed, normalized.y * speed);

    const isMoving = inputX !== 0 || inputY !== 0;
    const animPrefix = this.getAnimPrefix();

    if (isMoving) {
      if (inputY > 0) {
        this.currentDirection = Direction.DOWN;
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_walk_down`, true);
      } else if (inputY < 0) {
        this.currentDirection = Direction.UP;
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_walk_up`, true);
      } else if (inputX > 0) {
        this.currentDirection = Direction.RIGHT;
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_walk_right`, true);
      } else if (inputX < 0) {
        this.currentDirection = Direction.LEFT;
        this.setFlipX(true);
        this.anims.play(`${animPrefix}_walk_right`, true);
      }
    } else {
      if (this.currentDirection === Direction.DOWN) {
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_idle_down`, true);
      } else if (this.currentDirection === Direction.UP) {
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_idle_up`, true);
      } else if (this.currentDirection === Direction.RIGHT) {
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_idle_right`, true);
      } else if (this.currentDirection === Direction.LEFT) {
        this.setFlipX(true);
        this.anims.play(`${animPrefix}_idle_right`, true);
      }
    }
  }

  private getAnimPrefix(): string {
    return 'hero';
  }

  private handleCombatInputs(time: number, monsters: Monster[]): void {
    const combatConfig = CLASS_COMBAT_CONFIG[this.playerData.characterClass];

    // Ataque básico (Tecla ESPAÇO)
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.attack)) {
      if (time - this.lastAttackTime >= combatConfig.attackCooldownMs) {
        this.lastAttackTime = time;
        this.executeBasicAttack(monsters, combatConfig.attackRange);
      }
    }

    // Habilidade 1 (Tecla E)
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.skill1)) {
      if (time - this.lastSkill1Time >= combatConfig.skill1CooldownMs) {
        if (this.playerData.attributes.currentMp >= combatConfig.skill1CostMp) {
          this.lastSkill1Time = time;
          this.playerData.attributes.currentMp -= combatConfig.skill1CostMp;
          this.executeSkill1(monsters);
        } else {
          this.scene.events.emit('floating-text', {
            x: this.x,
            y: this.y - 20,
            text: 'Sem Mana!',
            color: '#38bdf8'
          });
        }
      }
    }
  }

  private executeBasicAttack(monsters: Monster[], attackRange: number): void {
    // Efeito visual na frente do personagem
    const attackOffset = this.getDirectionOffset(20);
    const fx = this.scene.add.sprite(this.x + attackOffset.x, this.y + attackOffset.y, 'fx_slash');
    fx.setDepth(this.depth + 2);
    this.scene.time.delayedCall(150, () => fx.destroy());

    // Procura monstro vivo mais próximo dentro do alcance
    let closestTarget: Monster | null = null;
    let minDistance = attackRange;

    for (const mob of monsters) {
      if (!mob.active || !mob.visible || mob.currentHp <= 0) continue;
      const dist = calculateDistance(this.x, this.y, mob.x, mob.y);
      if (dist <= attackRange && dist < minDistance) {
        minDistance = dist;
        closestTarget = mob;
      }
    }

    if (closestTarget) {
      const damage = calculateDamage(this.playerData.attributes.attack, closestTarget.monsterConfig.defense);
      const result = closestTarget.takeDamage(damage);

      // Emite texto flutuante de dano no monstro
      this.scene.events.emit('floating-text', {
        x: closestTarget.x,
        y: closestTarget.y - 15,
        text: `-${damage}`,
        color: '#ffffff'
      });

      if (result.isDead && result.xpReward > 0) {
        this.gainXp(result.xpReward);
        this.playerData.gold += result.goldReward;
        this.scene.events.emit('floating-text', {
          x: closestTarget.x,
          y: closestTarget.y - 30,
          text: `+${result.xpReward} XP  +${result.goldReward} Gold`,
          color: '#facc15'
        });
      }
    }
  }

  private executeSkill1(monsters: Monster[]): void {
    const charClass = this.playerData.characterClass;

    if (charClass === CharacterClass.DRUID) {
      // Bênção da Natureza: Cura o próprio herói
      const healAmount = 35;
      this.playerData.attributes.currentHp = Math.min(
        this.playerData.attributes.maxHp,
        this.playerData.attributes.currentHp + healAmount
      );
      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 25,
        text: `+${healAmount} HP`,
        color: '#22c55e'
      });
      return;
    }

    // Para Guerreiro, Arqueiro e Mago: Habilidade de dano aumentado
    const multiplier = charClass === CharacterClass.RANGER ? 1.8 : 1.5;
    const range = charClass === CharacterClass.WARRIOR ? 36 : 140;

    let target: Monster | null = null;
    let minDistance = range;

    for (const mob of monsters) {
      if (!mob.active || !mob.visible || mob.currentHp <= 0) continue;
      const dist = calculateDistance(this.x, this.y, mob.x, mob.y);
      if (dist <= range && dist < minDistance) {
        minDistance = dist;
        target = mob;
      }
    }

    if (target) {
      const rawAtk = Math.round(this.playerData.attributes.attack * multiplier);
      const damage = calculateDamage(rawAtk, target.monsterConfig.defense);
      const result = target.takeDamage(damage);

      this.scene.events.emit('floating-text', {
        x: target.x,
        y: target.y - 20,
        text: `CRÍTICO! -${damage}`,
        color: '#facc15'
      });

      if (result.isDead && result.xpReward > 0) {
        this.gainXp(result.xpReward);
        this.playerData.gold += result.goldReward;
      }
    }
  }

  private getDirectionOffset(distance: number): { x: number; y: number } {
    switch (this.currentDirection) {
      case Direction.UP:
        return { x: 0, y: -distance };
      case Direction.DOWN:
        return { x: 0, y: distance };
      case Direction.LEFT:
        return { x: -distance, y: 0 };
      case Direction.RIGHT:
        return { x: distance, y: 0 };
      default:
        return { x: 0, y: distance };
    }
  }

  public takeDamage(amount: number, attacker: Monster): void {
    if (this.isDead || this.isInvulnerable) return;

    this.playerData.attributes.currentHp = Math.max(0, this.playerData.attributes.currentHp - amount);

    // Texto flutuante de dano sofrido
    this.scene.events.emit('floating-text', {
      x: this.x,
      y: this.y - 25,
      text: `-${amount}`,
      color: '#ef4444'
    });

    // Flash avermelhado de dano
    this.setTint(0xff5555);
    this.scene.time.delayedCall(150, () => {
      if (this.active && !this.isDead) this.clearTint();
    });

    if (this.playerData.attributes.currentHp <= 0) {
      this.handleDeath();
    }
  }

  private handleDeath(): void {
    this.isDead = true;
    this.setVelocity(0, 0);
    this.setTint(0x555555);

    this.scene.events.emit('floating-text', {
      x: this.x,
      y: this.y - 30,
      text: 'DERROTADO!',
      color: '#ef4444'
    });

    // Retorna ao ponto de renascimento após 2.5s
    this.scene.time.delayedCall(2500, () => {
      this.respawnAtTown();
    });
  }

  private respawnAtTown(): void {
    this.x = this.respawnPoint.x;
    this.y = this.respawnPoint.y;
    this.playerData.attributes.currentHp = this.playerData.attributes.maxHp;
    this.playerData.attributes.currentMp = this.playerData.attributes.maxMp;
    this.isDead = false;
    this.clearTint();

    // 3 segundos de imunidade temporária pós-morte
    this.isInvulnerable = true;
    this.setAlpha(0.6);

    this.scene.time.delayedCall(3000, () => {
      if (this.active) {
        this.isInvulnerable = false;
        this.setAlpha(1.0);
      }
    });
  }

  public gainXp(amount: number): void {
    this.playerData.currentXp += amount;
    const progression = evaluateLevelProgression(this.playerData.level, this.playerData.currentXp);

    if (progression.didLevelUp) {
      this.playerData.level = progression.newLevel;
      // Atualiza atributos automaticamente de acordo com as regras canônicas
      const newAttrs = calculateAttributesForLevel(this.playerData.characterClass, this.playerData.level);
      this.playerData.attributes = { ...newAttrs };

      // Alerta de Level Up
      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 35,
        text: `★ LEVEL UP! NÍVEL ${this.playerData.level} ★`,
        color: '#facc15'
      });
    }

    this.scene.events.emit('player-updated', this.playerData);
  }

  private handleClassSwitchInputs(): void {
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.class1)) {
      this.switchClass(CharacterClass.WARRIOR);
    } else if (Phaser.Input.Keyboard.JustDown(this.actionKeys.class2)) {
      this.switchClass(CharacterClass.RANGER);
    } else if (Phaser.Input.Keyboard.JustDown(this.actionKeys.class3)) {
      this.switchClass(CharacterClass.MAGE);
    } else if (Phaser.Input.Keyboard.JustDown(this.actionKeys.class4)) {
      this.switchClass(CharacterClass.DRUID);
    }
  }

  public switchClass(newClass: CharacterClass): void {
    if (this.playerData.characterClass === newClass) return;

    this.playerData.characterClass = newClass;
    const newAttrs = calculateAttributesForLevel(newClass, this.playerData.level);
    this.playerData.attributes = { ...newAttrs };

    const textureKey = Player.getTextureKeyForClass(newClass);
    this.setTexture(textureKey, 0);

    this.scene.events.emit('floating-text', {
      x: this.x,
      y: this.y - 25,
      text: `CLASSE: ${newClass}`,
      color: '#38bdf8'
    });

    this.scene.events.emit('player-updated', this.playerData);
  }
}
