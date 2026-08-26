/**
 * Page heading. The description states what the page does in one sentence —
 * no marketing copy (SPEC 6.4 #5). `action` holds the single primary button.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[25px] leading-tight font-extrabold tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}
