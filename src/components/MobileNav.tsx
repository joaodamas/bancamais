import { useEffect, useState, type ElementType } from "react";
import { Menu, X } from "lucide-react";

export type MobileNavItem = { id: string; label: string; badge?: string; Icon: ElementType };
export type MobileNavGroup = { label: string; items: MobileNavItem[] };

const PRIMARY_IDS = ["dashboard", "bets", "diario", "books"];

type Props = {
  view: string;
  onNavigate: (id: string) => void;
  groups: MobileNavGroup[];
  bankrollName: string;
  totalBalance: string;
};

export function MobileNav({ view, onNavigate, groups, bankrollName, totalBalance }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const allItems = groups.flatMap((group) => group.items);
  const primary = PRIMARY_IDS
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is MobileNavItem => Boolean(item));
  const isOverflowView = !PRIMARY_IDS.includes(view);

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSheetOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  function go(id: string) {
    onNavigate(id);
    setSheetOpen(false);
  }

  return (
    <>
      <nav className="mobile-nav" aria-label="Navegação principal">
        {primary.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? "mobile-nav__tab is-active" : "mobile-nav__tab"}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => go(item.id)}
          >
            <item.Icon size={21} strokeWidth={2} />
            <span>{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={sheetOpen || isOverflowView ? "mobile-nav__tab is-active" : "mobile-nav__tab"}
          aria-expanded={sheetOpen}
          aria-haspopup="true"
          onClick={() => setSheetOpen((open) => !open)}
        >
          <Menu size={21} strokeWidth={2} />
          <span>Mais</span>
        </button>
      </nav>

      {sheetOpen && (
        <div className="mobile-sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div
            className="mobile-sheet"
            role="dialog"
            aria-label="Mais telas"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-sheet__handle" />

            <button type="button" className="mobile-sheet__bank" onClick={() => go("books")}>
              <span>{bankrollName}</span>
              <strong>{totalBalance}</strong>
            </button>

            {groups.map((group) => (
              <div className="mobile-sheet__group" key={group.label}>
                <span className="mobile-sheet__group-label">{group.label}</span>
                <div className="mobile-sheet__grid">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={view === item.id ? "mobile-sheet__item is-active" : "mobile-sheet__item"}
                      onClick={() => go(item.id)}
                    >
                      <item.Icon size={18} strokeWidth={2} />
                      <span>{item.label}</span>
                      {item.badge && <em>{item.badge}</em>}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button type="button" className="mobile-sheet__close" onClick={() => setSheetOpen(false)}>
              <X size={16} />
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
