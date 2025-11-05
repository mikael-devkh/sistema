import type { JiraIssue } from '../types/rat';

interface CacheEntry {
  issue: JiraIssue;
  timestamp: number;
  expiresAt: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const CACHE_KEY_PREFIX = 'fsa_cache_';
const MAX_CACHE_SIZE = 100; // Máximo de entradas no cache

function getCacheKey(fsaNumber: string): string {
  const sanitized = fsaNumber.replace(/\D/g, '');
  return `${CACHE_KEY_PREFIX}${sanitized}`;
}

export function getCachedFsa(fsaNumber: string): JiraIssue | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const key = getCacheKey(fsaNumber);
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const entry: CacheEntry = JSON.parse(cached);
    const now = Date.now();
    
    if (now > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    
    return entry.issue;
  } catch {
    return null;
  }
}

export function setCachedFsa(fsaNumber: string, issue: JiraIssue): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = getCacheKey(fsaNumber);
    const now = Date.now();
    const entry: CacheEntry = {
      issue,
      timestamp: now,
      expiresAt: now + CACHE_TTL
    };
    
    localStorage.setItem(key, JSON.stringify(entry));
    
    // Limpar cache antigo (manter apenas os mais recentes)
    cleanupOldCache();
  } catch (error) {
    console.warn('Erro ao salvar cache:', error);
  }
}

function cleanupOldCache(): void {
  const entries: Array<{ key: string; timestamp: number }> = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_KEY_PREFIX)) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          entries.push({ key, timestamp: entry.timestamp });
        }
      } catch {}
    }
  }
  
  // Ordenar por timestamp e remover os mais antigos
  entries.sort((a, b) => b.timestamp - a.timestamp);
  if (entries.length > MAX_CACHE_SIZE) {
    entries.slice(MAX_CACHE_SIZE).forEach(({ key }) => {
      localStorage.removeItem(key);
    });
  }
}

export function clearFsaCache(): void {
  if (typeof window === 'undefined') return;
  
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
