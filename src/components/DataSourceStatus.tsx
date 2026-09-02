export default function DataSourceStatus({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`source-status ${compact ? "source-status--compact" : ""}`}>
      <span className="source-status__mode"><span aria-hidden>●</span> Live agent</span>
      {!compact && <span>OpenAI searches Shopify Global Catalog when you press Go.</span>}
      <span className="source-status__live">No demo fallback</span>
    </div>
  );
}
