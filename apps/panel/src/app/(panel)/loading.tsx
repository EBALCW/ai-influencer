export default function Loading() {
  return (
    <main aria-label="Sayfa yükleniyor" className="main-content">
      <div className="skeleton" style={{ height: 220 }} />
      <div className="stats-grid">
        {[1, 2, 3].map((item) => (
          <div className="skeleton" key={item} style={{ height: 118 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 260 }} />
    </main>
  );
}
