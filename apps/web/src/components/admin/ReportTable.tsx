/** A compact report table: first column is the label, the rest are right-aligned numbers. */
export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No data yet.</p>;
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={i ? 'text-right' : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j ? 'num text-right' : 'max-w-[320px] truncate'}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
