interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="bg-primary px-5 pt-6 pb-6">
      <div className="max-w-2xl mx-auto flex items-start justify-between gap-4">
        <div>
          <h1 className="text-secondary font-display text-h1">{title}</h1>
          {subtitle && (
            <p className="text-body text-secondary/80 mt-1">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
