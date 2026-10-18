import Phaser from 'phaser';
import { CharacterClass, CLASS_BASE_ATTRIBUTES, PlayerData } from '@noobrpg/shared';
import { ApiClient, AuthAccount, CharacterSummary } from '../net/ApiClient.js';

export class CharacterSelectScene extends Phaser.Scene {
  private account!: AuthAccount;
  private characters: CharacterSummary[] = [];
  private selectedIndex: number = 0;
  private domOverlay: HTMLElement | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private charCardsContainer!: Phaser.GameObjects.Container;
  private previewSprite!: Phaser.GameObjects.Sprite;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  public init(data: { account?: AuthAccount }): void {
    if (data.account) {
      this.account = data.account;
    }
  }

  public async create(): Promise<void> {
    const { width, height } = this.scale;

    // Fundo
    this.add.rectangle(0, 0, width, height, 0x0c0a14).setOrigin(0);

    // Grid sutil
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1f1a30, 0.5);
    for (let x = 0; x < width; x += 16) graphics.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += 16) graphics.lineBetween(0, y, width, y);

    // Cabeçalho
    this.add.text(16, 12, 'SELEÇÃO DE PERSONAGENS', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });

    const accountLabel = this.account?.username ? `Conta: ${this.account.username}` : 'Conta Conectada';
    this.add.text(width - 16, 12, accountLabel, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#94a3b8'
    }).setOrigin(1, 0);

    // Botão Logout no canto superior direito
    const btnLogout = this.add.rectangle(width - 45, 34, 60, 16, 0x374151).setInteractive({ useHandCursor: true });
    const textLogout = this.add.text(width - 45, 34, 'LOGOUT', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#f87171',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btnLogout.on('pointerdown', async () => {
      await ApiClient.logout();
      this.destroyDomOverlay();
      this.scene.start('LoginScene');
    });

    // Mensagem de Status
    this.statusText = this.add.text(width / 2, height - 12, 'Carregando personagens do banco...', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    this.charCardsContainer = this.add.container(0, 0);

    // Carrega personagens do servidor
    await this.loadCharacters();
  }

  private async loadCharacters(): Promise<void> {
    try {
      this.characters = await ApiClient.listCharacters();
      this.renderCharacterList();
    } catch (err: any) {
      this.statusText.setText(`Erro ao carregar personagens: ${err.message}`);
    }
  }

  private renderCharacterList(): void {
    const { width, height } = this.scale;
    this.charCardsContainer.removeAll(true);
    this.destroyDomOverlay();

    if (this.characters.length === 0) {
      this.statusText.setText('Você ainda não possui personagens. Crie o seu primeiro herói!');
      this.showCreateCharacterModal();
      return;
    }

    this.statusText.setText('Selecione um personagem para entrar no mundo ou crie outro.');

    // Painel esquerdo: lista de personagens
    const startX = 20;
    const startY = 48;
    const cardWidth = 240;
    const cardHeight = 36;
    const gap = 8;

    this.characters.forEach((char, index) => {
      const y = startY + index * (cardHeight + gap);
      const isSelected = index === this.selectedIndex;

      const bg = this.add.rectangle(
        startX,
        y,
        cardWidth,
        cardHeight,
        isSelected ? 0x312e81 : 0x161224
      )
        .setOrigin(0)
        .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0x818cf8 : 0x2e264a)
        .setInteractive({ useHandCursor: true });

      // Ícone do sprite da classe
      const spriteKey = this.getSpriteKey(char.character_class);
      const icon = this.add.sprite(startX + 20, y + 18, spriteKey, 0);

      // Nome e classe
      const nameText = this.add.text(startX + 40, y + 6, char.name, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f8fafc',
        fontStyle: 'bold'
      });

      const infoText = this.add.text(
        startX + 40,
        y + 20,
        `Nv. ${char.level} • ${this.getClassName(char.character_class)} • 💰 ${char.gold} Gold`,
        {
          fontFamily: 'monospace',
          fontSize: '7.5px',
          color: '#cbd5e1'
        }
      );

      bg.on('pointerdown', () => {
        this.selectedIndex = index;
        this.renderCharacterList();
      });

      this.charCardsContainer.add([bg, icon, nameText, infoText]);
    });

    // Painel direito: detalhes e botão de entrar
    const selectedChar = this.characters[this.selectedIndex] || this.characters[0];
    if (selectedChar) {
      const previewX = 370;
      const previewY = 110;

      // Moldura de preview
      const previewBg = this.add.rectangle(previewX, previewY, 130, 110, 0x161224)
        .setStrokeStyle(1, 0x4338ca);

      const charSpriteKey = this.getSpriteKey(selectedChar.character_class);
      this.previewSprite = this.add.sprite(previewX, previewY - 22, charSpriteKey, 0);
      this.previewSprite.setScale(1.5);
      this.previewSprite.play(`${charSpriteKey}_walk_down`, true);

      const detailName = this.add.text(previewX, previewY + 10, selectedChar.name, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f59e0b',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const detailClass = this.add.text(
        previewX,
        previewY + 24,
        `${this.getClassName(selectedChar.character_class)} — Nv. ${selectedChar.level}`,
        {
          fontFamily: 'monospace',
          fontSize: '7.5px',
          color: '#e2e8f0'
        }
      ).setOrigin(0.5);

      // Botão Entrar no Mundo
      const btnPlay = this.add.rectangle(previewX, previewY + 44, 110, 20, 0x10b981)
        .setInteractive({ useHandCursor: true });
      const txtPlay = this.add.text(previewX, previewY + 44, '▶ ENTRAR NO MUNDO', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      btnPlay.on('pointerdown', () => this.enterWorld(selectedChar.id));

      this.charCardsContainer.add([previewBg, this.previewSprite, detailName, detailClass, btnPlay, txtPlay]);
    }

    // Botão Criar Novo Personagem (se tiver menos de 4)
    if (this.characters.length < 4) {
      const createY = startY + this.characters.length * (cardHeight + gap);
      const btnCreate = this.add.rectangle(startX, createY, cardWidth, 24, 0x1e1b4b)
        .setOrigin(0)
        .setStrokeStyle(1, 0x6366f1)
        .setInteractive({ useHandCursor: true });

      const txtCreate = this.add.text(startX + cardWidth / 2, createY + 12, '+ CRIAR NOVO PERSONAGEM', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#a5b4fc',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      btnCreate.on('pointerdown', () => {
        this.showCreateCharacterModal();
      });

      this.charCardsContainer.add([btnCreate, txtCreate]);
    }
  }

  private async enterWorld(characterId: string): Promise<void> {
    this.statusText.setText('Carregando personagem do banco de dados...');
    try {
      const playerData = await ApiClient.getCharacter(characterId);
      this.statusText.setText(`Entrando no mundo com ${playerData.name}...`);
      this.destroyDomOverlay();
      this.scene.start('WorldScene', { playerData });
    } catch (err: any) {
      this.statusText.setText(`Erro ao carregar personagem: ${err.message}`);
    }
  }

  private showCreateCharacterModal(): void {
    const viewport = document.getElementById('game-viewport');
    if (!viewport) return;

    this.destroyDomOverlay();

    const container = document.createElement('div');
    container.id = 'create-char-overlay';
    container.style.position = 'absolute';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.width = '320px';
    container.style.background = 'rgba(22, 18, 36, 0.98)';
    container.style.border = '2px solid #6366f1';
    container.style.borderRadius = '6px';
    container.style.padding = '12px 14px';
    container.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.85)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.zIndex = '100';

    container.innerHTML = `
      <div style="font-family: monospace; font-size: 11px; color: #f59e0b; text-align: center; font-weight: bold;">
        CRIAR NOVO HERÓI
      </div>
      <div>
        <label style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; margin-bottom: 2px;">NOME DO PERSONAGEM (3 A 16 LETRAS)</label>
        <input id="new-char-name" type="text" maxlength="16" placeholder="ex: Arthur" style="width: 100%; box-sizing: border-box; background: #0c0a14; border: 1px solid #2e264a; color: #f1f5f9; font-family: monospace; font-size: 10px; padding: 4px 8px; border-radius: 4px; outline: none;" />
      </div>
      <div>
        <label style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; margin-bottom: 2px;">ESCOLHA A CLASSE</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <label style="display: flex; align-items: center; gap: 4px; font-family: monospace; font-size: 8px; color: #f1f5f9; background: #1e1b4b; padding: 4px 6px; border-radius: 4px; cursor: pointer;">
            <input type="radio" name="charClass" value="WARRIOR" checked />
            ⚔️ Guerreiro
          </label>
          <label style="display: flex; align-items: center; gap: 4px; font-family: monospace; font-size: 8px; color: #f1f5f9; background: #1e1b4b; padding: 4px 6px; border-radius: 4px; cursor: pointer;">
            <input type="radio" name="charClass" value="RANGER" />
            🏹 Arqueiro
          </label>
          <label style="display: flex; align-items: center; gap: 4px; font-family: monospace; font-size: 8px; color: #f1f5f9; background: #1e1b4b; padding: 4px 6px; border-radius: 4px; cursor: pointer;">
            <input type="radio" name="charClass" value="MAGE" />
            🔮 Mago
          </label>
          <label style="display: flex; align-items: center; gap: 4px; font-family: monospace; font-size: 8px; color: #f1f5f9; background: #1e1b4b; padding: 4px 6px; border-radius: 4px; cursor: pointer;">
            <input type="radio" name="charClass" value="DRUID" />
            🌿 Druida
          </label>
        </div>
      </div>
      <div id="create-char-error" style="font-family: monospace; font-size: 8px; color: #f87171; text-align: center; min-height: 10px;"></div>
      <div style="display: flex; gap: 8px;">
        <button id="btn-confirm-create" style="flex: 1; background: #10b981; color: white; border: none; padding: 6px 0; font-family: monospace; font-size: 9px; font-weight: bold; border-radius: 4px; cursor: pointer;">
          CRIAR
        </button>
        ${this.characters.length > 0 ? `
          <button id="btn-cancel-create" style="flex: 1; background: #374151; color: #e5e7eb; border: none; padding: 6px 0; font-family: monospace; font-size: 9px; font-weight: bold; border-radius: 4px; cursor: pointer;">
            CANCELAR
          </button>
        ` : ''}
      </div>
    `;

    viewport.appendChild(container);
    this.domOverlay = container;

    const inputName = container.querySelector('#new-char-name') as HTMLInputElement;
    const btnConfirm = container.querySelector('#btn-confirm-create') as HTMLButtonElement;
    const btnCancel = container.querySelector('#btn-cancel-create') as HTMLButtonElement | null;
    const errorBox = container.querySelector('#create-char-error') as HTMLElement;

    inputName.focus();

    btnConfirm.addEventListener('click', async () => {
      const name = inputName.value.trim();
      const selectedRadio = container.querySelector('input[name="charClass"]:checked') as HTMLInputElement;
      const charClass = selectedRadio ? (selectedRadio.value as CharacterClass) : CharacterClass.WARRIOR;

      errorBox.textContent = '';
      if (!name) {
        errorBox.textContent = 'Informe o nome do personagem.';
        return;
      }

      btnConfirm.disabled = true;
      try {
        const createdPlayer = await ApiClient.createCharacter(name, charClass);
        this.destroyDomOverlay();
        // Recarrega lista e entra com o novo personagem
        await this.loadCharacters();
        this.enterWorld(createdPlayer.id);
      } catch (err: any) {
        errorBox.textContent = err.message || 'Falha ao criar personagem.';
        btnConfirm.disabled = false;
      }
    });

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.destroyDomOverlay();
        this.renderCharacterList();
      });
    }
  }

  private getSpriteKey(c: CharacterClass): string {
    switch (c) {
      case CharacterClass.WARRIOR:
        return 'hero_warrior';
      case CharacterClass.RANGER:
        return 'hero_ranger';
      case CharacterClass.MAGE:
        return 'hero_mage';
      case CharacterClass.DRUID:
        return 'hero_druid';
      default:
        return 'hero_warrior';
    }
  }

  private getClassName(c: CharacterClass): string {
    switch (c) {
      case CharacterClass.WARRIOR:
        return 'Guerreiro';
      case CharacterClass.RANGER:
        return 'Arqueiro';
      case CharacterClass.MAGE:
        return 'Mago';
      case CharacterClass.DRUID:
        return 'Druida';
      default:
        return c;
    }
  }

  private destroyDomOverlay(): void {
    if (this.domOverlay && this.domOverlay.parentElement) {
      this.domOverlay.parentElement.removeChild(this.domOverlay);
      this.domOverlay = null;
    }
  }

  public shutdown(): void {
    this.destroyDomOverlay();
  }

  public destroy(): void {
    this.destroyDomOverlay();
  }
}
