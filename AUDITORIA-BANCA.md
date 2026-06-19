# Auditoria — Banca+ (terminal de gestão de banca esportiva)

> Auditoria de código + telas. Data: 2026-06-19. Escopo: `src/lib/metrics.ts`, `ledger.ts`, `chartData.ts`, `executiveReport.ts`, `riskGuard.ts`, `unit.ts`, `Reports.tsx` + 7 prints (Performance, Inteligência, Insights, Relatórios, Bancas & Casas, Configurações, Diário).

## 1. Veredito direto

A Banca+ está **acima da média do mercado amador**: tem CLV, drawdown, segmentações ricas, hard stop com bloqueio **de verdade** no fluxo de aposta, e um relatório executivo declaradamente determinístico. A engenharia é séria e tem testes.

**Mas o número-produto não fecha.** A métrica de rentabilidade está **errada e inconsistente entre telas**: a mesma palavra "yield" mostra **−60%** na Performance e **−100%** no Relatório executivo — para os mesmos dados. O erro é concreto: o "yield" da Performance divide o lucro pelo stake de **apostas pendentes incluídas**, o que não faz sentido (aposta sem resultado não entra em rentabilidade). E os rótulos "ROI" e "yield" estão trocados entre módulos. Numa ferramenta de banca, isso é 🔴: o dono olha dois lugares, vê dois números e não sabe em qual acreditar.

Soma-se a isso: a proteção de jogo responsável **se desliga sozinha quando a banca derivada é 0** (estado atual do usuário) e o cálculo de limite de stake **ignora a unidade fixa** que o usuário configurou. Dá pra confiar na estrutura; **ainda não dá pra confiar nos números de rentabilidade nem na proteção no estado atual.**

## 2. O que eu entendi da ferramenta

- **Objetivo:** terminal analítico de gestão de banca para apostador esportivo profissional/sério — controle, disciplina e edge de longo prazo (não cassino). Confere com o CLAUDE.md e com as telas.
- **Público / fase:** apostador individual avançado; produto em produção (Firebase, deploy real).
- **Modelo de domínio (`types.ts`):** `Bet` com status `pending | won | lost | cashout | void`, `stake`, `odds`, `payout`, `closingOdds`, `estimatedProbability/Edge`, mercado/liga/esporte/casa/estratégia. Ledger imutável de `Transaction` por casa. Banca: `startingBalance` (referência) + saldo derivado do ledger por casa.
- **Gestão de banca:** unidade configurável em **valor fixo (R$)** ou **% da banca** (`RiskSettings.unitMode`), `maxStakeUnits`, exposição máxima, limite de perdas seguidas, hard stop com limites diário/semanal/mensal.
- **O que calcula:** ROI, yield, hit rate, odd média, fator de lucro, lucro, exposição, CLV, drawdown, segmentações (faixa de odd, stake, dia, mercado, liga), relatório executivo mensal, hard stop.
- **Premissas que assumi (a partir dos prints):** banca derivada do ledger = **R$ 0** (Betano cadastrado com saldo 0, sem depósito); `startingBalance` de referência = **R$ 20**; unidade = **fixa R$ 15**; 2 apostas liquidadas (ambas red: R$ 2 "Resultado Correto" e R$ 10 múltipla), 2 pendentes (exposição R$ 8).

## 3. Conferência da matemática

Amostra real reconstruída dos prints: 2 liquidadas red (stake R$2 + R$10, lucro −R$12), 2 pendentes (stake total R$8). Turnover liquidado = R$12; turnover total = R$20.

| Métrica | Ferramenta mostra | Fórmula no código | Recálculo | Veredito |
|---|---|---|---|---|
| "ROI" (Performance) | **−100,0%** | `profit / stakedSettled` = −12/12 (`metrics.ts:44`) | −100,0% | ✅ valor certo — mas é o *yield* clássico (lucro/turnover) rotulado "ROI" |
| "Yield" (Performance + card op. Relatórios) | **−60,0%** | `profit / stakedAll` = −12/**20** (inclui pendentes!) (`metrics.ts:35,45`) | deveria ser −100,0% | 🔴 **ERRADO**: pendentes (R$8) no denominador |
| "yield" (Relatório executivo, texto) | **−100,0%** | `profit / staked` do mês liquidado (`executiveReport.ts:96`) | −100,0% | ✅ certo — mas chamado "yield" |
| Fator de lucro | **0.00** | `grossWin/grossLoss` = 0/12 (`metrics.ts:158`) | 0.00 | ✅ |
| Hit rate | **0,0%** | `(won+cashout)/settled` = 0/2 | 0,0% | ✅ |
| Odd média | **235.21** | média **simples** de TODAS as odds, incl. pendentes (`metrics.ts:47`) | aritmeticamente "correto", conceitualmente lixo | 🟠 sem sentido decisório |

**A divergência mais grave, em uma frase:** *“yield” = −60% na Performance e −100% no Relatório, porque um inclui o stake de apostas pendentes no denominador e o outro não.* O denominador honesto de rentabilidade é **só o turnover liquidado**.

## 4. O que NÃO presta (em ordem de impacto)

1. 🔴 **`metrics.yield` infla o denominador com apostas pendentes.** `stakedAll = state.bets.reduce(... stake)` (`metrics.ts:35`) soma TODAS as apostas (pending + void + settled); `yield = profit/stakedAll` (`:45`). Pendente não tem resultado — não pode entrar em rentabilidade. **Impacto:** o número principal da ferramenta fica falso (parece "menos ruim") e contradiz o relatório executivo.
2. 🔴 **Nomenclatura ROI × Yield trocada e ambígua.** `metrics.roi` (`:44`) e `executiveReport.yield` (`:96`) são **a mesma fórmula** (lucro/turnover liquidado) com **nomes diferentes**; e existe um terceiro número (−60%) chamado "yield". Não há um ROI-sobre-banca em lugar nenhum. **Impacto:** o usuário vê três rótulos para duas contas e não sabe o que é o quê.
3. 🔴 **Limite de stake ignora a unidade fixa.** `resolveUnitValue` (`unit.ts`) trata `fixed`/`percent` certo e é usado nas telas (Dashboard, Risk, Onboarding), mas os **guards** que alertam/bloqueiam — `metrics.ts:106`, `riskGuard.ts:107` e `:193` — fazem `balance * unitPercent/100`, ignorando `unitMode`/`unitFixed`. **Impacto:** com unidade fixa R$15, a regra que roda não é a que o usuário configurou nem a que a tela mostra.
4. 🟠 **Proteção de risco se desliga com banca = 0.** `checkHardStop` (`:47`), `riskAlertsExtended` (`:104`) e `getHardStopProgress` (`:243`) retornam vazio se `calculateLedgerTotalBalance ≤ 0`. Como o `startingBalance` é ignorado quando há ≥1 casa, quem cadastrou casa com saldo 0 (estado atual) fica **sem hard stop e sem alertas, sem aviso.** Jogo responsável que se auto-desliga é perigoso.
5. 🟠 **Duas "bancas" que não conversam.** `startingBalance` (R$20 de referência) vs banca derivada do ledger (R$0). Com casas cadastradas, o `startingBalance` vira número morto (`ledger.ts:77`). O usuário define R$20 e a tela mostra R$0 sem explicação. Fonte da verdade ambígua.
6. 🟠 **Odd média sem sentido (235.21).** Média simples (`metrics.ts:47`) misturando múltipla de 6 seleções (odd combinada ~centenas) com simples, e incluindo pendentes. Deveria ser **ponderada por stake** e separar simples de múltiplas. Hoje é vaidade rotulada "execução média".
7. 🟡 **Drawdown % = 0% para quem só perde.** `Reports.tsx:51` inicia `peak = 0`; se a curva nunca fica positiva, `maxDrawdownPct = dd/peak` com `peak=0` → **0%**. O valor em R$ aparece, mas o % esconde a gravidade justo no pior caso.
8. 🟡 **Cashout conta sempre como acerto.** `won || cashout` no hit rate (`metrics.ts:37`), mesmo quando o `betProfit` do cashout é negativo. Distorce a taxa de acerto.
9. 🟡 **`placedAt` vs `eventAt` inconsistente.** Mês/ROI mensal e relatório usam `eventAt` (`chartData.ts:95`, `executiveReport.ts:85`); dia-da-semana e streaks usam `placedAt`. Buckets temporais divergem entre métricas.
10. 🟡 **Dinheiro em `float`.** Somatórias de `stake`/`profit` em ponto flutuante (só o ledger arredonda com `toFixed(2)`). Em escala, centavo diverge entre soma das partes e total.

## 5. Auditoria por dimensão

- **Propósito vs execução:** cumpre o propósito de *terminal analítico* — não é diário com gráfico. Mas a credibilidade depende do número fechar, e hoje não fecha. Risco de **scope creep** leve (OCR de bilhete, sugestões de IA, página tipster) competindo com o básico ainda torto.
- **Modelo de gestão de banca:** bom — unidade fixa/%, unidades, exposição. Trata void = 0 (✅), void fora do turnover do ROI (✅). **Não vi** tratamento explícito de meio-green/meio-red nem de bônus/freebet separados do ROI real (não vi no `types.ts`/`betProfit`).
- **Matemática & integridade:** ver §3/§4. ROI liquidado certo; "yield" com pendentes errado; odd média sem ponderação; rótulos confusos.
- **Sinal vs ruído:** exibe `n` ("2 liquidadas") e segmenta bem, mas **celebra ROI/odd média sem aviso de amostra mínima**. ROI −100% em 2 apostas é ruído exibido como fato. Falta um selo "amostra insuficiente" abaixo de ~30–50 apostas por corte.
- **Fonte da verdade & dados:** ledger imutável por casa é ótimo (✅). Mas convivem `startingBalance` e saldo derivado sem hierarquia clara, e "yield" tem duas definições. Pendente vs liquidada estão separadas no código (✅), mas a pendente vaza pro denominador do yield.
- **Fluxos & jornada:** criar aposta passa por `checkBetRisk`/`checkHardStop` (✅ enforcement). Há OCR e templates (reduz fricção). Não auditei a fundo o nº de toques.
- **Telas / UX:** os 7 prints expõem ruído visual (cards com reflexo retangular, espaços vazios) — já corrigido nesta sessão (masonry + remoção do `backdrop-filter`/`::after`). A pergunta "estou no lucro, quanto e em quantas apostas?" é respondível, mas o número de rentabilidade exibido é o errado.
- **Outputs / acionabilidade:** segmentações (odd/stake/dia/mercado/liga) são acionáveis (✅). Odd média 235.21 é vaidade. Faltam selos de amostra.
- **Jogo responsável:** hard stop **com bloqueio real** (`App.tsx:646`) — forte (✅). Mas desliga com banca 0 (🟠) e o toggle estava off no print. Não vi link de canal de ajuda / aviso regulatório (Lei 14.790/2023 BR).
- **Técnico/código:** TS strict, testes presentes, determinismo declarado no relatório (✅, alinhado à diretriz "LLM nunca calcula número"). Pontos: float p/ dinheiro, helper de unidade não reaproveitado nos guards, drawdown só no componente (não testável).
- **Riscos & escala:** recomputo de saldo varre todas as transações a cada chamada (`deriveBookmakerBalances`) — O(n·casas); com milhares de lançamentos vira gargalo de render.

## 6. Recomendações priorizadas

- **P0 (agora):**
  - **Unificar a definição de rentabilidade num único helper.** Um `computeYield(state) = lucroLiquidado / turnoverLiquidado`, usado por Performance, Relatório executivo e cards operacionais. Matar `metrics.yield` baseado em `stakedAll`. Decidir **um** par de rótulos honestos (sugestão: **Yield** = lucro/turnover; **ROI** = lucro/banca, se quiser exibir os dois — mas nunca dois números diferentes com o mesmo nome).
  - **Trocar `balance*unitPercent` por `resolveUnitValue(rs, balance)`** em `metrics.ts:106`, `riskGuard.ts:107` e `:193`. Já existe e está testado — é só ligar.
- **P1 (em seguida):**
  - **Resolver a banca-base.** Quando não houver depósito no ledger, usar `startingBalance` como capital monitorado (ou exibir explicitamente "banca de referência R$X · ledger R$0") e **não desligar o hard stop por banca 0** — usar a banca de referência como base dos limites.
  - **Odd média ponderada por stake** e separando simples × múltiplas; renomear para algo honesto.
  - **Selo de amostra:** abaixo de N apostas por corte, marcar o ROI como "amostra insuficiente (n=2)".
- **P2 (futuro):**
  - Corrigir `maxDrawdownPct` (usar base = banca inicial/ref quando `peak=0`); mover drawdown para `lib/` com teste.
  - Tratar cashout negativo no hit rate; padronizar `placedAt` vs `eventAt`; migrar dinheiro para inteiro de centavos.

## 7. Quick wins (esta semana)

- Ligar `resolveUnitValue` nos 3 guards (3 linhas) — corrige o limite de stake.
- Apontar Performance e card "Yield" para o mesmo helper do relatório executivo — mata a divergência −60%/−100%.
- Odd média: ponderar por stake (1 função) — derruba o 235.21 para um número real.
- Selo "n=2 · amostra insuficiente" ao lado de ROI/yield quando `settledCount < 30`.

## 8. O que colocar e o que tirar

**Colocar:** definição única de yield/ROI; selo de amostra; aviso de jogo responsável + canal de ajuda (exigência regulatória BR); separar bônus/freebet do ROI real; tratamento de meio-green/meio-red.
**Tirar (ou esconder):** "odd média" como está (235.21 não decide nada); qualquer número celebrado sem `n`; o `startingBalance` como campo concorrente caso a banca passe a vir só do ledger.

## 9. O que ficou sem avaliar

- Como `payout` é gravado ao marcar "won" (assumi `stake×odds`; não li o handler de liquidação).
- Tratamento de **múltipla com perna anulada** (odd da perna → 1.00) — não localizei no `betProfit`.
- Bônus/freebet: não há campo no `types.ts`; se hoje entram como aposta normal, inflam o yield.
- Nº de toques real para registrar+liquidar (não percorri NewBet/QuickBet a fundo).
- Performance com 10k+ lançamentos (suspeita de gargalo em `deriveBookmakerBalances`, não medido).

---
*Próximo passo concreto:* criar `computeYield`/`computeRoi` num único módulo e fazer Performance + Relatório consumirem ele — resolve o achado nº1 e nº2 de uma vez.
