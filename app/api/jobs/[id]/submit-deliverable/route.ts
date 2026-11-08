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

    const { deliverableUrl, deliverableNotes } = await request.json();

    if (!deliverableUrl) {
      return NextResponse.json({ message: 'Deliverable URL is required' }, { status: 400 });
    }

    if (!session.email.endsWith('@demo.freelanceguard.app')) {
      return NextResponse.json({ code: 'ROME_EXTENSION_REQUIRED', message: 'Use the Hadrian workroom for signed actions.' }, { status: 410 });
    }
    const supabase = createAdminClient();

    // Verify current user is the freelancer for this job
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('freelancer_id')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 });
    }

    if (job.freelancer_id !== session.user_id) {
      return NextResponse.json({ message: 'Not authorized to submit deliverables for this job' }, { status: 403 });
    }

    // Update job status and deliverable details
    const { data: updatedJob, error: updateError } = await supabase
      .from('jobs')
      .update({
        deliverable_url: deliverableUrl,
        deliverable_notes: deliverableNotes || '',
        status: 'submitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ message: 'Failed to submit deliverable', error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ...updatedJob, simulation: true, chainSettlement: false });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Internal server error' }, { status: 500 });
  }
}
