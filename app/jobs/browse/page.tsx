'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JobCard } from '@/components/job/JobCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { JOB_CATEGORIES } from '@/lib/constants';
import { Job } from '@/lib/types';
import { Search, SlidersHorizontal, ArrowUpDown, HelpCircle } from 'lucide-react';

export default function BrowseJobsPage() {
  // Filter states
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sort, setSort] = useState('latest');

  // React Query to fetch matching jobs
  const { data: jobs, isLoading, error, refetch } = useQuery<Job[]>({
    queryKey: ['browseJobs', { search, category, minAmount, maxAmount, sort }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category && category !== 'all') params.append('category', category);
      if (minAmount) params.append('minAmount', minAmount);
      if (maxAmount) params.append('maxAmount', maxAmount);
      params.append('sort', sort);

      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load jobs list');
      }
      return await res.json();
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  const handleClearFilters = () => {
    setSearch('');
    setCategory('all');
    setMinAmount('');
    setMaxAmount('');
    setSort('latest');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Open Work Contracts</h1>
        <p className="text-slate-500 text-sm mt-1">
          Explore freelance listings and sample budgets in the local sandbox.
        </p>
      </div>

      {/* Filters Panel */}
      <form onSubmit={handleSearchSubmit} className="bg-white border border-slate-200 shadow-sm p-5 rounded-xl space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search contracts by title, keyword, tech stack..."
              className="pl-10 text-slate-900 border-slate-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 min-w-[200px]">
            <Select value={category} onValueChange={(val) => setCategory(val || 'all')}>
              <SelectTrigger className="text-slate-900 border-slate-200 bg-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 rounded-lg">
                <SelectItem value="all">All Categories</SelectItem>
                {JOB_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white font-medium px-6 py-2 rounded-md">
            Search
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold uppercase">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Budget Range (USDC)
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                className="w-20 text-xs font-mono py-1 px-2 border-slate-200 text-slate-900 h-8"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
              <span className="text-slate-400 text-xs font-semibold">-</span>
              <Input
                type="number"
                placeholder="Max"
                className="w-20 text-xs font-mono py-1 px-2 border-slate-200 text-slate-900 h-8"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort By
            </div>
            <Select value={sort} onValueChange={(val) => setSort(val || 'latest')}>
              <SelectTrigger className="w-[160px] text-slate-900 border-slate-200 bg-white h-8 text-xs py-1">
                <SelectValue placeholder="Sort order" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 rounded-lg text-xs">
                <SelectItem value="latest">Latest Listings</SelectItem>
                <SelectItem value="highest_paying">Highest Budget</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              className="text-xs text-slate-500 hover:text-slate-700 h-8"
              onClick={handleClearFilters}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </form>

      {/* Jobs Grid Listing */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border border-slate-200 shadow-sm rounded-xl h-64 flex flex-col justify-between p-5">
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/4 bg-slate-200" />
                <Skeleton className="h-6 w-3/4 bg-slate-200" />
                <Skeleton className="h-10 w-full bg-slate-200" />
              </div>
              <Skeleton className="h-8 w-full bg-slate-200" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 font-semibold">
          Failed to load job listings. Please try again.
        </div>
      ) : jobs && jobs.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <HelpCircle className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-800">No open contracts found</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Try adjusting your search query, selecting different categories, or removing budget filters.
          </p>
          <Button onClick={handleClearFilters} className="bg-blue-700 hover:bg-blue-800 text-white">
            Reset All Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs?.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
