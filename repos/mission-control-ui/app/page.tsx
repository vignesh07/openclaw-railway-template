import Link from 'next/link';
import { getIndexItems } from '../lib/data';

function statusClass(status: string) {
  if (status === 'approved') return 'status approved';
  if (status === 'rejected') return 'status rejected';
  if (status === 'revise') return 'status revise';
  return 'status draft';
}

export default async function InboxPage() {
  const items = await getIndexItems();

  return (
    <section>
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>Drafts</h2>
        </div>
        <p className="muted">{items.length} total drafts</p>
      </div>

      <div className="stack">
        {items.map((item) => (
          <Link href={`/drafts/${item.record_id}`} key={item.record_id} className="card cardLink">
            <div className="row spread gap">
              <div>
                <div className="row gap wrap">
                  <strong>{item.record_id}</strong>
                  <span className={statusClass(item.status)}>{item.status}</span>
                </div>
                <p className="muted small">{item.source_date} · draft #{item.draft_id}</p>
              </div>
              <p className="muted small">Updated {new Date(item.updated_at).toLocaleString()}</p>
            </div>
            <p>{item.preview}</p>
            <div className="metaGrid">
              <div>
                <span className="label">Source</span>
                <p>{item.inspiration_source}</p>
              </div>
              <div>
                <span className="label">Mechanic</span>
                <p>{item.mechanic_applied}</p>
              </div>
              <div>
                <span className="label">Queue</span>
                <p>{item.queued_path || 'Not queued'}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
