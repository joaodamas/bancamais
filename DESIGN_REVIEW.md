# Revisao das telas do prototipo

Data: 06/05/2026.

## Manter

- Sidebar fixa com grupos: Inicio, Analise e Gestao.
- Topbar com busca global, notificacao/calendario e botao `Nova aposta`.
- Visual dark premium com cards discretos e bordas finas.
- Dashboard denso, focado em banca, KPIs, curva e insights.
- Apostas em tabela, nao em cards. Para esse dominio, tabela e melhor para comparacao.
- Paginas separadas para Inteligencia, Relatorios, CLV, Bancas e Estrategias.
- Botao flutuante de nova aposta para fluxo rapido.
- Linguagem de produto focada em banca, risco, edge e decisao.

## Ajustar

- O nome visual deve ser Banca+, nao Pari.
- Evitar depender de mock visual estatico: os cards devem usar dados do estado real.
- Manter CLV como tela Pro, mas calcular com dados existentes quando houver `closingOdds`.
- Inteligencia deve comecar como regras/heuristicas locais antes de chamar IA paga.
- Relatorio fiscal precisa ficar como base/exportacao ate validacao com contador.
- Importacao por conectores deve ser tratada como roadmap; CSV e OCR vem primeiro.
- UI precisa funcionar bem com poucos dados, sem assumir 244 apostas.

## Nao trazer agora

- Graficos complexos customizados demais.
- Conectores reais com casas de aposta antes de resolver seguranca/compliance.
- PDF fiscal automatizado antes da regra tributaria ser validada.
- AI coach pago antes de termos historico real suficiente.

## Implementado nesta rodada

- Navegacao agrupada.
- Busca global visual na topbar.
- Botao flutuante de nova aposta.
- Tela Inteligencia com resumo, sugestoes, exposicao e odds.
- Tela CLV & Edge com CLV medio e distribuicao por casa.
