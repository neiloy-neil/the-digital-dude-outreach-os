'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import type { LeadsFiltersState } from './useSavedViews';

/**
 * All lead-list filter state (~21 fields) extracted from src/app/leads/page.tsx.
 * Row selection, pagination and visibleColumns stay page-level since they're
 * not filter inputs — see the Phase 4 componentization plan.
 */
export function useLeadsFilters(searchParams: ReadonlyURLSearchParams) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all');
  const [priorityFilter, setPriorityFilter] = useState(() => searchParams.get('priority') || 'all');
  const [aiStatusFilter, setAiStatusFilter] = useState(() => searchParams.get('aiStatus') || 'all');
  const [emailStatusFilter, setEmailStatusFilter] = useState(() => searchParams.get('emailStatus') || 'all');
  const [readinessFilter, setReadinessFilter] = useState(() => searchParams.get('readiness') || 'all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [leadListFilter, setLeadListFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState(() => searchParams.get('industry') || '');
  const [countryFilter, setCountryFilter] = useState(() => searchParams.get('country') || '');
  const [tagFilter, setTagFilter] = useState(() => searchParams.get('tags') || '');
  const [lastContactedFrom, setLastContactedFrom] = useState(() => searchParams.get('lastContactedFrom') || '');
  const [lastContactedTo, setLastContactedTo] = useState(() => searchParams.get('lastContactedTo') || '');
  const [emailTypeFilter, setEmailTypeFilter] = useState('all');
  const [repliedFilter, setRepliedFilter] = useState('all');
  const [followUpStageFilter, setFollowUpStageFilter] = useState('all');
  const [followUpDueFilter, setFollowUpDueFilter] = useState(() => searchParams.get('filter') === 'followups_due');
  const [missingPainFilter, setMissingPainFilter] = useState(() => searchParams.get('missing') === 'pain_points');
  const [missingSolutionFilter, setMissingSolutionFilter] = useState(() => searchParams.get('missing') === 'solution_angle');
  const [notContactedFilter, setNotContactedFilter] = useState(() => searchParams.get('contacted') === 'false');
  const [contactGuardFilter, setContactGuardFilter] = useState('all');

  const currentFilters: LeadsFiltersState = useMemo(() => ({
    search, statusFilter, priorityFilter, aiStatusFilter, emailStatusFilter,
    readinessFilter, leadListFilter, industryFilter, countryFilter, tagFilter,
    lastContactedFrom, lastContactedTo, followUpDueFilter, missingPainFilter,
    missingSolutionFilter, notContactedFilter, contactGuardFilter,
  }), [search, statusFilter, priorityFilter, aiStatusFilter, emailStatusFilter,
    readinessFilter, leadListFilter, industryFilter, countryFilter, tagFilter,
    lastContactedFrom, lastContactedTo, followUpDueFilter, missingPainFilter,
    missingSolutionFilter, notContactedFilter, contactGuardFilter]);

  const setFilters = useCallback((next: LeadsFiltersState) => {
    setSearch(next.search);
    setStatusFilter(next.statusFilter);
    setPriorityFilter(next.priorityFilter);
    setAiStatusFilter(next.aiStatusFilter);
    setEmailStatusFilter(next.emailStatusFilter);
    setReadinessFilter(next.readinessFilter);
    setLeadListFilter(next.leadListFilter);
    setIndustryFilter(next.industryFilter);
    setCountryFilter(next.countryFilter);
    setTagFilter(next.tagFilter);
    setLastContactedFrom(next.lastContactedFrom);
    setLastContactedTo(next.lastContactedTo);
    setFollowUpDueFilter(next.followUpDueFilter);
    setMissingPainFilter(next.missingPainFilter);
    setMissingSolutionFilter(next.missingSolutionFilter);
    setNotContactedFilter(next.notContactedFilter);
    setContactGuardFilter(next.contactGuardFilter);
  }, []);

  return {
    search, setSearch,
    statusFilter, setStatusFilter,
    priorityFilter, setPriorityFilter,
    aiStatusFilter, setAiStatusFilter,
    emailStatusFilter, setEmailStatusFilter,
    readinessFilter, setReadinessFilter,
    qualityFilter, setQualityFilter,
    leadListFilter, setLeadListFilter,
    industryFilter, setIndustryFilter,
    countryFilter, setCountryFilter,
    tagFilter, setTagFilter,
    lastContactedFrom, setLastContactedFrom,
    lastContactedTo, setLastContactedTo,
    emailTypeFilter, setEmailTypeFilter,
    repliedFilter, setRepliedFilter,
    followUpStageFilter, setFollowUpStageFilter,
    followUpDueFilter, setFollowUpDueFilter,
    missingPainFilter, setMissingPainFilter,
    missingSolutionFilter, setMissingSolutionFilter,
    notContactedFilter, setNotContactedFilter,
    contactGuardFilter, setContactGuardFilter,
    currentFilters,
    setFilters,
  };
}
