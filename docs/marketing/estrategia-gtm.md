# Estratégia de Go-to-Market e Monetização do Banca+

Documento-mestre. Materiais de apoio nesta mesma pasta:
- `lead-magnet-7-armadilhas.md` (isca grátis de topo de funil)
- `protocolo-gestao-de-banca.md` (infoproduto pago, R$ 47)
- `roteiros-reels.md` (roteiros de Instagram/Reels)

## Contexto e restrições

- **Produto Edge** (IA, OCR, Odds/CLV): existe, mas precisa validar em uso real antes de cobrar assinatura com segurança.
- **Audiência**: praticamente zero. Precisa ser construída.
- **Verba de tráfego**: até ~R$ 500/mês no início.
- **Formato**: o criador aparece em vídeo (Reels com rosto) + screencast do app.
- **Checkout escolhido**: Mercado Pago.

## A jogada central: escada de valor

Vender assinatura de R$ 24,90/mês agora falharia (sem audiência, produto não provado, verba curta). O caminho é uma escada:

> **Grátis (Controle)** → **Low-ticket "Protocolo" R$ 47** (gera caixa hoje + valida quem paga) → **Founder do Edge** (vitalício com desconto) → **Edge recorrente** quando provado.

O low-ticket faz 3 coisas: entra dinheiro na semana 1, descobre quem realmente paga (não só curioso de grátis) e transforma a lista de espera em lista de compradores (a base paga do Edge).

**Maior ativo de marca:** "não é cassino, é disciplina". Todo o marketing se apoia nisso. É o ângulo que passa em política de anúncio e diferencia de tipster.

## Preços e planos

| Produto | Preço | Papel no funil |
|---|---|---|
| Controle (grátis) | R$ 0 | Topo de funil, captura conta |
| Protocolo de Gestão de Banca (infoproduto) | R$ 47 (lançamento R$ 27) | Entrada paga. Inclui acesso Founder ao Edge |
| Edge Founder (vitalício) | R$ 99/ano travado (de R$ 199), primeiros 100 | Converte comprador em assinante fiel |
| Edge (recorrente, pós-validação) | R$ 24,90/mês ou R$ 199/ano | Receita recorrente quando provado |

**Order bump no checkout** (+R$ 19): planilha-mãe + 30 dias de Telegram fechado.

**Stack de valor do Protocolo** (ancora o R$ 47): Protocolo (R$ 97) + acesso Founder ao Edge + planilha (R$ 47) + checklist anti-tilt (R$ 27) + 30 dias no Telegram (R$ 47). Total percebido ~R$ 300 por R$ 47.

## Infoprodutos

- **Lead magnet grátis:** "As 7 armadilhas que derretem sua banca sem você ver" (captura email/Telegram). Produzir primeiro.
- **Produto pago:** "Protocolo de Gestão de Banca" (mini-curso, R$ 47). Produzir na 2ª semana.
- **Bônus/futuros:** "Planilha vs. Banca+", checklist anti-tilt, guia de CLV.

## Funil e posicionamento

Posicionamento: "O terminal que te mostra se você está no lucro de verdade e te impede de perder o mês numa noite." Controle financeiro e disciplina, nunca "ganhe dinheiro apostando".

```
Reels (dor/disciplina) -> perfil otimizado -> link na bio (lead magnet)
   -> Telegram/email -> nurture (conteúdo diário) -> oferta Protocolo R$ 47
   -> order bump -> Founder Edge
```

- Instagram = topo (alcance frio via Reels).
- Telegram fechado = meio (comunidade, aquecimento, prova social).
- Checkout Mercado Pago = fundo (Protocolo + bump).

**Política de anúncio:** conteúdo de apostas é sensível no Meta. Orgânico com enquadramento de finanças/disciplina corre solto. Anúncio pago pode ser barrado se cheirar a aposta. A verba de R$ 500 entra só depois de um Reels validar organicamente, sempre com criativo de controle financeiro (dashboard), jamais odds, green ou lucro de aposta.

## Cronograma 30 / 60 / 90 dias

- **Semana 1:** montar lead magnet + Telegram fechado + otimizar bio/link. Gravar 7 Reels. Ajustar landing (checkout + Founder + prova social). Meta: 3 primeiros depoimentos (beta grátis em troca de depoimento).
- **Semana 2:** publicar Protocolo R$ 47 (Mercado Pago) + order bump. 1 Reel/dia. Meta: 10 vendas orgânicas (~R$ 470).
- **Semanas 3 e 4:** pegar o Reel vencedor e colocar R$ 15/dia de tráfego (retargeting + lookalike), sempre em enquadramento de disciplina. Meta: CPA <= R$ 30.
- **Dia 30 (métricas de corte):** conversão da landing >= 1%, CPA <= R$ 30 -> escala. % da lista Founder que paga = valida o preço do Edge.
- **60/90 dias:** com o Edge validado pelos Founders, ligar a recorrência, subir verba do que provou CPA, transformar depoimentos em prova social na landing e em Reels.

## Suporte técnico necessário (código)

- **Checkout Mercado Pago:** o Protocolo (R$ 47 único) precisa de Checkout Pro / preference (pagamento único), diferente das functions de assinatura (preapproval) já existentes. O Founder/Edge usa o fluxo de assinatura.
- **Landing:** trocar "lista de espera" por "Garantir preço de fundador"; adicionar prova social (3 depoimentos) e a seção "planilha vs Banca+".
- **Tracking:** Pixel do Meta + GA4 + UTMs. Sem isso, tráfego pago é no escuro.

## Métricas-chave

Conversão da landing, CPA, ticket médio (com order bump), taxa de conversão do Protocolo para Founder, retenção do Edge quando recorrente.
