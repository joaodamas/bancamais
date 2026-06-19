# Métricas, fórmulas e bugs clássicos — gestão de banca esportiva

Use este arquivo na **Fase 2 (Conferência da matemática)**. Ele te dá a régua: as fórmulas corretas, as convenções que uma ferramenta honesta documenta, e os erros que aparecem repetidas vezes. Tudo em **odd decimal** (a mais comum). Conversões no fim.

## Sumário
1. Glossário rápido
2. Lucro por aposta (por tipo de resultado)
3. Métricas agregadas (turnover, lucro, ROI/yield, banca, evolução)
4. Risco: drawdown, taxa de acerto, odd média, amostra
5. Avançado: probabilidade implícita, margem, EV, CLV, Kelly
6. Conversão de formatos de odd
7. Catálogo de bugs clássicos (o que caçar)
8. Procedimento de conferência (passo a passo)

---

## 1. Glossário rápido

- **Banca (bankroll):** total de dinheiro destinado a apostar. Tem *inicial* e *atual*.
- **Unidade (u):** stake-padrão da gestão. Quase sempre 1–2% da banca. `valor_unidade = banca × %_unidade`.
- **Stake:** valor arriscado numa aposta. Pode ser em R$ ou em unidades (ex.: "2u").
- **Odd:** cotação. Decimal: 2.00 = dobrar o valor (lucro = stake).
- **Green / Red:** aposta ganha / perdida. **Void / anulada / push:** devolvida (lucro 0).
- **Cashout:** encerramento antecipado por um valor combinado.
- **Turnover (volume apostado):** soma dos stakes.
- **Lucro:** resultado líquido (já descontado o stake nas perdas).
- **ROI / Yield:** rentabilidade sobre o volume apostado.

---

## 2. Lucro por aposta (odd decimal)

| Resultado | Fórmula do lucro | Observação |
|---|---|---|
| Green (ganhou) | `stake × (odd − 1)` | retorno total = `stake × odd`; lucro tira o stake de volta |
| Red (perdeu) | `− stake` | |
| Void / anulada / push | `0` | **o stake é devolvido**; não conta como perda |
| Cashout | `valor_cashout − stake` | pode ser + ou − |
| Meio green (ex.: handicap asiático) | `(stake/2) × (odd − 1)` | metade ganha, metade devolve |
| Meio red | `− stake/2` | metade perde, metade devolve |
| Múltipla (acumulada) | odd combinada = produto das odds das pernas; lucro = `stake × (odd_combinada − 1)` se TODAS green | perna anulada → sai da conta (odd vira 1.00 naquela perna); uma red → red total |

**Teste rápido:** odd 2.00, stake R$100. Green → +100. Red → −100. Void → 0. Se a ferramenta der qualquer coisa diferente disso, há bug.

---

## 3. Métricas agregadas

Considere apenas apostas **resolvidas** (settled). Pendentes NÃO entram em lucro/ROI.

- **Turnover (volume):** `Σ stake`. (Void geralmente entra no volume com lucro 0, ou é excluído — o importante é a ferramenta ser consistente e documentar.)
- **Lucro total:** `Σ lucro_de_cada_aposta`.
- **ROI (yield):** `lucro_total / turnover × 100`.
  - ⚠️ Confusão clássica: alguns chamam de "ROI" o `lucro / banca` e de "yield" o `lucro / turnover`. **Não existe certo absoluto, existe rótulo honesto.** O bug é calcular sobre a banca e chamar de yield, ou misturar. Em apostas, o número que importa pra medir habilidade é **lucro / turnover**.
- **Lucro em unidades:** `lucro_total / valor_unidade`. Métrica-rainha pra comparar desempenho independente do tamanho da banca.
- **Banca atual:** `banca_inicial + lucro_apostas + depósitos − saques`.
  - ⚠️ Depósito e saque **não são lucro**. Misturar infla/falsifica o desempenho.
- **Evolução / crescimento da banca:** `(banca_atual − banca_inicial − depósitos_líquidos) / banca_inicial × 100`. Tem que refletir o que veio das apostas, não dos aportes.

---

## 4. Risco e contexto

- **Drawdown:** queda do pico ao vale na curva da banca. **Max drawdown** = maior `(pico − vale) / pico` ao longo da série. Métrica de risco quase sempre ausente em ferramenta amadora — e a que mais importa pra saber se a gestão aguenta a maré ruim.
- **Taxa de acerto (hit rate):** `greens / (greens + reds)`. **Sozinha não diz nada:** 90% de acerto em odd 1.05 é prejuízo; 40% em odd 3.00 é lucro. Ferramenta que celebra hit rate sem cruzar com odd média está enganando.
- **Odd média:** média das odds, idealmente **ponderada pelo stake**. Média simples distorce quando os stakes variam.
- **Amostra:** variância em aposta é enorme. Como régua grosseira, ROI só começa a significar algo na casa das **centenas a milhares** de apostas. A ferramenta deve exibir o **n** ao lado de qualquer ROI e evitar vender um número de 10–30 apostas como verdade.

---

## 5. Avançado (diferenciais)

- **Probabilidade implícita:** `1 / odd`. (Odd 2.00 → 50%.)
- **Margem da casa (overround / vig):** `Σ (1/odd de cada resultado) − 1`. Quanto maior, pior pro apostador. Odd "justa" remove a margem.
- **Valor esperado (EV):** `EV = p × stake × (odd − 1) − (1 − p) × stake`, onde `p` é a probabilidade real estimada. EV > 0 = aposta de valor. Exige uma estimativa de `p` (a ferramenta tem isso ou só registra?).
- **CLV (Closing Line Value):** compara a odd pega com a odd de fechamento. Pegar odd maior que a de fechamento (CLV positivo) é o melhor indicador de longo prazo de que o apostador tem vantagem. Raro, mas é um baita diferencial.
- **Kelly:** fração ótima do bankroll a apostar: `f = (b·p − q) / b`, com `b = odd − 1`, `p = prob. de ganhar`, `q = 1 − p`. Na prática usa-se **Kelly fracionado** (ex.: ½ Kelly) pra reduzir variância. Kelly cheio é agressivo demais pra maioria.

---

## 6. Conversão de formatos de odd

- **Fracionária → decimal:** `numerador/denominador + 1` (5/2 → 3.50).
- **Americana → decimal:**
  - positiva: `(americana / 100) + 1` (+150 → 2.50)
  - negativa: `(100 / |americana|) + 1` (−200 → 1.50)

Se a ferramenta aceita vários formatos, confira se converte certo antes de calcular lucro — erro de conversão contamina todo o resto.

---

## 7. Catálogo de bugs clássicos (cace estes)

1. **Pendente contada como lucro/green** — infla tudo. A aposta só conta quando resolve.
2. **Void tratado como red** (ou ignorado do volume de forma inconsistente) — distorce ROI e banca.
3. **ROI sobre a banca rotulado como yield** (ou vice-versa) — número parece ótimo e está medindo a coisa errada.
4. **Depósito/saque somado ao lucro** — apostador "lucrando" só porque colocou mais dinheiro.
5. **Dinheiro em float** — centavos somem/aparecem; use decimal/inteiro de centavos. `0.1 + 0.2 ≠ 0.3`.
6. **Lucro = stake × odd** (esqueceram de tirar o stake) — superestima todo green.
7. **Trocar o valor da unidade recalcula o histórico inteiro** — apostas antigas deveriam guardar o valor da unidade da época; senão o lucro em unidades vira ficção.
8. **Bônus/freebet misturado no ROI real** — freebet não arrisca dinheiro próprio; jogado no mesmo bolo, turbina o yield falsamente.
9. **Múltipla com perna anulada calculada errada** — a perna vira odd 1.00, não red.
10. **Odd média simples em vez de ponderada** — engana quando stakes variam.
11. **Sem drawdown / sem amostra** — não é "bug" de conta, é cegueira de risco; trate como achado.
12. **Fuso horário no P&L diário** — aposta de 23h cai no dia errado.
13. **Arredondamento inconsistente** — soma das partes ≠ total exibido.

---

## 8. Procedimento de conferência (passo a passo)

1. Monte ou pegue uma amostra com pelo menos: 1 green, 1 red, 1 void, 1 cashout, uma odd alta e uma baixa (e 1 múltipla, se a ferramenta tiver).
2. Calcule à mão (ou com um script pequeno) o lucro de cada uma pela tabela da seção 2.
3. Some: turnover, lucro total, lucro em unidades.
4. Calcule ROI/yield e confira o **rótulo** (sobre turnover ou banca?).
5. Calcule a banca atual e a evolução, separando depósito/saque.
6. Reconstrua a curva da banca e ache o max drawdown.
7. **Confronte cada número com o que a ferramenta exibe pros mesmos dados.**
8. Para cada divergência: ferramenta diz X, o correto é Y, o erro está em [arquivo/linha/célula], impacto = [o que isso faz o dono concluir errado].

Se tudo bater, diga com todas as letras que os números fecham na amostra testada — e registre qual amostra foi (uma ferramenta de banca com a conta certa já está à frente da maioria).
