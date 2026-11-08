import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { reason } = await request.json();

    if (!reason) {
      return NextResponse.json({ message: 'Dispute reason is required' }, { status: 400 });
    }

    if (!session.email.endsWith('@demo.freelanceguard.app')) {
      return NextResponse.json({ code: 'ROME_EXTENSION_REQUIRED', message: 'Use the Hadrian workroom for signed actions.' }, { status: 410 });
    }
    const supabase = createAdminClient();

    // Verify current user is the client for this job
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('client_id, freelancer_id')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 });
    }

    if (job.client_id !== session.user_id) {
      return NextResponse.json({ message: 'Not authorized to dispute this job' }, { status: 403 });
    }

    // Update job status and record dispute reason
    const { data: updatedJob, error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'disputed',
        dispute_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ message: 'Failed to update job status', error: updateError.message }, { status: 500 });
    }

    // Increment freelancer and client dispute counts
    if (job.freelancer_id) {
      const { data: freelancerUser } = await supabase
        .from('users')
        .select('disputes_count, reputation_score')
        .eq('id', job.freelancer_id)
        .single();

      if (freelancerUser) {
        await supabase
          .from('users')
          .update({
            disputes_count: (freelancerUser.disputes_count || 0) + 1,
            reputation_score: Math.max((freelancerUser.reputation_score || 0) - 20, 0), // penalize reputation slightly for dispute start
          })
          .eq('id', job.freelancer_id);
      }
    }

    const { data: clientUser } = await supabase
      .from('users')
      .select('disputes_count')
      .eq('id', session.user_id)
      .single();

    if (clientUser) {
      await supabase
        .from('users')
        .update({ disputes_count: (clientUser.disputes_count || 0) + 1 })
        .eq('id', session.user_id);
    }

    return NextResponse.json({ ...updatedJob, simulation: true, chainSettlement: false });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Internal server error' }, { status: 500 });
  }
}
