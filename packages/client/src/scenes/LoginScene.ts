import Phaser from 'phaser';
import { ApiClient } from '../net/ApiClient.js';

export class LoginScene extends Phaser.Scene {
  private formContainer: HTMLElement | null = null;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LoginScene' });
  }

  public create(): void {
    const { width, height } = this.scale;

    // Fundo temático com grid pixel art
    this.add.rectangle(0, 0, width, height, 0x0c0a14).setOrigin(0);

    // Efeito decorativo de vinheta e linhas sutis
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x2e264a, 0.4);
    for (let x = 0; x < width; x += 16) {
      graphics.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 16) {
      graphics.lineBetween(0, y, width, y);
    }

    // Título do Jogo
    this.add.text(width / 2, 28, 'NOOBRPG', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#f59e0b',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(width / 2, 46, 'PERSISTÊNCIA & CONTAS', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#94a3b8',
      letterSpacing: 2
    }).setOrigin(0.5);

    // Texto de status / mensagens
    this.statusText = this.add.text(width / 2, 245, 'Verificando sessão ativa...', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    // Verifica se já existe sessão válida
    this.checkCurrentSession();
  }

  private async checkCurrentSession(): Promise<void> {
    try {
      const data = await ApiClient.getMe();
      if (data && data.account) {
        this.statusText.setText(`Bem-vindo de volta, ${data.account.username}!`);
        this.time.delayedCall(500, () => {
          this.scene.start('CharacterSelectScene', { account: data.account });
        });
        return;
      }
    } catch {
      // Sem sessão ativa, exibe o formulário
    }

    this.statusText.setText('Insira suas credenciais ou crie uma conta.');
    this.createDomForm();
  }

  private createDomForm(): void {
    const viewport = document.getElementById('game-viewport');
    if (!viewport) return;

    // Remove formulário prévio se existir
    this.destroyDomForm();

    const container = document.createElement('div');
    container.id = 'login-form-overlay';
    container.style.position = 'absolute';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -46%)';
    container.style.width = '280px';
    container.style.background = 'rgba(22, 18, 36, 0.95)';
    container.style.border = '2px solid #4338ca';
    container.style.borderRadius = '6px';
    container.style.padding = '12px 16px';
    container.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 16px rgba(99, 102, 241, 0.2)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.zIndex = '100';

    container.innerHTML = `
      <div style="font-family: monospace; font-size: 11px; color: #f1f5f9; text-align: center; font-weight: bold; margin-bottom: 2px;">
        ACESSO À CONTA
      </div>
      <div>
        <label style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; margin-bottom: 2px;">USUÁRIO</label>
        <input id="login-username" type="text" maxlength="20" placeholder="ex: guerreiro_99" style="width: 100%; box-sizing: border-box; background: #0c0a14; border: 1px solid #2e264a; color: #f1f5f9; font-family: monospace; font-size: 10px; padding: 5px 8px; border-radius: 4px; outline: none;" />
      </div>
      <div>
        <label style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; margin-bottom: 2px;">SENHA (MÍN. 8 CHARS)</label>
        <input id="login-password" type="password" maxlength="128" placeholder="••••••••" style="width: 100%; box-sizing: border-box; background: #0c0a14; border: 1px solid #2e264a; color: #f1f5f9; font-family: monospace; font-size: 10px; padding: 5px 8px; border-radius: 4px; outline: none;" />
      </div>
      <div style="display: flex; gap: 8px; margin-top: 4px;">
        <button id="btn-login" style="flex: 1; background: #4f46e5; hover: #4338ca; color: white; border: none; padding: 6px 0; font-family: monospace; font-size: 9px; font-weight: bold; border-radius: 4px; cursor: pointer; transition: background 0.2s;">
          ENTRAR
        </button>
        <button id="btn-register" style="flex: 1; background: #1e1b4b; border: 1px solid #4338ca; color: #c7d2fe; padding: 6px 0; font-family: monospace; font-size: 9px; font-weight: bold; border-radius: 4px; cursor: pointer; transition: background 0.2s;">
          REGISTRAR
        </button>
      </div>
      <div id="login-error-msg" style="font-family: monospace; font-size: 8px; color: #f87171; text-align: center; min-height: 12px; margin-top: 2px;"></div>
    `;

    viewport.appendChild(container);
    this.formContainer = container;

    // Eventos dos botões
    const btnLogin = container.querySelector('#btn-login') as HTMLButtonElement;
    const btnRegister = container.querySelector('#btn-register') as HTMLButtonElement;
    const inputUser = container.querySelector('#login-username') as HTMLInputElement;
    const inputPass = container.querySelector('#login-password') as HTMLInputElement;
    const errorBox = container.querySelector('#login-error-msg') as HTMLElement;

    inputUser.focus();

    const handleAction = async (isRegister: boolean) => {
      const username = inputUser.value.trim();
      const password = inputPass.value;

      errorBox.textContent = '';
      if (!username || !password) {
        errorBox.textContent = 'Preencha usuário e senha.';
        return;
      }

      btnLogin.disabled = true;
      btnRegister.disabled = true;
      this.statusText.setText(isRegister ? 'Criando conta com Argon2id...' : 'Autenticando sessão...');

      try {
        let res;
        if (isRegister) {
          res = await ApiClient.register(username, password);
        } else {
          res = await ApiClient.login(username, password);
        }

        this.statusText.setText(`Sucesso! Conectado como ${res.account.username}.`);
        this.destroyDomForm();
        this.time.delayedCall(400, () => {
          this.scene.start('CharacterSelectScene', { account: res.account });
        });
      } catch (err: any) {
        errorBox.textContent = err.message || 'Falha na autenticação.';
        this.statusText.setText('Erro ao autenticar. Tente novamente.');
        btnLogin.disabled = false;
        btnRegister.disabled = false;
      }
    };

    btnLogin.addEventListener('click', () => handleAction(false));
    btnRegister.addEventListener('click', () => handleAction(true));

    inputPass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAction(false);
    });
  }

  private destroyDomForm(): void {
    if (this.formContainer && this.formContainer.parentElement) {
      this.formContainer.parentElement.removeChild(this.formContainer);
      this.formContainer = null;
    }
  }

  public shutdown(): void {
    this.destroyDomForm();
  }

  public destroy(): void {
    this.destroyDomForm();
  }
}
