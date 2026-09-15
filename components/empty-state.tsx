export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rise border border-dashed border-rule bg-panel px-6 py-14 text-center">
      <h2 className="font-display text-3xl font-bold tracking-tight text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
