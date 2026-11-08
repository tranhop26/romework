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

    const { applicationId, freelancerId } = await request.json();

    if (!applicationId || !freelancerId) {
      return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 });
    }

    if (!session.email.endsWith('@demo.freelanceguard.app')) {
      return NextResponse.json({ code: 'ROME_EXTENSION_REQUIRED', message: 'Use the Hadrian workroom for signed actions.' }, { status: 410 });
    }
    const supabase = createAdminClient();

    // Verify current user is the client who posted the job
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('client_id')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 });
    }

    if (job.client_id !== session.user_id) {
      return NextResponse.json({ message: 'Not authorized to accept applications for this job' }, { status: 403 });
    }

    // Begin updates in Supabase
    // 1. Accept the selected application
    const { error: appUpdateError } = await supabase
      .from('applications')
      .update({ status: 'accepted' })
      .eq('id', applicationId)
      .eq('job_id', jobId)
      .eq('freelancer_id', freelancerId)
      .select('id')
      .single();

    if (appUpdateError) {
      return NextResponse.json({ message: 'Failed to accept application', error: appUpdateError.message }, { status: 500 });
    }

    // 2. Reject all other applications for this job
    await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('job_id', jobId)
      .neq('id', applicationId);

    // Record the selected freelancer in the demo database.
    const { data: updatedJob, error: jobUpdateError } = await supabase
      .from('jobs')
      .update({
        freelancer_id: freelancerId,
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('*')
      .single();

    if (jobUpdateError) {
      return NextResponse.json({ message: 'Failed to update job', error: jobUpdateError.message }, { status: 500 });
    }

    // 4. Update the client's total posted jobs count
    const { data: clientUser } = await supabase
      .from('users')
      .select('jobs_posted')
      .eq('id', session.user_id)
      .single();

    if (clientUser) {
      await supabase
        .from('users')
        .update({ jobs_posted: (clientUser.jobs_posted || 0) + 1 })
        .eq('id', session.user_id);
    }

    return NextResponse.json({ ...updatedJob, simulation: true, chainSettlement: false });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Internal server error' }, { status: 500 });
  }
}
