import { getQueueFiles } from '../../lib/data';

export default async function QueuePage() {
  const files = await getQueueFiles();

  return (
    <section>
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Queue</p>
          <h2>Postpone payloads</h2>
        </div>
        <p className="muted">{files.length} queued payloads</p>
      </div>

      {files.length === 0 ? (
        <div className="card emptyState">
          <strong>No queue payloads found.</strong>
          <p className="muted">The UI is wired to /intel/postpone-queue and will populate automatically when files land there.</p>
        </div>
      ) : (
        <div className="stack">
          {files.map((file) => (
            <article key={file.path} className="card stack">
              <div className="row spread gap wrap">
                <div>
                  <strong>{file.name}</strong>
                  <p className="muted small">{file.path}</p>
                </div>
                <span className="muted small">{new Date(file.modifiedAt).toLocaleString()}</span>
              </div>
              <pre className="jsonBlock">{file.preview}</pre>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
