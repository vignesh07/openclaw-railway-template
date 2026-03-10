import { getSourceFiles } from '../../lib/data';

export default async function SourcesPage() {
  const files = await getSourceFiles();

  return (
    <section>
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Sources</p>
          <h2>Scrape files</h2>
        </div>
        <p className="muted">{files.length} source files</p>
      </div>

      <div className="stack">
        {files.map((file) => (
          <article key={file.path} className="card stack">
            <div className="row spread gap wrap">
              <div>
                <strong>{file.name}</strong>
                <p className="muted small">{file.path}</p>
              </div>
              <div className="row gap wrap alignCenter">
                <span className="pill">{file.kind}</span>
                <span className="muted small">{new Date(file.modifiedAt).toLocaleString()}</span>
              </div>
            </div>
            <pre className="jsonBlock">{file.preview}</pre>
          </article>
        ))}
      </div>
    </section>
  );
}
