import { CharacterClass, PlayerData, InventorySlot } from '@noobrpg/shared';

export interface AuthAccount {
  id: string;
  username: string;
  createdAt: string;
}

export interface CharacterSummary {
  id: string;
  account_id: string;
  name: string;
  character_class: CharacterClass;
  level: number;
  current_xp: number;
  gold: number;
  merit_points: number;
  pos_x: number;
  pos_y: number;
  hp: number;
  mp: number;
  created_at: string;
  updated_at: string;
}

export class ApiClient {
  private static baseUrl = ((import.meta as any).env?.VITE_API_URL as string) || '/api';

  private static tokenKey = 'noobrpg_session_token';

  public static getToken(): string | null {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch {
      return null;
    }
  }

  public static setToken(token: string): void {
    try {
      localStorage.setItem(this.tokenKey, token);
    } catch {
      // ignore
    }
  }

  public static clearToken(): void {
    try {
      localStorage.removeItem(this.tokenKey);
    } catch {
      // ignore
    }
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {})
    };

    const config: RequestInit = {
      ...options,
      credentials: 'include',
      headers
    };

    const res = await fetch(`${this.baseUrl}${endpoint}`, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }

    return data as T;
  }

  public static async getMe(): Promise<{ account: AuthAccount } | null> {
    try {
      return await this.request<{ account: AuthAccount }>('/auth/me');
    } catch {
      return null;
    }
  }

  public static async register(username: string, password: string): Promise<{ account: AuthAccount }> {
    const res = await this.request<{ account: AuthAccount; token?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  public static async login(username: string, password: string): Promise<{ account: AuthAccount }> {
    const res = await this.request<{ account: AuthAccount; token?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  public static async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  public static async listCharacters(): Promise<CharacterSummary[]> {
    const res = await this.request<{ characters: CharacterSummary[] }>('/characters');
    return res.characters;
  }

  public static async createCharacter(name: string, characterClass: CharacterClass): Promise<PlayerData> {
    const res = await this.request<{ player: PlayerData }>('/characters', {
      method: 'POST',
      body: JSON.stringify({ name, characterClass })
    });
    return res.player;
  }

  public static async getCharacter(id: string): Promise<PlayerData> {
    const res = await this.request<{ player: PlayerData }>(`/characters/${id}`);
    return res.player;
  }

  public static async saveCharacter(
    id: string,
    payload: {
      position?: { x: number; y: number };
      hp?: number;
      mp?: number;
      xpGained?: number;
      goldChange?: { amount: number; source: string };
      inventory?: (InventorySlot | null)[];
      equipped?: { weapon: string | null; armor: string | null; accessory: string | null };
    }
  ): Promise<PlayerData> {
    const res = await this.request<{ player: PlayerData }>(`/characters/${id}/save`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.player;
  }

  // --- MÉTODOS DE SIMULAÇÃO AUTORITATIVA (FASE 5A) ---

  public static async joinSimulation(characterId: string): Promise<{ player: PlayerData; worldSnapshot: any }> {
    return this.request<{ player: PlayerData; worldSnapshot: any }>('/simulation/join', {
      method: 'POST',
      body: JSON.stringify({ characterId })
    });
  }

  public static async sendSimulationAction(
    characterId: string,
    action: string,
    payload: any = {}
  ): Promise<{ action: string; result: any; player: PlayerData; combatEvents: any[] }> {
    return this.request<{ action: string; result: any; player: PlayerData; combatEvents: any[] }>('/simulation/action', {
      method: 'POST',
      body: JSON.stringify({ characterId, action, payload })
    });
  }

  public static async getSimulationState(): Promise<any> {
    return this.request<any>('/simulation/state');
  }

  public static async leaveSimulation(characterId: string): Promise<{ player: PlayerData }> {
    return this.request<{ player: PlayerData }>('/simulation/leave', {
      method: 'POST',
      body: JSON.stringify({ characterId })
    });
  }
}

