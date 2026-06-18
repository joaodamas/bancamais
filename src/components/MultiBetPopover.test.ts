import { describe, it, expect } from "vitest";
import { parseLegs } from "./MultiBetPopover";

describe("parseLegs", () => {
  it("retorna 1 perna para seleção simples", () => {
    expect(parseLegs("Real vence")).toEqual([{ text: "Real vence" }]);
  });

  it("quebra por barra e extrai odd entre parênteses", () => {
    const legs = parseLegs("Palmeiras (1.98) / Mirassol (1.47) / Flamengo (1.95)");
    expect(legs).toHaveLength(3);
    expect(legs[0]).toEqual({ text: "Palmeiras", odd: "1.98" });
    expect(legs[2]).toEqual({ text: "Flamengo", odd: "1.95" });
  });

  it("quebra por ponto-e-vírgula e pipe", () => {
    const legs = parseLegs("PSG Resultado Final; Mais de 7.5 Escanteios | Lyon Resultado Final");
    expect(legs).toHaveLength(3);
    expect(legs[1].text).toBe("Mais de 7.5 Escanteios");
  });

  it("cai para vírgula quando há vários itens e nenhum separador forte", () => {
    const legs = parseLegs("Palmeiras, Mirassol, Flamengo, Barcelona");
    expect(legs).toHaveLength(4);
  });

  it("não quebra por vírgula quando há poucas", () => {
    expect(parseLegs("Real Madrid, casa vence")).toHaveLength(1);
  });

  it("não confunde parênteses não-numéricos com odd", () => {
    const legs = parseLegs("Lyon + Endrick (gol ou assistência) / Palmeiras (1.50)");
    expect(legs[0]).toEqual({ text: "Lyon + Endrick (gol ou assistência)" });
    expect(legs[1]).toEqual({ text: "Palmeiras", odd: "1.50" });
  });

  it("retorna vazio para string vazia", () => {
    expect(parseLegs("   ")).toEqual([]);
  });
});
