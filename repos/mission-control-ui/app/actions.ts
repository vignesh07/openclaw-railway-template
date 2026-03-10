'use server';

import { revalidatePath } from 'next/cache';
import { updateReviewStatus } from '../lib/data';

export async function updateDraftAction(formData: FormData) {
  const recordId = String(formData.get('recordId') || '');
  const action = String(formData.get('action') || '') as 'approve' | 'revise' | 'reject';
  const feedback = String(formData.get('feedback') || '');
  const reviewer = String(formData.get('reviewer') || 'mission-control-ui');

  if (!recordId || !['approve', 'revise', 'reject'].includes(action)) {
    throw new Error('Invalid draft action payload');
  }

  await updateReviewStatus({ recordId, action, feedback, reviewer });
  revalidatePath('/');
  revalidatePath(`/drafts/${recordId}`);
  revalidatePath('/queue');
}
