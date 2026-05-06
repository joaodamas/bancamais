# Banca+

Controle de banca para apostas esportivas.

## Etapa atual

Primeiro MVP tecnico criado em React + TypeScript + Vite, preparado para Firebase.

Inclui:

- Dashboard com saldo total, exposicao aberta, ROI, taxa de acerto e CLV medio.
- Lista de apostas com status e liquidacao rapida.
- Cadastro manual de nova aposta.
- Exportacao CSV das apostas.
- Importacao CSV no mesmo contrato de dados da exportacao.
- Bancas/casas seedadas com Bet365, Betano, Sportingbet e KTO.
- Logo inicial em SVG e guia visual.
- Modelos de dominio em TypeScript.
- Calculos financeiros isolados em `src/lib/metrics.ts`.
- Persistencia local em `localStorage` para validacao rapida.
- Sincronizacao opcional com Firebase Auth anonimo + Firestore.
- Cadastro/login por email e senha com Firebase Auth.
- Recuperacao de senha por email.
- Firebase Hosting, Firestore Rules e Storage Rules iniciais.
- Relatorios basicos com exportacao de base mensal/fiscal.
- Registro de deposito, saque, transferencia e ajuste em casas.
- Gestao de estrategias com ROI, acerto, CLV e pausa/reativacao.
- Alertas basicos de risco: sequencia negativa, exposicao aberta e stake acima da unidade.

## Comandos

```bash
npm install
npm run dev
npm run build
```

## Firebase

Projeto:

```txt
bancamais-12778
```

Dominio planejado:

```txt
bancamais.jpproject.com.br
```

Copie `.env.example` para `.env.local` se quiser rodar analytics com as variaveis do Firebase.

## Proxima etapa

- Usar Firestore como fonte principal quando autenticado.
- Adicionar login Google.
- Implementar upload de print/OCR.
- Recalculo contabil completo por ledger.
- Configuracao de limites de risco por usuario.
- Criar relatorios em PDF/HTML.
