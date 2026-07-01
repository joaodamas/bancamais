# Auditoria — Banca+ (gestão de banca esportiva)

> Auditoria técnica e de produto · foco em integridade dos números, gestão de banca e jogo responsável.
> Data: 2026-07-01 · Escopo: `src/lib/metrics.ts`, `src/lib/ledger.ts`, `src/services/bets.service.ts`, `src/lib/riskGuard.ts`, `src/lib/chartData.ts`, `src/lib/unit.ts`, telas Bancas & Casas / Dashboard / Extrato.

---

## 1. Veredito direto

**Esta é uma ferramenta séria — e isso é raro.** A conta fecha. Recalculei uma amostra cobrindo green, red, void, cashout, meio-green e meio-red **rodando o código de verdade** (não olhando a tela), e todos os números bateram: lucro por aposta, yield (4%), ROI (2%), hit rate (60%), odd média ponderada (2,10) e fator de lucro (1,13). O ROI está **rotulado com honestidade** (ROI = lucro/capital depositado; yield = lucro/turnover) — o erro clássico nº 3 do setor não está aqui.

Mais impressionante: **jogo responsável não é enfeite.** O hard stop diário/semanal/mensal **realmente bloqueia** a criação de aposta, e existe pausa responsável (auto-exclusão temporária). Isso, somado ao badge "amostra baixa" no ROI e ao drawdown visível, coloca a Banca+ acima de 90% das ferramentas de banca que já vi.

Não está perfeita. O que trava não é a matemática do dia a dia — é: (1) **importação de CSV de apostas meia-ganha/meia-perdida vaza dinheiro do ledger** porque não gera o lançamento de retorno; (2) o "drawdown mensal" do hard stop na verdade soma **perdas brutas** e ignora ganhos — rótulo enganoso; (3) **freebet/bônus não é separado do yield real**, o que pode turbinar o número de quem registra aposta grátis; (4) datas usam bases/fusos inconsistentes entre telas. Nenhum é fatal, mas o (1) e o (3) mentem sobre dinheiro e merecem prioridade.

**Dá pra confiar nos números do uso normal (registro manual). Não dá pra confiar 100% em quem importa apostas meia ou usa freebet até corrigir.**

---

## 2. O que eu entendi da ferramenta

- **Objetivo:** terminal de controle de banca para o apostador profissional/recreativo disciplinado — registrar apostas, reconciliar saldo por casa, medir edge (ROI/yield/CLV) e impor limites de risco. Não é cassino nem tipster preditivo. O CLAUDE.md deixa isso explícito e o produto é coerente com o discurso.
- **Público:** apostador individual gerenciando múltiplas casas. Há indício de **freemium** (limite de casas no plano grátis, `planAccess.limits.maxBookmakers`, upsell "Edge"). Fase: **em produção** (deploy no Firebase Hosting, usuário real com ~86 lançamentos).
- **Modelo de domínio:** `Bet` (com status green/red/void/cashout/meia), `BookmakerAccount`, `Transaction` (ledger imutável com `void_entry` para estorno), `Strategy`, `RiskSettings`. Odd **decimal**.
- **Gestão de banca:** suporta **unidade fixa (R$)** ou **% da banca** (`unitMode`), com teto de stake em unidades, teto de exposição aberta, limite de sequência negativa e hard stop por perda diária/semanal/mensal.
- **Telas:** Dashboard (métricas + curva + drawdown), Apostas, Bancas & Casas (ledger reconciliado por casa), Extrato (timeline consolidada), Risco, Performance, Inteligência (IA), CLV & Edge, Relatórios.
- **O que calcula:** lucro (R$), ROI, yield, hit rate, odd média ponderada, CLV médio, fator de lucro, drawdown, segmentações (faixa de odd, faixa de stake, dia da semana, mercado, liga, casa, estratégia), sequências green/red.

**Premissas que assumi:** amostra sintética de 7 apostas (odd decimal, stake R$100) porque não recebi o dump de apostas reais do usuário. Banca/depósito arbitrados no teste (R$1.000). As conclusões de matemática valem para a **lógica**, confirmada no código; para validar os **seus** números reais, rode a amostra contra o seu estado (ver seção 9).

---

## 3. Conferência da matemática ✅ (fecha)

**Amostra recalculada rodando o código real** (`calculateMetrics`, `settledPayout`, `betProfit`, `profitFactor`) — não a tela:

| Aposta | Status | Stake | Odd | Lucro correto | Código |
|---|---|---|---|---|---|
| A | green | 100 | 2,00 | +100 | +100 ✅ |
| B | red | 100 | 1,80 | −100 | −100 ✅ |
| C | void | 100 | 1,50 | 0 (devolve stake) | 0 ✅ |
| D | cashout 120 | 100 | 3,00 | +20 | +20 ✅ |
| E | meio-green | 100 | 2,00 | +50 = (stake/2)(odd−1) | +50 ✅ |
| F | meio-red | 100 | 1,90 | −50 = −stake/2 | −50 ✅ |
| G | pending | 100 | 2,50 | fora do lucro | excluída ✅ |

**Agregados (settled = A,B,D,E,F; void e pending fora):**

| Métrica | Correto | Código | Veredito |
|---|---|---|---|
| Lucro total | +20 | +20 | ✅ |
| Turnover liquidado | 500 | 500 | ✅ |
| **Yield** (lucro/turnover) | 4,0% | 4,0% | ✅ rótulo certo |
| **ROI** (lucro/capital depositado) | 2,0% | 2,0% | ✅ rótulo certo |
| Hit rate | 60% (3/5) | 60% | ✅ |
| Odd média (ponderada por stake) | 2,10 | 2,10 | ✅ não é média simples |
| Fator de lucro | 1,133 (170/150) | 1,133 | ✅ |
| Exposição aberta | 100 | 100 | ✅ |

**Conclusão:** os números fecham na amostra testada. Void devolve stake, pendente não entra no lucro, meio-green/meio-red usam a fórmula certa, ROI e yield estão separados e rotulados com honestidade, odd média é ponderada. **Este é o melhor elogio que uma ferramenta de banca pode receber — a maioria erra pelo menos um destes.**

---

## 4. O que NÃO presta (em ordem de impacto)

### 🟠 A1 — Import de meio-green/meio-red vaza dinheiro do ledger
**Onde:** `src/services/bets.service.ts` → `mergeImportedBets` (linhas 335–371). O `flatMap` só gera lançamento de retorno para `won`/`cashout` (bet_payout) e `void` (bet_refund). **`half_won` e `half_lost` não geram nenhum lançamento de retorno** — mas o `bet_stake` (−stake) é criado.
**Impacto:** ao importar via CSV uma aposta meia-ganha de R$100 @2,00 (retorno R$150), o ledger da casa debita −100 e **nunca credita os +150** → o saldo da casa fica R$150 subestimado por aposta. O `betProfit` (baseado em status/payout) até mostra o lucro certo no Dashboard, mas o **saldo reconciliado da casa mente**. Silencioso e cumulativo.
**Fix:** trocar o bloco por `settledPayout(bet.status, ...)` e criar `bet_payout`/`bet_refund` para todos os status liquidados (a mesma fonte que o `buildBetFromForm` já usa). `lost` continua sem lançamento (payout 0, correto).

### 🟡 A2 — "Drawdown mensal" do hard stop é soma de perdas brutas, não drawdown
**Onde:** `src/lib/riskGuard.ts` → `checkHardStop` (linhas 93–107) e `lossInWindow` (36–41).
**Impacto:** o limite mensal é rotulado "Drawdown mensal atingido" mas calcula `Σ|perdas|` na janela de 720h, **ignorando os ganhos**. Um mês em que você perdeu R$600 em algumas apostas mas ganhou R$800 em outras (líquido +200, banca subindo) **dispara o bloqueio** como se estivesse em drawdown. O mesmo vale para diário/semanal: usam perda **bruta**, não líquida. Isso é conservador (protege), mas o rótulo engana e pode frustrar ("estou no lucro e me bloqueou").
**Fix:** decidir a semântica e rotular certo. Se a intenção é "stop loss por perda acumulada", ok, mas chame de "perda bruta". Se é drawdown de verdade, calcule pico-a-vale da curva da banca na janela. Recomendo perda **líquida** por janela ("quanto você está no vermelho hoje/semana/mês") — é o que o apostador espera de um limite.

### 🟡 A3 — Freebet/bônus não é separado do yield real
**Onde:** modelo `Bet` (`src/lib/types.ts`) não tem flag de freebet; `betProfit`/`calculateMetrics` tratam tudo como dinheiro próprio arriscado.
**Impacto:** freebet não arrisca capital próprio e o lucro é `stake×(odd−1)` **sem devolver o stake**. Registrada como aposta normal, ela entra no turnover e infla o yield (bug clássico nº 8). Quem usa muita aposta grátis vê um edge que não existe.
**Fix:** flag `isFreebet` na aposta → excluir do turnover do yield "real" (ou reportar yield com e sem freebet), e ajustar o lucro para não somar stake de volta.

### 🟡 A4 — Bases de data inconsistentes entre telas (fuso/campo)
**Onde:** `buildDailyProfitSeries` usa `eventAt.slice(0,10)` (data **UTC** do ISO); `buildMonthlyData` usa `new Date(bet.eventAt).getMonth()` (mês **local**); ledger/hard stop usam `placedAt`.
**Impacto:** aposta feita 23h (horário BR) pode cair em **dia/mês diferente** entre o gráfico diário, o mensal e o extrato (bug clássico nº 12). P&L diário e mensal podem não reconciliar nas viradas de dia/mês.
**Fix:** padronizar uma única base (recomendo `eventAt` em timezone local do usuário, ou UTC consistente) em todas as agregações temporais.

### 🟡 A5 — Dinheiro em ponto flutuante
**Onde:** stakes, odds, payout e saldos são `number` (float) do JS. Mitigado por `toFixed(2)` no ledger, mas foi exatamente a origem do "−R$ 0,00" que corrigimos hoje.
**Impacto:** acúmulo de resíduo de centavo; já se manifestou. O rounding no ledger contém o sintoma, mas o cálculo intermediário ainda é float.
**Fix (futuro):** representar dinheiro em centavos inteiros, ou centralizar todo arredondamento numa camada única. Baixa urgência dado que o rounding atual segura.

---

## 5. Auditoria por dimensão

**Propósito vs execução** — ✅ Coeso. Cada tela puxa pro objetivo (controlar banca, medir edge, impor disciplina). Não vi feature órfã grave. A IA/Inteligência e "Odds (novo)" são as candidatas a scope creep — valem a pena **se** produzem ação; senão, viram vaidade (avaliar separadamente, não estavam no escopo).

**Modelo de gestão de banca** — ✅ Forte. Unidade fixa **ou** %, teto de stake em unidades, exposição máxima. Trata todos os tipos de resultado corretamente. Separa depósito/saque do lucro de apostas (ledger). **Falta:** freebet (A3).

**Matemática & integridade** — ✅ (ver Fase 2). Núcleo sólido. Ressalvas: A1 (import meia) e A5 (float).

**Sinal vs ruído** — ✅ Diferencial. `MIN_RELIABLE_SAMPLE = 100`, badge "amostra baixa" no ROI do Dashboard, drawdown calculado e exibido com faixas (Baixo/Moderado/Alto/Crítico). Poucas ferramentas fazem isso.

**Fonte da verdade & dados** — ✅ Ledger imutável com `void_entry` para estorno (trilha de auditoria preservada). Saldo por casa é **derivado** do ledger, não digitado — reconciliação real. Pendente vs liquidada bem separadas.

**Fluxos & jornada** — 🟡 Registro manual com OCR de bilhete e import CSV — bom. A fricção do formulário de movimentação (origem/destino) foi corrigida hoje. Liquidação em bulk (won/lost/void) existe.

**Telas / UX** — ✅ Dashboard responde "estou no lucro? quanto? em quantas apostas?" em segundos (lucro realizado, ROI com amostra, drawdown, sequências). Dark minimalista consistente.

**Outputs / acionabilidade** — ✅ Segmentação por faixa de odd, faixa de stake, dia da semana, mercado, liga, casa e estratégia — tudo decisão, não vaidade. "−X% em N apostas no mercado Y" leva a cortar. Fator de lucro presente.

**Jogo responsável** — ✅✅ **Destaque.** Hard stop que **bloqueia** aposta (App.tsx:709–717), pausa responsável (auto-exclusão), alertas parciais a 70% do limite, alerta de sequência negativa, teto de exposição. Nada aqui incentiva martingale/recuperação — pelo contrário, freia. Ressalva A2 (rótulo). **Falta:** aviso institucional de jogo responsável / canal de ajuda (ex.: "jogue com responsabilidade", link de apoio) para aderência regulatória BR.

**Técnico / código** — ✅ Boa separação (services, lib pura, handlers no App). Validação de entrada presente (odd ≥ 1.01, stake > 0, saldo). TypeScript strict. Testes existem (242 passando). Ressalva A5 (float).

**Riscos & escala** — 🟡 `deriveBookmakerBalances` recalcula varrendo todas as transações a cada render (com `useMemo`), e há `buildMirrorKeySet` O(n). Com 10.000 lançamentos pode pesar. `computeGlobalLedger` faz `bookmakers.reduce` dentro de `map` das transações → O(transações × casas). Hoje ok; monitorar.

---

## 6. Recomendações priorizadas

- **P0 (agora):**
  - **A1** — corrigir `mergeImportedBets` para gerar retorno de meio-green/meio-red. É dinheiro sumindo do ledger, silencioso. Fix pequeno, alto impacto.
- **P1 (em seguida):**
  - **A2** — decidir e rotular a semântica dos limites do hard stop (bruto vs líquido; "drawdown" só se for pico-a-vale).
  - **A3** — flag de freebet e yield "real" separado.
  - Adicionar **aviso de jogo responsável + canal de ajuda** (aderência BR).
- **P2 (futuro):**
  - **A4** — padronizar base/fuso de data nas agregações temporais.
  - **A5** — dinheiro em centavos inteiros.
  - Perf do ledger para escala (10k+ lançamentos).

---

## 7. Quick wins (semana)

1. **A1** — ~15 linhas em `mergeImportedBets` usando `settledPayout`. Fecha o vazamento de import.
2. **Rótulo A2** — trocar "Drawdown mensal" por "Perda acumulada no mês" enquanto a semântica não muda. Zero risco, remove a mentira do rótulo.
3. **Aviso de jogo responsável** — rodapé/aviso fixo com "18+ · jogue com responsabilidade" + link de apoio. Barato, protege usuário e produto.
4. **Teste de regressão** para import de half_won/half_lost (garante que A1 não volta).

---

## 8. O que colocar e o que tirar

**Colocar:**
- **Lucro em unidades** como métrica de primeira classe no Dashboard (`lucro / valor_unidade`). É a métrica-rainha para comparar desempenho independente do tamanho da banca — a lib já tem `resolveUnitValue`, falta expor o lucro em "u" no herói.
- **Flag de freebet** (A3) — separa edge real de bônus.
- **Aviso de jogo responsável + canal de ajuda** — quase obrigatório no contexto regulatório brasileiro.
- **CLV com destaque** — a Banca+ já calcula CLV (raro e valioso); vale promover como o indicador nº 1 de habilidade de longo prazo, com amostra ao lado.

**Tirar / vigiar:**
- Avaliar se **Inteligência (IA)** e **Odds (novo)** produzem **ação** ou são enfeite. Se o output não muda uma decisão de aposta, é peso morto disfarçado de progresso — não estavam no escopo desta auditoria, mas são os candidatos naturais a scope creep.
- Qualquer métrica exibida **sem amostra** ao lado (o Dashboard já faz certo com o badge; garantir que Relatórios e segmentações também sinalizem N baixo).

---

## 9. O que ficou sem avaliar (e como fechar)

- **Seus números reais.** Auditei a **lógica** com amostra sintética confirmada no código. Para validar o **seu** estado: exporte suas apostas (ou me passe o `appState`) e eu rodo `calculateMetrics` contra ele, comparo com a tela e reconstruo a curva/drawdown.
- **Múltiplas (acumuladas)** — não vi tratamento explícito de aposta combinada com odd-produto e perna anulada (odd → 1.00). Confirmar se a ferramenta suporta múltiplas e como calcula. Se suporta, é candidato a bug clássico nº 9.
- **Import CSV — parsing** (`csv.ts`): confirmei que aceita qualquer status; não auditei conversão de formato de odd nem datas na importação a fundo.
- **IA (`aiService.ts`), Odds, Relatórios executivos** — fora do escopo pedido (foco em ledger/métricas). Avaliar em rodada dedicada.
- **Segurança / multiusuário** — Firestore rules e isolamento por `uid` não foram auditados aqui.

---

### Primeiro passo concreto para segunda de manhã
Corrija o **A1** (import de meia-ganha/meia-perdida não credita o retorno no ledger) e adicione um teste de regressão. É o único achado que faz o **saldo da casa mentir** de forma silenciosa. O resto pode entrar na esteira P1/P2.
