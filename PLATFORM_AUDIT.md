# Banca+ — Auditoria de Plataforma
_Data: 2026-05-07_

## Adendo UI/UX Premium

### Diagnóstico visual

- A base estava coerente, mas ainda não parecia um produto premium. O principal problema era sistêmico: shell, topbar, page actions, cards, tabelas e painéis compartilhavam quase o mesmo peso visual, achatando hierarquia.
- A sidebar tinha boa organização funcional, mas pouco contraste operacional e pouco senso de produto high-end.
- Dashboard, Intelligence e Reports tinham leitura correta, porém mais próxima de um MVP sólido do que de uma plataforma analítica premium.
- Apostas e Bancas & Casas concentravam a operação, mas ainda com cara de CRUD denso em vez de console profissional.
- Auth e NewBet já tinham uma boa base de fluxo, mas sem acabamento visual suficiente para elevar percepção de valor.

### Problemas centrais

1. Hierarquia insuficiente entre navegação, contexto e conteúdo.
2. Repetição excessiva da mesma linguagem de card.
3. Contraste funcional fraco entre risco, performance, IA e contexto.
4. Tabelas legíveis, porém sem o refinamento visual esperado de um produto premium.
5. Topbar e sidebar com pouca distinção estrutural do conteúdo principal.

### Ação executada

- Override sistêmico do design system para linguagem premium 2026.
- Nova paleta escura de fintech/trading com indigo, azul frio e feedbacks mais elegantes.
- Shell principal elevado com mais profundidade, blur, camadas e melhor leitura.
- Reforço visual em cards, métricas, tabelas, heatmaps, auth e modal NewBet.
- Code splitting para reduzir o bootstrap inicial e melhorar percepção de velocidade.
- Reestruturação de Dashboard, Apostas, Relatórios, Bancas & Casas e Configurações com barras de comando, KPIs secundários e hierarquia operacional mais forte.

## Sumário
- **13 issues encontrados**: 2 críticos, 4 altos, 5 médios, 2 baixos
- **9 issues corrigidos diretamente** nesta sessão
- Build limpo antes e depois das correções (TypeScript strict, zero erros)

---

## Por tela

### Dashboard
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| ✅ | Métricas (ROI, hit rate, CLV, exposição) calculadas corretamente | — | — |
| ✅ | Empty state com CTA correto — sem casas redireciona para Books, sem apostas abre Nova Aposta | — | — |
| ✅ | Gráfico evolução da banca guarda contra `timeSeries.length <= 1` | — | — |
| ✅ | Gráfico ROI mensal guarda contra `monthlyData.length === 0` | — | — |
| ✅ | Alertas de risco renderizados via `riskAlerts(state)` corretamente | — | — |
| 🟡 | Gráfico "Lucro por esporte" usa `betProfit` (que inclui void com payout=0) mas o filtro de settled não exclui `void` da série — barras negativas podem ser geradas por apostas void com payout zero | Médio | Não (melhoria futura) |

### Apostas (Bets)
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| 🔴 | Cashout sempre usava `stake * odds` (retorno integral) em vez do valor real do cashout — qualquer registro de cashout inflava o saldo e o ledger | Crítico | ✅ Sim — `settleBet` aceita `cashoutAmount`; Bets.tsx agora exibe input inline para capturar o valor real |
| ✅ | Empty state na tabela quando sem dados ou sem resultados para filtros | — | — |
| ✅ | Filtros por status funcionais | — | — |
| ✅ | Export CSV funcional via `betsToCsv` | — | — |
| 🟡 | Nenhum botão para editar ou deletar uma aposta já registrada — sem correção de erros de digitação pós-submit | Médio | Não (melhoria futura) |
| 🔵 | Campo de busca local na tela duplica a busca global do topbar — poderia ser consolidada | Baixo | Não |

### Nova Aposta (NewBet)
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| ✅ | Cooldown de risco bloqueia submit com mensagem clara e opção de override | — | — |
| ✅ | Validação de stake > saldo disponível feita em App.tsx antes de salvar | — | — |
| ✅ | OCR: estados idle/loading/done/error com mensagens adequadas | — | — |
| ✅ | Fixture search desabilitada quando `isSportsApiConfigured()` retorna false | — | — |
| 🟠 | `isSportsApiConfigured()` retornava sempre `true`, causando chamadas Firebase Functions mesmo sem projeto configurado — pesquisa de partidas nunca retornaria resultado útil sem deploy das functions | Alto | ✅ Sim — agora retorna `Boolean(VITE_FIREBASE_PROJECT_ID)` |
| 🟡 | Sem validação de formato de data no campo `eventAt` — datas inválidas passam como string vazia | Médio | Não (melhoria futura) |

### Importar (Import)
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| ✅ | Parsing CSV robusto com suporte a aspas duplas e vírgulas internas | — | — |
| ✅ | Validação de campos obrigatórios e casa existente antes de importar | — | — |
| ✅ | Deduplicação de apostas por ID ao importar | — | — |
| ✅ | Ledger: transações `bet_stake` e `bet_payout`/`bet_refund` criadas corretamente para apostas importadas | — | — |
| 🟡 | Sem pré-visualização tabular antes do commit — apenas contagem de linhas | Médio | Não (melhoria futura) |

### Inteligência / IA (Intelligence)
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| ✅ | `useAIAnalysis` expõe `{ analysis, loading, error, refresh }` — todos usados corretamente | — | — |
| ✅ | Empty state quando sem apostas ou sem análise gerada | — | — |
| ✅ | Heatmap dos últimos 21 dias data-driven | — | — |
| 🟠 | `isNewsApiConfigured()` retornava sempre `true`, exibindo o widget de notícias mesmo sem Firebase Functions implantadas — widget sempre mostrava spinner e falha silenciosa | Alto | ✅ Sim — agora retorna `Boolean(VITE_FIREBASE_PROJECT_ID)` |
| 🟡 | `useAIAnalysis` não executa `refresh` automaticamente na montagem — o usuário precisa clicar "Atualizar" para ver a análise | Médio | Não (decisão de produto — evita custo de API no load) |

### Relatórios (Reports)
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| ✅ | Métricas operacionais corretas | — | — |
| ✅ | Export CSV funcional | — | — |
| 🟡 | "Saldo transacional líquido" soma `transaction.amount` bruto — inclui `bet_stake` negativo e `bet_payout` positivo, resultado não é o mesmo que `calculateLedgerTotalBalance`. O label é enganoso | Médio | Não (renomear para "Fluxo bruto de lançamentos" seria mais honesto) |
| 🔵 | Botão "Preparar perfil público" disabled sem rota ou funcionalidade — placeholder visível para o usuário final | Baixo | Não |

### CLV & Edge
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| ✅ | `buildClvTimeSeries` filtra corretamente apostas sem `closingOdds` | — | — |
| ✅ | Gráfico cronológico e por casa funcionais com empty states | — | — |
| ✅ | Métricas CLV médio corretamente calculadas | — | — |

### Bancas & Casas (Books)
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| 🟠 | Summary card "Saldo consolidado" usava `book.balance` (campo salvo) em vez do saldo derivado pelo ledger — discrepância possível após cashouts, voids e anulações | Alto | ✅ Sim — agora usa `calculateLedgerTotalBalance(state)` via `useMemo` |
| ✅ | Ledger imutável com anulações funcionando corretamente | — | — |
| ✅ | Remoção de casa bloqueada quando há histórico vinculado | — | — |
| ✅ | Verificação de saldo antes de saque/transferência | — | — |
| ✅ | Transferência cria dois lançamentos simétricos | — | — |
| 🟡 | Formulário de transação mostra "Casa destino" mesmo para depósitos/saques onde não é relevante — pode confundir | Médio | Não (melhoria de UX futura) |

### Estratégias (Strategies)
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| 🟡 | Sem empty state na tabela quando não há estratégias cadastradas — tabela renderizava vazia sem aviso | Médio | ✅ Sim — linha com mensagem "Nenhuma estratégia cadastrada" adicionada |
| ✅ | `groupProfitByStrategy` calcula ROI, hit rate e CLV corretamente por estratégia | — | — |
| ✅ | Toggle ativo/pausado funcional com toast de feedback | — | — |

### Configurações (Settings)
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| 🟠 | Botão "Restaurar dados demo" era destrutivo sem confirmação — um clique acidental apagaria todos os dados locais | Alto | ✅ Sim — `window.confirm()` adicionado antes do reset |
| 🟡 | `updateRiskSettings` não tinha toast de sucesso — usuário não sabia se o submit funcionou | Médio | ✅ Sim — `toast.success` adicionado |
| ✅ | Sincronização automática a cada 3s para usuários autenticados não-anônimos | — | — |
| ✅ | Status de sync (online/temp/offline) refletido corretamente na UI | — | — |

### Onboarding
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| 🟡 | IDs de casas no onboarding usavam `Date.now()` — colisão possível se o usuário adicionar duas casas rapidamente | Médio | ✅ Sim — substituído por `crypto.randomUUID()` |
| ✅ | Fluxo de 3 etapas funcional | — | — |
| ✅ | Passo 2 pode ser pulado ("Pular — adicionar depois") | — | — |
| ✅ | `completeOnboarding` cria transações de depósito inicial corretas | — | — |

### AuthPage
| Status | Item | Severidade | Corrigido? |
|--------|------|-----------|------------|
| ✅ | Três modos (signin/signup/reset) com forms separados | — | — |
| ✅ | Google Sign-In funcional | — | — |
| ✅ | Modo demo anônimo disponível | — | — |
| ✅ | Mensagem de feedback (`authMessage`) exibida corretamente | — | — |

---

## Issues globais (cross-cutting)

### updateState gravava na chave anônima para usuários autenticados
**Severidade: Crítico**

`App.tsx` linha 224 chamava `saveState(next)` que grava em `bancamais.demo.state` (chave legacy anônima). Para um usuário autenticado, isso causava:
1. O estado local correto estar em `bancamais.state.{uid}` (atualizado pelo `useEffect` de auto-save)
2. O estado legacy `bancamais.demo.state` receber cópias de todas as mutações

Resultado: se o usuário limpa cache e faz login em outro navegador, o estado carregado da nuvem pode ser inconsistente com o localStorage.

**Corrigido:** `updateState` agora chama `saveStateForUser(user.uid, next)` quando há usuário, e `saveState(next)` apenas no modo anônimo.

### `cooldownUntil` perdido ao fazer round-trip cloud
**Severidade: Alto**

`loadCloudState` reconstruía o `AppState` listando cada campo explicitamente mas omitia `cooldownUntil`. Após um pull da nuvem, qualquer cooldown de risco ativo era silenciosamente apagado.

**Corrigido:** campo adicionado ao `loadCloudState` e ao `normalizeState`.

### `buildMonthlyData` ignorava cashout no cálculo de lucro
**Severidade: Médio**

O gráfico de ROI mensal só calculava payout para apostas `won`, deixando apostas `cashout` com `payout = 0` — subnotificando o lucro real em cashouts.

**Corrigido:** condição expandida para `won || cashout`, usando `bet.payout ?? potentialReturn(bet)` como fallback.

### Firebase credentials hardcoded como fallback
**Severidade: Alto**

`firebase.ts` usava o operador `??` para embutir credenciais reais do projeto Firebase quando as variáveis de ambiente não estavam definidas. Qualquer build sem `.env` incluía chaves reais no bundle JavaScript.

**Corrigido:** fallbacks removidos. Se as variáveis não estiverem definidas, os valores serão `undefined` — o Firebase lançará um erro claro em vez de usar credenciais embutidas silenciosamente.

> **Ação necessária:** Rotacione a `apiKey` Firebase se o código foi publicado em repositório público com os valores hardcoded.

---

## Não implementado / placeholder

| Funcionalidade | Localização | Observação |
|---|---|---|
| Perfil público tipster | `Reports.tsx` — botão "Preparar perfil público" disabled | UI existe, backend inexistente |
| Sugestões de IA da feed real | `suggestions.ts` — `buildSuggestionsWorkspace` retorna fixtures e sugestões **hardcoded** (Palmeiras x Flamengo, Celtics x Miami etc.) | Toda a workspace é mock estático — nenhum feed real de odds ou fixtures está sendo consumido |
| Auto-settlement via API de resultados | `sportsApi.ts` — `getFixtureResult` existe mas nunca é chamado | A função está implementada mas não há nenhum job/trigger que use os resultados para liquidar apostas automaticamente |
| Orçamento de OCR real | `ocr.ts` — chama `parseBetSlipCallable` Firebase Function | Funciona se a Function estiver implantada; retorna `not_configured` se não estiver |
| Notificações (Bell) | `App.tsx` topbar — botão Bell sem nenhum handler ou estado | Ícone sem funcionalidade |

---

## Recomendações futuras

1. **Edição de apostas** — atualmente impossível corrigir stake/odds/mercado de uma aposta já registrada. Considere um fluxo de "edição que cria void + nova aposta" para manter a auditabilidade do ledger.

2. **Paginação na tabela de Apostas** — com carteiras grandes (>500 apostas) a tabela renderiza tudo de uma vez sem virtualização.

3. **Separação de `saveState` legacy** — `loadState()` e `saveState()` em `storage.ts` ainda existem mas são código legado do modo demo pré-auth. Podem ser removidas quando o modo anônimo for totalmente migrado para `loadStateForUser` / `saveStateForUser`.

4. **Teste de unidade para `ledger.ts`** — as funções `transactionImpactForBookmaker`, `deriveBookmakerBalances` e `computeBookmakerLedger` são o núcleo financeiro da plataforma e não têm cobertura de teste. Pequenas mudanças nelas podem causar problemas de balanço silenciosos.

5. **Confirmação antes de saque/transferência grande** — a validação de saldo existe, mas não há confirmação de "você tem certeza?" para movimentações acima de um threshold.

6. **Debounce ou throttle no auto-save** — o `useEffect` de auto-save em `App.tsx` chama `saveStateForUser` de forma síncrona em cada mudança de estado (JSON.stringify de todo o estado), além do timer para Firestore. Com estados grandes isso pode ser perceptível.

7. **Regras de segurança do Firestore** — não foi possível verificar as regras diretamente nesta auditoria. Confirme que as regras garantem que `users/{uid}/appStates/{docId}` só seja legível/escrita pelo próprio `uid`.
