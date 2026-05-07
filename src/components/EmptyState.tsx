import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <strong>{title}</strong>
      <p>{description}</p>
      {action && (
        <button className="primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
