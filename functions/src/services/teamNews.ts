import type { NewsArticle } from "../contracts/externalData.js";
import { getCachedValue, setCachedValue } from "./externalCache.js";
import { fetchJson } from "./httpClient.js";

const GNEWS_BASE_URL = "https://gnews.io/api/v4";
const NEWS_TTL_MS = 15 * 60 * 1000;

interface GNewsArticleEnvelope {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  image?: string | null;
  source?: {
    name?: string;
  };
}

interface GNewsResponse {
  articles?: GNewsArticleEnvelope[];
}

function normalizeArticle(article: GNewsArticleEnvelope): NewsArticle | null {
  if (typeof article.title !== "string" || typeof article.url !== "string") {
    return null;
  }

  return {
    title: article.title,
    description: typeof article.description === "string" ? article.description : "",
    url: article.url,
    source: typeof article.source?.name === "string" ? article.source.name : "",
    publishedAt: typeof article.publishedAt === "string" ? article.publishedAt : "",
    image: typeof article.image === "string" ? article.image : null,
  };
}

export async function fetchTeamNews(apiKey: string, teamName: string, maxResults: number) {
  const normalizedTeamName = teamName.trim().toLowerCase();
  const cacheKey = `news:${normalizedTeamName}:${maxResults}`;
  const cached = getCachedValue<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchJson<GNewsResponse>(`${GNEWS_BASE_URL}/search`, {
    searchParams: {
      q: teamName,
      lang: "pt",
      country: "br",
      topic: "sports",
      max: String(maxResults),
      token: apiKey,
    },
    timeoutMs: 8000,
  });

  const articles = (response.articles ?? [])
    .map(normalizeArticle)
    .filter((article): article is NewsArticle => article != null);

  setCachedValue(cacheKey, articles, NEWS_TTL_MS);
  return articles;
}
