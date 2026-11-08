'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Calendar, DollarSign, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { JOB_CATEGORIES } from '@/lib/constants';

export default function NewJobPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('basics');
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState('');
  const [deadline, setDeadline] = useState('');
  const [amountUsdc, setAmountUsdc] = useState('');

  const handleNextTab = (current: string, next: string) => {
    // Basic validation
    if (current === 'basics') {
      if (!title || title.length < 10) {
        toast.error('Title must be at least 10 characters long.');
        return;
      }
      if (!category) {
        toast.error('Please select a category.');
        return;
      }
      if (!description || description.length < 50) {
        toast.error('Description must be at least 50 characters long.');
        return;
      }
    } else if (current === 'criteria') {
      if (!criteria || criteria.length < 20) {
        toast.error('Success criteria must be at least 20 characters long.');
        return;
      }
    } else if (current === 'budget') {
      const amt = parseFloat(amountUsdc);
      if (isNaN(amt) || amt < 10) {
        toast.error('Milestone budget must be at least 10 USDC.');
        return;
      }
      if (!deadline) {
        toast.error('Please select a deadline.');
        return;
      }
      const deadDate = new Date(deadline);
      if (deadDate.getTime() <= Date.now()) {
        toast.error('Deadline must be in the future.');
        return;
      }
    }
    setActiveTab(next);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          criteria,
          category,
          amount_usdc: parseFloat(amountUsdc),
          deadline: new Date(deadline).toISOString(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.message || 'Failed to publish job listing.');
      }

      const newJob = await res.json();
      toast.success('Job listing published successfully!');
      router.push(`/jobs/${newJob.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish job listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Job Milestone</h1>
        <p className="text-slate-500 text-sm mt-1">
          Specify requirements and a budget for a sample job.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="basics" className="rounded-md py-1.5 text-xs font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
            1. Basics
          </TabsTrigger>
          <TabsTrigger value="criteria" className="rounded-md py-1.5 text-xs font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm" disabled={!title || !category || !description}>
            2. Criteria
          </TabsTrigger>
          <TabsTrigger value="budget" className="rounded-md py-1.5 text-xs font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm" disabled={!criteria}>
            3. Budget
          </TabsTrigger>
          <TabsTrigger value="review" className="rounded-md py-1.5 text-xs font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm" disabled={!amountUsdc || !deadline}>
            4. Review
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Basics */}
        <TabsContent value="basics">
          <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-800">Job Basics</CardTitle>
              <CardDescription className="text-slate-500 text-xs">Outline the main objectives and description of the project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-700">Project Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Design responsive Landing Page mockup"
                  className="text-slate-900 border-slate-200"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-slate-700">Category</Label>
                <Select value={category} onValueChange={(val) => setCategory(val || '')}>
                  <SelectTrigger className="text-slate-900 border-slate-200 bg-white">
                    <SelectValue placeholder="Select work category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-slate-200 rounded-lg">
                    {JOB_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-700">Detailed Description</Label>
                <Textarea
                  id="description"
                  rows={6}
                  placeholder="Outline the detailed background, goals, technology requirements, and deliverables..."
                  className="text-slate-900 border-slate-200 leading-relaxed text-xs"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => handleNextTab('basics', 'criteria')} className="bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1">
                  Next Step <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Criteria */}
        <TabsContent value="criteria">
          <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-800">Success Criteria</CardTitle>
              <CardDescription className="text-slate-500 text-xs">Define a sample milestone and its verification criteria.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="criteria" className="text-slate-700">Milestone Criteria</Label>
                <Textarea
                  id="criteria"
                  rows={8}
                  placeholder="e.g.&#10;• Provide source Figma files with auto-layouts.&#10;• 3 distinct header variations.&#10;• Fully responsive layout designed for mobile, tablet, and desktop."
                  className="text-slate-900 border-slate-200 leading-relaxed text-xs font-mono"
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" className="border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1" onClick={() => setActiveTab('basics')}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={() => handleNextTab('criteria', 'budget')} className="bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1">
                  Next Step <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Timeline & Budget */}
        <TabsContent value="budget">
          <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-800">Timeline &amp; Budget</CardTitle>
              <CardDescription className="text-slate-500 text-xs">Set the sample project deadline and milestone budget.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-slate-700">Project Budget (USDC)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
                  <Input
                    id="amount"
                    type="number"
                    min={10}
                    placeholder="100"
                    className="pl-9 text-slate-900 border-slate-200 font-mono"
                    value={amountUsdc}
                    onChange={(e) => setAmountUsdc(e.target.value)}
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Freelancer receives: ${(parseFloat(amountUsdc || '0') * 0.98).toFixed(2)} USDC (after 2% platform fee)
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline" className="text-slate-700">Project Deadline</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
                  <Input
                    id="deadline"
                    type="datetime-local"
                    className="pl-9 text-slate-900 border-slate-200 font-mono"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" className="border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1" onClick={() => setActiveTab('criteria')}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={() => handleNextTab('budget', 'review')} className="bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1">
                  Next Step <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Review & Confirm */}
        <TabsContent value="review">
          <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-800">Review &amp; Confirm</CardTitle>
              <CardDescription className="text-slate-500 text-xs">Verify your listing details before publishing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="divide-y divide-slate-100 space-y-4">
                <div className="pt-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Title</span>
                  <span className="text-sm font-semibold text-slate-800">{title}</span>
                </div>
                <div className="pt-4">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Category</span>
                  <span className="text-xs font-semibold text-slate-700 capitalize">
                    {JOB_CATEGORIES.find(c => c.value === category)?.label || category}
                  </span>
                </div>
                <div className="pt-4">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Budget Summary</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-extrabold text-slate-800 font-mono">${amountUsdc} USDC</span>
                    <span className="text-xs text-slate-500">(After Fee: ${(parseFloat(amountUsdc || '0') * 0.98).toFixed(2)} USDC)</span>
                  </div>
                </div>
                <div className="pt-4">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Deadline</span>
                  <span className="text-xs font-mono font-semibold text-slate-700">
                    {deadline ? new Date(deadline).toLocaleString() : ''}
                  </span>
                </div>
                <div className="pt-4">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Success Criteria</span>
                  <pre className="text-[11px] font-mono leading-relaxed bg-slate-50 border border-slate-100 p-3 rounded-lg text-slate-700 whitespace-pre-wrap mt-1">
                    {criteria}
                  </pre>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" className="border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1" onClick={() => setActiveTab('budget')} disabled={loading}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold flex items-center gap-1.5"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Publishing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Publish Listing
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
