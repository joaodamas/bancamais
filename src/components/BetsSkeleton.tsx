import type { CSSProperties } from "react";

function Skel({ w, h = 13, r = 6, right = false }: { w: number | string; h?: number; r?: number; right?: boolean }) {
  const style: CSSProperties = { width: w, height: h, borderRadius: r };
  if (right) style.marginLeft = "auto";
  return <span className="skel-block" style={style} />;
}

/** Linha-fantasma que respeita exatamente a grade da tabela v2 (sem layout shift). */
function BetRowSkeleton() {
  return (
    <tr className="bet-skel-row">
      <td className="bet-select-col"><Skel w={15} h={15} r={4} /></td>
      <td className="bet-cell">
        <Skel w="78%" />
        <div style={{ marginTop: 7 }}><Skel w="50%" h={11} /></div>
      </td>
      <td className="bet-cell">
        <Skel w="68%" />
        <div style={{ marginTop: 7 }}><Skel w="40%" h={11} /></div>
      </td>
      <td className="bet-cell"><Skel w="70%" /></td>
      <td className="bet-cell num">
        <Skel w={62} right />
        <div style={{ marginTop: 7 }}><Skel w={42} h={11} right /></div>
      </td>
      <td className="bet-cell num">
        <Skel w={82} right />
        <div style={{ marginTop: 7 }}><Skel w={56} h={11} right /></div>
      </td>
      <td className="bet-cell"><Skel w={70} h={20} r={999} /></td>
      <td className="bet-cell" />
    </tr>
  );
}

/** Esqueleto da tela de Apostas inteira — mesma estrutura da real, estabiliza o layout no load. */
export function BetsSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <section className="page page-bets" aria-busy="true">
      <div className="bets-head">
        <div className="filter-tabs">
          {Array.from({ length: 5 }).map((_, i) => <Skel key={i} w={74} h={30} r={8} />)}
        </div>
        <div className="bets-head-tools">
          <Skel w={230} h={32} r={8} />
          <Skel w={32} h={32} r={8} />
          <Skel w={110} h={32} r={8} />
        </div>
      </div>

      <div className="bets-summary-strip">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bets-summary-item">
            <Skel w={72} h={9} />
            <div style={{ marginTop: 5 }}><Skel w={94} h={18} /></div>
          </div>
        ))}
      </div>

      <div className="table-card">
        <div className="bets-table-wrapper">
          <table className="bets-table bets-table-v2">
            <colgroup>
              <col style={{ width: "38px" }} />
              <col />
              <col style={{ width: "27%" }} />
              <col style={{ width: "108px" }} />
              <col style={{ width: "104px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "104px" }} />
              <col style={{ width: "120px" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="bet-select-col" />
                <th>Evento</th>
                <th>Mercado</th>
                <th>Casa</th>
                <th className="num">Aposta</th>
                <th className="num">Retorno</th>
                <th>Status</th>
                <th className="bet-actions-col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, i) => <BetRowSkeleton key={i} />)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
