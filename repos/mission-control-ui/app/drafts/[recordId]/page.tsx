import { notFound } from 'next/navigation';
import { updateDraftAction } from '../../actions';
import { getReviewRecord } from '../../../lib/data';

export default async function DraftDetailPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const record = await getReviewRecord(recordId);

  if (!record) notFound();

  return (
    <section className="stackLg">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Draft detail</p>
          <h2>{record.record_id}</h2>
        </div>
        <span className="status draft">{record.status}</span>
      </div>

      <div className="twoCol">
        <article className="card stack">
          <div>
            <span className="label">Draft text</span>
            <pre className="postBody">{record.draft.post}</pre>
          </div>
          <div className="metaGrid">
            <div>
              <span className="label">Inspiration</span>
              <p>{record.draft.inspiration_source || '—'}</p>
            </div>
            <div>
              <span className="label">Mechanic</span>
              <p>{record.draft.mechanic_applied || '—'}</p>
            </div>
            <div>
              <span className="label">Vibe score</span>
              <p>{record.draft.vibe_score ?? '—'}</p>
            </div>
          </div>
          <div>
            <span className="label">Why it fits</span>
            <p>{record.draft.why_it_fits || '—'}</p>
          </div>
        </article>

        <aside className="stack">
          <section className="card stack">
            <div>
              <span className="label">Source metadata</span>
              <p>{record.source.date} · draft #{record.source.draft_id}</p>
              <p className="muted small">{record.source.package_path}</p>
            </div>
            <div>
              <span className="label">Vibe reference</span>
              <p>{record.source.vibe_reference || '—'}</p>
            </div>
            <div>
              <span className="label">Bundle</span>
              <pre className="jsonBlock">{JSON.stringify(record.source.source_bundle || {}, null, 2)}</pre>
            </div>
          </section>

          <section className="card stack">
            <div>
              <span className="label">Review</span>
              <p>{record.review?.latest_feedback || 'No feedback yet.'}</p>
              <p className="muted small">
                {record.review?.latest_reviewer || '—'} · {record.review?.latest_action_at || '—'}
              </p>
            </div>

            <form action={updateDraftAction} className="stack">
              <input type="hidden" name="recordId" value={record.record_id} />
              <input type="hidden" name="reviewer" value="mission-control-ui" />
              <label className="stackXs">
                <span className="label">Feedback</span>
                <textarea name="feedback" rows={5} placeholder="Optional reviewer note" className="input" />
              </label>
              <div className="row gap wrap">
                <button className="button success" type="submit" name="action" value="approve">
                  Approve
                </button>
                <button className="button warn" type="submit" name="action" value="revise">
                  Needs revision
                </button>
                <button className="button danger" type="submit" name="action" value="reject">
                  Reject
                </button>
              </div>
            </form>
          </section>
        </aside>
      </div>

      <section className="card stack">
        <div className="row spread">
          <span className="label">History</span>
          <span className="muted small">{(record.history || []).length} events</span>
        </div>
        <div className="stack">
          {(record.history || []).slice().reverse().map((entry, index) => (
            <div key={`${entry.at}-${index}`} className="historyItem">
              <div className="row spread gap">
                <strong>{entry.action}</strong>
                <span className="muted small">{entry.at}</span>
              </div>
              <p className="muted small">{entry.status} · {entry.reviewer || '—'}</p>
              {entry.feedback ? <p>{entry.feedback}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
