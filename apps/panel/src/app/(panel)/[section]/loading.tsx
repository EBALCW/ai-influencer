export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Sayfa yükleniyor" className="page-stack">
      <div className="skeleton" style={{ height: 220 }} />
      <div className="stats-grid">
        {[1, 2, 3].map((item) => (
          <div className="skeleton" key={item} style={{ height: 118 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 260 }} />
    </div>
  );
}
