import { useState, useCallback } from "react";
import { analyzePortfolio, type AIAnalysis } from "./aiService";
import type { AppState } from "./types";

export function useAIAnalysis(state: AppState) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzePortfolio(state);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na análise de IA");
    } finally {
      setLoading(false);
    }
  }, [state]);

  return { analysis, loading, error, refresh };
}
