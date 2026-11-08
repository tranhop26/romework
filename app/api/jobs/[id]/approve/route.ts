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
      return NextResponse.json({ message: 'Not authorized to approve this job' }, { status: 403 });
    }

    // Update job status in DB to approved
    const { data: updatedJob, error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ message: 'Failed to update job status', error: updateError.message }, { status: 500 });
    }

    // Increment freelancer jobs completed count
    if (job.freelancer_id) {
      const { data: freelancerUser } = await supabase
        .from('users')
        .select('jobs_completed, reputation_score')
        .eq('id', job.freelancer_id)
        .single();

      if (freelancerUser) {
        await supabase
          .from('users')
          .update({
            jobs_completed: (freelancerUser.jobs_completed || 0) + 1,
            reputation_score: Math.min((freelancerUser.reputation_score || 0) + 50, 1000), // add reputation points
          })
          .eq('id', job.freelancer_id);
      }
    }

    return NextResponse.json({ ...updatedJob, simulation: true, chainSettlement: false });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Internal server error' }, { status: 500 });
  }
}
