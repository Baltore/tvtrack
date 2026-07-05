export default function StatCard({ icon, label, value, tone = 'default' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <span className="stat-icon">{icon}</span>
      <div>
        <strong className="stat-value">{value}</strong>
        <span className="stat-label">{label}</span>
      </div>
    </article>
  );
}
