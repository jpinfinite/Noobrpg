/**
 * Módulo de Configuração e Resolução Centralizada de Endereços de Rede do NoobRPG.
 * 
 * Elimina URLs temporárias ou fallbacks efêmeros em produção, garantindo
 * que o cliente use WSS em ambientes seguros e falhe graciosamente quando
 * não houver endpoint de WebSocket configurado.
 */

export interface NetworkConfig {
  wsUrl: string | null;
  apiUrl: string;
  isConfigured: boolean;
  isLocalDevelopment: boolean;
  warning?: string;
}

/**
 * Determina se o hostname fornecido representa ambiente de desenvolvimento local.
 */
export function isLocalEnvironment(hostname?: string): boolean {
  if (!hostname && typeof window === 'undefined') return true;
  const host = (hostname || (typeof window !== 'undefined' ? window.location.hostname : 'localhost')).toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
}

/**
 * Normaliza e valida a URL do WebSocket, garantindo uso de WSS em ambiente HTTPS.
 */
export function normalizeWsUrl(url: string, currentProtocol?: string): string {
  if (url === null || url === undefined || typeof url !== 'string') {
    throw new Error('URL de WebSocket inválida ou não informada.');
  }

  let trimmed = url.trim();
  if (trimmed.length === 0) {
    throw new Error('URL de WebSocket vazia.');
  }

  const isHttps = (currentProtocol || (typeof window !== 'undefined' ? window.location.protocol : 'http:')) === 'https:';

  if (isHttps) {
    if (trimmed.startsWith('ws://')) {
      // Converte compulsoriamente ws:// para wss:// para prevenir bloqueio por Mixed Content
      trimmed = 'wss://' + trimmed.slice(5);
    } else if (!trimmed.startsWith('wss://')) {
      trimmed = 'wss://' + trimmed.replace(/^https?:\/\//i, '');
    }
  } else {
    if (!trimmed.startsWith('ws://') && !trimmed.startsWith('wss://')) {
      trimmed = 'ws://' + trimmed.replace(/^https?:\/\//i, '');
    }
  }

  return trimmed;
}

export interface NetworkLocation {
  hostname: string;
  protocol: string;
  search?: string;
}

/**
 * Extrai parâmetros de query string de forma segura no navegador ou ambiente de teste.
 */
function getQueryParam(param: string, searchStr?: string): string | null {
  const search = searchStr !== undefined 
    ? searchStr 
    : (typeof window !== 'undefined' ? window.location.search : '');
  if (!search || !search.includes(param + '=')) return null;
  try {
    const params = new URLSearchParams(search);
    const val = params.get(param);
    return val ? val.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a URL do WebSocket para o ambiente atual.
 * 
 * Ordem de precedência:
 * 1. URL explícita informada no parâmetro/construtor
 * 2. Query parameter de URL (?ws=... ou ?server=...) para testes temporários a custo zero sem rebuild
 * 3. Variável de ambiente pública VITE_WS_URL (injetada no build)
 * 4. Fallback de desenvolvimento local (ws://localhost:4000/ws)
 * 5. Se em produção (ex: *.pages.dev, domínio remoto) e nenhum endpoint foi definido,
 *    retorna null para evitar conexões silenciosas contra endpoints inválidos/fantasmas.
 */
export function resolveWsUrl(
  explicitUrl?: string,
  envWsUrl?: string,
  location?: NetworkLocation
): string | null {
  if (explicitUrl && explicitUrl.trim()) {
    return normalizeWsUrl(explicitUrl, location?.protocol);
  }

  // Permite override dinâmico para testes externos gratuitos (?ws=wss://... ou ?server=meu-tunel.exemplo.com)
  const queryWs = getQueryParam('ws', location?.search);
  if (queryWs) {
    return normalizeWsUrl(queryWs, location?.protocol);
  }

  const queryServer = getQueryParam('server', location?.search);
  if (queryServer) {
    const cleanServer = queryServer.replace(/^https?:\/\//i, '').replace(/^wss?:\/\//i, '').replace(/\/+$/, '');
    const wsTarget = cleanServer.endsWith('/ws') ? cleanServer : `${cleanServer}/ws`;
    return normalizeWsUrl(wsTarget, location?.protocol);
  }

  const envUrl = envWsUrl !== undefined 
    ? envWsUrl 
    : (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WS_URL as string);

  if (envUrl && envUrl.trim()) {
    return normalizeWsUrl(envUrl, location?.protocol);
  }

  const loc = location || (typeof window !== 'undefined' 
    ? { hostname: window.location.hostname, protocol: window.location.protocol, search: window.location.search } 
    : { hostname: 'localhost', protocol: 'http:' });

  if (isLocalEnvironment(loc.hostname)) {
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = loc.hostname || 'localhost';
    return `${protocol}//${host}:4000/ws`;
  }

  // Em produção sem endpoint definido, não utiliza URLs temporárias hardcoded!
  return null;
}

/**
 * Resolve a URL base da API REST.
 * 
 * Ordem de precedência:
 * 1. Query parameter de URL (?api=... ou ?server=...)
 * 2. Variável de ambiente VITE_API_URL
 * 3. Fallback local / relativo: '/api'
 */
export function resolveApiUrl(
  envApiUrl?: string,
  location?: NetworkLocation
): string {
  const queryApi = getQueryParam('api', location?.search);
  if (queryApi) {
    let clean = queryApi.trim().replace(/\/+$/, '');
    const isHttps = (location?.protocol || (typeof window !== 'undefined' ? window.location.protocol : 'http:')) === 'https:';
    if (isHttps && clean.startsWith('http://')) {
      clean = 'https://' + clean.slice(7);
    }
    return clean;
  }

  const queryServer = getQueryParam('server', location?.search);
  if (queryServer) {
    let clean = queryServer.trim().replace(/^wss?:\/\//i, '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const apiTarget = clean.endsWith('/api') ? clean : `${clean}/api`;
    const isHttps = (location?.protocol || (typeof window !== 'undefined' ? window.location.protocol : 'http:')) === 'https:';
    return `${isHttps ? 'https' : 'http'}://${apiTarget}`;
  }

  const envUrl = envApiUrl !== undefined
    ? envApiUrl
    : (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL as string);

  if (envUrl && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, '');
    const isHttps = (location?.protocol || (typeof window !== 'undefined' ? window.location.protocol : 'http:')) === 'https:';
    if (isHttps && clean.startsWith('http://')) {
      clean = 'https://' + clean.slice(7);
    }
    return clean;
  }

  return '/api';
}

/**
 * Retorna o diagnóstico completo de configuração de rede para telemetria ou exibição no console/UI.
 */
export function getNetworkConfig(
  explicitWsUrl?: string,
  envWsUrl?: string,
  envApiUrl?: string,
  location?: NetworkLocation
): NetworkConfig {
  const loc = location || (typeof window !== 'undefined' 
    ? { hostname: window.location.hostname, protocol: window.location.protocol, search: window.location.search } 
    : { hostname: 'localhost', protocol: 'http:' });

  const isLocal = isLocalEnvironment(loc.hostname);
  const wsUrl = resolveWsUrl(explicitWsUrl, envWsUrl, loc);
  const apiUrl = resolveApiUrl(envApiUrl, loc);

  let warning: string | undefined;
  if (!wsUrl && !isLocal) {
    warning = 'Servidor multiplayer não configurado para este ambiente de produção (VITE_WS_URL ausente).';
  }

  return {
    wsUrl,
    apiUrl,
    isConfigured: wsUrl !== null,
    isLocalDevelopment: isLocal,
    warning
  };
}
