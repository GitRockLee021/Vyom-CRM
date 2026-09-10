function pageList(total, current) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set([1, 2, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, totalPages, totalItems, pageSize, onPageChange, label = 'items' }) {
  const start = (page - 1) * pageSize;
  const from = totalItems ? start + 1 : 0;
  const to = Math.min(start + pageSize, totalItems);

  return (
    <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
      <span className="font-body-md text-body-md text-on-surface-variant">
        {totalItems ? `Showing ${from} to ${to} of ${totalItems} ${label}` : 'No entries'}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          className="px-2 py-1 border border-outline-variant rounded bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onPageChange(page - 1)}
        >
          <span className="material-symbols-outlined text-sm">chevron_left</span>
        </button>
        {pageList(totalPages, page).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-2 text-on-surface-variant">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`px-3 py-1 border rounded font-label-md text-label-md transition-colors ${
                p === page
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
              }`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          className="px-2 py-1 border border-outline-variant rounded bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onPageChange(page + 1)}
        >
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
