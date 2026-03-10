export type IndexItem = {
  record_id: string;
  source_date: string;
  draft_id: number;
  status: string;
  updated_at: string;
  inspiration_source: string;
  mechanic_applied: string;
  preview: string;
  queued_path: string | null;
  scheduled_at_iso: string | null;
};

export type ReviewRecord = {
  record_id: string;
  source: {
    date: string;
    draft_id: number;
    package_path: string;
    markdown_path?: string;
    vibe_reference?: string;
    summary?: Record<string, unknown>;
    source_mix?: Record<string, unknown>;
    source_bundle?: {
      curated_feed_path?: string;
      vibe_reference_path?: string;
      inspiration_paths?: Record<string, string>;
    };
  };
  draft: {
    post: string;
    inspiration_source?: string;
    inspiration_url?: string;
    mechanic_applied?: string;
    vibe_score?: number;
    why_it_fits?: string;
  };
  status: string;
  created_at: string;
  updated_at: string;
  review?: {
    latest_feedback?: string | null;
    latest_reviewer?: string | null;
    latest_action_at?: string | null;
  };
  postpone?: {
    queued_path?: string | null;
    queued_at?: string | null;
    scheduled_at_iso?: string | null;
    postpone_response?: unknown;
  };
  history?: Array<{
    at: string;
    action: string;
    status: string;
    reviewer?: string;
    feedback?: string;
  }>;
};

export type SourceFile = {
  name: string;
  path: string;
  kind: 'curated_feed' | 'target_scrape' | 'vibe_reference' | 'other';
  modifiedAt: string;
  preview: string;
};

export type QueueFile = {
  name: string;
  path: string;
  modifiedAt: string;
  preview: string;
};
