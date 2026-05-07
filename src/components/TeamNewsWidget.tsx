import { useEffect, useState } from "react";
import { fetchTeamNews, isNewsApiConfigured, type NewsArticle } from "../lib/newsApi";

interface TeamNewsWidgetProps {
  teamName: string;
  compact?: boolean;
}

export function TeamNewsWidget({ teamName, compact = false }: TeamNewsWidgetProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isNewsApiConfigured() || !teamName) return;
    setLoading(true);
    fetchTeamNews(teamName, compact ? 2 : 3).then(results => {
      setArticles(results);
      setLoading(false);
    });
  }, [teamName, compact]);

  if (!isNewsApiConfigured()) return null;
  if (loading) return (
    <div className="news-loading">
      <div className="skeleton-line" style={{ height: 14, width: "60%" }} />
      <div className="skeleton-line" style={{ height: 14, marginTop: 6 }} />
    </div>
  );
  if (articles.length === 0) return null;

  return (
    <div className="team-news">
      {articles.map((article, i) => (
        <a
          key={i}
          href={article.url}
          target="_blank"
          rel="noreferrer noopener"
          className="news-article"
        >
          <div className="news-article-content">
            <span className="news-source">{article.source}</span>
            <strong className="news-title">{article.title}</strong>
            {!compact && article.description && (
              <p className="news-description">{article.description}</p>
            )}
            <span className="news-time">
              {new Date(article.publishedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {article.image && !compact && (
            <img
              src={article.image}
              alt=""
              className="news-thumb"
              loading="lazy"
            />
          )}
        </a>
      ))}
    </div>
  );
}
