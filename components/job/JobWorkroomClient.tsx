'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { Job, User, Application, Message } from '@/lib/types';
import { formatUsdc, shortenAddress } from '@/lib/utils/format';
import { 
  Shield, Scale, Clock, MessageSquare, ExternalLink, Loader2, 
  Send, AlertTriangle, CheckCircle, FileText, Landmark
} from 'lucide-react';
import { ApplyDialog } from './ApplyDialog';


interface JobWorkroomClientProps {
  job: Job;
  currentUserSession: any; // SessionPayload | null
  isClient: boolean;
  isFreelancer: boolean;
}

export function JobWorkroomClient({ job: initialJob, currentUserSession, isClient, isFreelancer }: JobWorkroomClientProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const [job, setJob] = useState<Job>(initialJob);
  const [messages, setMessages] = useState<Message[]>(initialJob.messages || []);
  const [newMessage, setNewMessage] = useState('');
  
  // Modals & Forms State
  const [acceptingApp, setAcceptingApp] = useState<Application | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [deliverableNotes, setDeliverableNotes] = useState('');

  // General Loading States
  const [actionLoading, setActionLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // Setup Realtime Chat Subscription
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to refetch messages:', err);
      }
    };

    const channel = supabase
      .channel(`job:${job.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${job.id}` },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [job.id, supabase]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserSession) return;
    
    setChatLoading(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      setNewMessage('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setChatLoading(false);
    }
  };

  const handleAcceptApplication = async () => {
    if (!acceptingApp) return;
    setActionLoading(true);
    toast.loading('Accepting sample application…', { id: 'escrow' });

    try {
      const res = await fetch(`/api/jobs/${job.id}/accept-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: acceptingApp.id,
          freelancerId: acceptingApp.freelancer_id,
        }),
      });

      if (!res.ok) {
        throw new Error('Sample application update failed.');
      }

      toast.success('Sample application accepted.', { id: 'escrow' });
      setAcceptingApp(null);
      
      // Refresh local page state
      const updatedJob = await res.json();
      setJob({
        ...job,
        freelancer_id: updatedJob.freelancer_id,
        status: updatedJob.status,
      });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Escrow creation failed', { id: 'escrow' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverableUrl) {
      toast.error('Please enter a deliverable URL (e.g. GitHub repo link)');
      return;
    }

    setActionLoading(true);
    toast.loading('Saving sample delivery…', { id: 'deliverable' });

    try {
      const res = await fetch(`/api/jobs/${job.id}/submit-deliverable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverableUrl, deliverableNotes }),
      });

      if (!res.ok) {
        throw new Error('Sample delivery could not be saved.');
      }

      toast.success('Deliverables successfully submitted to client!', { id: 'deliverable' });
      
      const updatedJob = await res.json();
      setJob({
        ...job,
        deliverable_url: updatedJob.deliverable_url,
        deliverable_notes: updatedJob.deliverable_notes,
        status: updatedJob.status,
      });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Deliverable submission failed', { id: 'deliverable' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveEscrow = async () => {
    if (!confirm('Approve this delivery in the sample workroom?')) return;
    
    setActionLoading(true);
    toast.loading('Saving sample approval…', { id: 'release' });

    try {
      const res = await fetch(`/api/jobs/${job.id}/approve`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Sample approval could not be saved.');
      }

      toast.success('Sample job marked approved.', { id: 'release' });
      
      const updatedJob = await res.json();
      setJob({
        ...job,
        status: updatedJob.status,
      });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Approve escrow failed', { id: 'release' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisputeEscrow = async () => {
    if (!disputeReason || disputeReason.length < 10) {
      toast.error('Please enter a detailed reason for the dispute.');
      return;
    }

    setActionLoading(true);
    toast.loading('Saving sample dispute…', { id: 'dispute' });

    try {
      const res = await fetch(`/api/jobs/${job.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason }),
      });

      if (!res.ok) {
        throw new Error('Sample dispute could not be saved.');
      }

      const updatedJob = await res.json();
      setJob({ ...job, status: updatedJob.status });
      setDisputeModalOpen(false);
      toast.success('Sample dispute recorded', { id: 'dispute' });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Dispute filing failed', { id: 'dispute' });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Looking for Freelancer';
      case 'in_progress': return 'In Progress';
      case 'submitted': return 'Awaiting Review';
      case 'approved': return 'Released & Approved';
      case 'disputed': return 'Sample dispute';
      case 'resolved': return 'Sample resolved';
      case 'refunded': return 'Refunded';
      default: return status;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
              {job.category}
            </span>
            <Badge className="bg-blue-100 text-blue-700 font-bold hover:bg-blue-100 border-none">
              {getStatusLabel(job.status)}
            </Badge>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">{job.title}</h1>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>Deadline: {new Date(job.deadline).toLocaleString()}</span>
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sample Budget</span>
          <span className="text-3xl font-extrabold text-slate-800 font-mono">
            ${formatUsdc(job.amount_usdc * 1000000)} <span className="text-xs font-semibold text-slate-500 font-sans">USDC</span>
          </span>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (Details) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="p-6 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-800">Milestone Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Task Scope</span>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{job.description}</p>
              </div>

              <div className="space-y-1.5 pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Verification Criteria</span>
                <pre className="text-xs bg-slate-50 border border-slate-100 p-3 rounded-lg text-slate-700 whitespace-pre-wrap font-mono leading-relaxed mt-1">
                  {job.criteria}
                </pre>
              </div>

              {(job.status === 'submitted' || job.status === 'approved' || job.status === 'disputed' || job.status === 'resolved') && job.deliverable_url && (
                <div className="space-y-2 pt-4 border-t border-slate-100 bg-emerald-50/20 p-3 rounded-lg border border-emerald-100/50 mt-4">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> Freelancer Submission
                  </span>
                  <div className="text-xs space-y-2">
                    <div>
                      <span className="font-semibold text-slate-500 block">Deliverable URL:</span>
                      <a href={job.deliverable_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 font-bold hover:underline break-all inline-flex items-center gap-1">
                        {job.deliverable_url} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {job.deliverable_notes && (
                      <div>
                        <span className="font-semibold text-slate-500 block">Notes:</span>
                        <p className="text-slate-600 italic whitespace-pre-wrap">{job.deliverable_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Actions & Chat) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Action Panel */}
          <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wide">Workroom Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <p className="mb-3 text-xs text-slate-600">These actions update local sample data. For a signed transaction, open the Hadrian workroom.</p>
              <a href="/rome" className="mb-4 block text-sm font-semibold text-blue-700 underline">Open Hadrian Workroom</a>
              {/* Client / Open */}
              {isClient && job.status === 'open' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Received Proposals</h4>
                  {job.applications && job.applications.length > 0 ? (
                    <div className="space-y-3">
                      {job.applications.map((app) => (
                        <div key={app.id} className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700 font-bold">
                                  {app.freelancer?.email.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-semibold text-slate-700">
                                {app.freelancer?.display_name || app.freelancer?.email.split('@')[0]}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-slate-800 font-mono">
                              ${app.proposed_amount || job.amount_usdc} USDC
                            </span>
                          </div>
                          {app.cover_letter && (
                            <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed bg-white border border-slate-100 p-1.5 rounded italic">
                              "{app.cover_letter}"
                            </p>
                          )}
                          <Button
                            onClick={() => setAcceptingApp(app)}
                            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-1.5 rounded text-xs"
                            disabled={actionLoading}
                          >
                            Accept Sample Application
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No proposals submitted yet.</p>
                  )}
                </div>
              )}

              {/* Freelancer / Open */}
              {!isClient && job.status === 'open' && (
                <div className="space-y-3">
                  {currentUserSession ? (
                    // Check if already applied
                    job.applications?.some(a => a.freelancer_id === currentUserSession.user_id) ? (
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-center space-y-2">
                        <Clock className="mx-auto h-5 w-5 text-slate-400" />
                        <h4 className="text-xs font-bold text-slate-700 uppercase">Application Pending</h4>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          Your proposal has been submitted to the client. You will be notified in the chat once selected.
                        </p>
                      </div>
                    ) : (
                      <ApplyDialog
                        jobId={job.id}
                        defaultAmount={job.amount_usdc}
                        trigger={
                          <Button className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 rounded-lg">
                            Apply to Contract
                          </Button>
                        }
                      />
                    )
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-center space-y-2">
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Please sign up or authenticate to apply to this job.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Client / InProgress */}
              {isClient && job.status === 'in_progress' && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-center space-y-2">
                  <Clock className="mx-auto h-5 w-5 text-slate-400 animate-spin" />
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Job In Progress</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Waiting for the freelancer ({job.freelancer?.email}) to submit completed deliverables.
                  </p>
                </div>
              )}

              {/* Freelancer / InProgress */}
              {isFreelancer && job.status === 'in_progress' && (
                <form onSubmit={handleSubmitDeliverable} className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase block">Submit Deliverables</h4>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="delUrl" className="text-[10px] text-slate-500 uppercase font-semibold">Deliverable URL</Label>
                      <Input
                        id="delUrl"
                        type="url"
                        placeholder="https://github.com/your-username/repo"
                        className="text-xs text-slate-900 border-slate-200"
                        value={deliverableUrl}
                        onChange={(e) => setDeliverableUrl(e.target.value)}
                        disabled={actionLoading}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="delNotes" className="text-[10px] text-slate-500 uppercase font-semibold">Notes</Label>
                      <Textarea
                        id="delNotes"
                        placeholder="Detail the work done, and explain how each verification criteria was met..."
                        className="text-xs text-slate-900 border-slate-200"
                        rows={4}
                        value={deliverableNotes}
                        onChange={(e) => setDeliverableNotes(e.target.value)}
                        disabled={actionLoading}
                      />
                    </div>
                    <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs py-2 rounded" disabled={actionLoading}>
                      {actionLoading ? 'Submitting...' : 'Register Submission'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Client / Submitted */}
              {isClient && job.status === 'submitted' && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-xs leading-normal">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-600 block mb-1" />
                    <strong>Milestone Delivered!</strong> Review the sample submission and record approval or a dispute.
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button 
                      onClick={handleApproveEscrow}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded"
                      disabled={actionLoading}
                    >
                      Approve Sample Delivery
                    </Button>
                    <Button 
                      onClick={() => setDisputeModalOpen(true)}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 rounded"
                      disabled={actionLoading}
                    >
                      File Dispute
                    </Button>
                  </div>
                </div>
              )}

              {/* Freelancer / Submitted */}
              {isFreelancer && job.status === 'submitted' && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-center space-y-2">
                  <Clock className="mx-auto h-5 w-5 text-slate-400 animate-pulse" />
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Under Client Review</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    The sample delivery is awaiting client review.
                  </p>
                </div>
              )}

              {/* Both / Disputed */}
              {job.status === 'disputed' && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg text-center space-y-3">
                  <Scale className="mx-auto h-6 w-6 text-orange-500 animate-bounce" />
                  <h4 className="text-xs font-bold text-orange-700 uppercase">Sample Dispute Recorded</h4>
                  <p className="text-[10px] text-slate-600 leading-normal">
                    The client recorded a dispute in the sample workroom.
                  </p>
                </div>
              )}

              {/* Both / Approved */}
              {job.status === 'approved' && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg text-center space-y-2">
                  <CheckCircle className="mx-auto h-6 w-6 text-emerald-600" />
                  <h4 className="text-xs font-bold text-emerald-700 uppercase font-extrabold">Milestone Approved</h4>
                  <p className="text-[10px] text-slate-600 leading-normal">
                    The client marked the sample project approved.
                  </p>
                </div>
              )}

              {/* Both / Resolved */}
              {job.status === 'resolved' && (
                <div className="bg-slate-100 border border-slate-200 p-4 rounded-lg text-center space-y-2">
                  <Landmark className="mx-auto h-6 w-6 text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-700 uppercase font-extrabold">Sample Case Resolved</h4>
                  <p className="text-[10px] text-slate-600 leading-normal">
                    The sample case has a resolved status.
                  </p>
                </div>
              )}

              {/* Other/Unassigned/Closed states */}
              {!isClient && !isFreelancer && job.status !== 'open' && (
                <p className="text-xs text-slate-400 italic text-center">
                  This workroom is closed or private.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Chat Workspace Panel */}
          {currentUserSession && (isClient || isFreelancer) && (
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl h-[400px] flex flex-col justify-between overflow-hidden">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-700" />
                <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">Workroom Chat</CardTitle>
              </CardHeader>
              
              {/* Chat Log */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center pt-8">No messages. Say hello to start collaborating!</p>
                ) : (
                  messages.map((msg) => {
                    const isSender = msg.sender_id === currentUserSession.user_id;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] text-slate-400 font-semibold">
                            {msg.sender?.display_name || msg.sender?.email.split('@')[0]}
                          </span>
                        </div>
                        <div className={`p-2.5 rounded-lg text-xs leading-normal max-w-[85%] break-words ${
                          isSender 
                            ? 'bg-blue-700 text-white rounded-tr-none' 
                            : 'bg-slate-100 text-slate-700 rounded-tl-none'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 bg-slate-50/50 flex gap-2">
                <Input
                  type="text"
                  placeholder="Type a message..."
                  className="text-xs text-slate-900 border-slate-200 bg-white"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={chatLoading}
                />
                <Button type="submit" size="icon" className="bg-blue-700 hover:bg-blue-800 text-white shrink-0" disabled={chatLoading}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>

      {/* 2. Escrow Confirmation Modal */}
      {acceptingApp && (
        <Dialog open={!!acceptingApp} onOpenChange={() => setAcceptingApp(null)}>
          <DialogContent className="sm:max-w-md bg-white rounded-lg">
            <DialogHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-2">
                <Landmark className="h-6 w-6 text-blue-700" />
              </div>
              <DialogTitle className="text-center text-lg font-bold text-slate-900">Lock Milestone Budget</DialogTitle>
              <DialogDescription className="text-center text-slate-500 text-xs">
                You are about to accept this sample application.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-3 text-xs leading-relaxed border-t border-slate-100">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-slate-400 block uppercase text-[9px]">Freelancer</span>
                  <span className="font-bold text-slate-700">
                    {acceptingApp.freelancer?.display_name || acceptingApp.freelancer?.email.split('@')[0]}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block uppercase text-[9px]">USDC Wallet</span>
                  <span className="font-mono text-slate-700 truncate max-w-[150px] block">
                    {acceptingApp.freelancer?.wallet_address}
                  </span>
                </div>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block uppercase text-[9px]">Funding budget</span>
                <span className="text-xl font-extrabold text-slate-800 font-mono">
                  ${formatUsdc((acceptingApp.proposed_amount || job.amount_usdc) * 1000000)} <span className="text-xs font-semibold text-slate-500 font-sans">USDC</span>
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  This budget belongs to the sample job.
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100">
              <Button
                variant="ghost"
                className="border border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={() => setAcceptingApp(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAcceptApplication}
                className="bg-blue-700 hover:bg-blue-800 text-white font-semibold"
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving…' : 'Confirm Sample Acceptance'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 3. Dispute Case Modal */}
      <Dialog open={disputeModalOpen} onOpenChange={setDisputeModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-lg">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-slate-900">Open Dispute Case</DialogTitle>
            <DialogDescription className="text-center text-slate-500 text-xs">
              Record a dispute in the local sample workroom.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-xs">
            <div className="space-y-1">
              <Label htmlFor="disputeReason" className="font-bold text-slate-700 uppercase block text-[10px]">
                Detailed Reason for Dispute
              </Label>
              <Textarea
                id="disputeReason"
                placeholder="Describe how the deliverables failed to meet the verification criteria, detailing specific missing items or errors..."
                rows={5}
                className="text-slate-900 border-slate-200 text-xs"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                disabled={actionLoading}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100">
            <Button
              variant="ghost"
              className="border border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => setDisputeModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDisputeEscrow}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              disabled={actionLoading}
            >
              {actionLoading ? 'Filing dispute...' : 'File Dispute Case'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
