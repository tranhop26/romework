'use client';

import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JobCard } from '@/components/job/JobCard';
import { User, Job } from '@/lib/types';
import { formatUsdc } from '@/lib/utils/format';
import { PlusCircle, Search, ClipboardList, Briefcase, Award, TrendingUp, Sparkles } from 'lucide-react';

// Wait, let's verify tabs import path. Yes, shadcn tabs is:
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DashboardClientProps {
  profile: User;
  initialClientJobs: Job[];
  initialFreelancerJobs: Job[];
}

export function DashboardClient({ profile, initialClientJobs, initialFreelancerJobs }: DashboardClientProps) {
  const clientJobs = initialClientJobs;
  const freelancerJobs = initialFreelancerJobs;

  // Client Stats
  const activeClientJobsCount = clientJobs.filter(j => ['open', 'in_progress', 'submitted', 'disputed'].includes(j.status)).length;
  const totalSpent = clientJobs
    .filter(j => ['approved', 'resolved'].includes(j.status))
    .reduce((sum, j) => sum + Number(j.amount_usdc), 0);

  // Freelancer Stats
  const activeFreelancerJobsCount = freelancerJobs.filter(j => ['in_progress', 'submitted', 'disputed'].includes(j.status)).length;
  const totalEarned = freelancerJobs
    .filter(j => ['approved', 'resolved'].includes(j.status))
    .reduce((sum, j) => sum + Number(j.amount_usdc), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header welcome */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Welcome back, {profile.display_name || profile.email.split('@')[0]}</span>
            <Sparkles className="h-5 w-5 text-blue-700 animate-pulse" />
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Browse sample workrooms, budgets and profiles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/jobs/browse">
            <Button variant="outline" className="border-slate-200 bg-white hover:bg-slate-50 text-slate-800 flex items-center gap-1.5">
              <Search className="h-4 w-4" />
              Browse Jobs
            </Button>
          </Link>
          {(profile.role === 'client' || profile.role === 'both') && (
            <Link href="/jobs/new">
              <Button className="bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4" />
                Post New Job
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase block">Active Projects</span>
              <span className="text-2xl font-extrabold text-slate-800">
                {profile.role === 'client' && activeClientJobsCount}
                {profile.role === 'freelancer' && activeFreelancerJobsCount}
                {profile.role === 'both' && (activeClientJobsCount + activeFreelancerJobsCount)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase block">
                {profile.role === 'client' ? 'Sample Budget Total' : 'Sample Earnings'}
              </span>
              <span className="text-2xl font-extrabold text-slate-800 font-mono">
                {profile.role === 'client' && `$${formatUsdc(totalSpent * 1000000)}`}
                {profile.role === 'freelancer' && `$${formatUsdc(totalEarned * 1000000)}`}
                {profile.role === 'both' && `$${formatUsdc((totalSpent + totalEarned) * 1000000)}`}
                <span className="text-xs font-semibold text-slate-500 font-sans ml-1">USDC</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase block">Reputation Score</span>
              <span className="text-2xl font-extrabold text-slate-800">
                {profile.reputation_score}/1000
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs list */}
      <div className="space-y-6">
        <Tabs key={profile.id} defaultValue={profile.role === 'freelancer' ? 'freelancer' : 'client'} className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2 bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="client" className="rounded-md py-1.5 text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
              As Client
            </TabsTrigger>
            <TabsTrigger value="freelancer" className="rounded-md py-1.5 text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
              As Freelancer
            </TabsTrigger>
          </TabsList>

          {/* Client Tab Content */}
          <TabsContent value="client" className="mt-6">
            {clientJobs.length === 0 ? (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                <ClipboardList className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="text-lg font-bold text-slate-800">No jobs posted yet</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  Post a sample milestone with a budget and acceptance criteria.
                </p>
                {(profile.role === 'client' || profile.role === 'both') && (
                  <Link href="/jobs/new">
                    <Button className="bg-blue-700 hover:bg-blue-800 text-white font-semibold">
                      Create Your First Job
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clientJobs.map(job => (
                  <JobCard key={job.id} job={job} viewerRole="client" />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Freelancer Tab Content */}
          <TabsContent value="freelancer" className="mt-6">
            {freelancerJobs.length === 0 ? (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                <ClipboardList className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="text-lg font-bold text-slate-800">No workrooms active</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  Explore sample contracts, submissions and profiles.
                </p>
                <Link href="/jobs/browse">
                  <Button className="bg-blue-700 hover:bg-blue-800 text-white font-semibold">
                    Browse Open Contracts
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {freelancerJobs.map(job => (
                  <JobCard key={job.id} job={job} viewerRole="freelancer" />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
