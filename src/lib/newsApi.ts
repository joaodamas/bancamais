import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`news_cache_${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`news_cache_${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  try {
    localStorage.setItem(`news_cache_${key}`, JSON.stringify({
      data,
      expiresAt: Date.now() + ttlMs
    }));
  } catch { /* localStorage cheio */ }
}

const NEWS_TTL = 6 * 60 * 60 * 1000; // 6 horas — notícias não mudam tão rápido

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  image: string | null;
}

const functions = getFunctions(firebaseApp, "southamerica-east1");
const fetchTeamNewsCallable = httpsCallable<
  { teamName: string; maxResults?: number },
  NewsArticle[]
>(functions, "fetchTeamNewsCallable");

export async function fetchTeamNews(teamName: string, maxResults = 3): Promise<NewsArticle[]> {
  if (teamName.trim().length < 2) return [];

  const cacheKey = `team_${teamName.toLowerCase().trim()}`;
  const cached = cacheGet<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchTeamNewsCallable({
      teamName: teamName.trim(),
      maxResults,
    });
    const articles = Array.isArray(response.data) ? response.data : [];
    cacheSet(cacheKey, articles, NEWS_TTL);
    return articles;
  } catch {
    return [];
  }
}

export function isNewsApiConfigured(): boolean {
  // Only show the news widget when the project ID is set, implying Firebase Functions are deployed.
  return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

/** Extrai os nomes de times únicos de uma lista de apostas pendentes */
export function extractTeamsFromBets(bets: Array<{ eventName: string; status: string }>): string[] {
  const pending = bets.filter(b => b.status === "pending");
  const teams = new Set<string>();

  for (const bet of pending) {
    // Formato típico: "Flamengo x Palmeiras" ou "Flamengo vs Palmeiras"
    const parts = bet.eventName.split(/\s+[xX×vs]\s+/);
    for (const part of parts) {
      const team = part.trim();
      if (team.length > 2) teams.add(team);
    }
  }

  return Array.from(teams).slice(0, 3); // máximo 3 times = 3 chamadas de API
}
