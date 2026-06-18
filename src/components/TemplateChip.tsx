interface TemplateChipProps {
  name: string;
  onApply: () => void;
  onDelete?: () => void;
}

/** Chip de template — clica no nome para preencher o form; × remove. */
export function TemplateChip({ name, onApply, onDelete }: TemplateChipProps) {
  return (
    <span className="template-chip">
      <button type="button" className="template-chip-apply" onClick={onApply} title="Aplicar template">
        {name}
      </button>
      {onDelete && (
        <button type="button" className="template-chip-del" onClick={onDelete} aria-label={`Remover template ${name}`}>
          ×
        </button>
      )}
    </span>
  );
}
