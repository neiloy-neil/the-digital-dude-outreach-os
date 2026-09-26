'use client';

import { useCallback, useState } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { useToast } from '@/lib/toast/toast-context';

export type SavedView = { id: string; name: string; filters: Record<string, unknown>; is_default: boolean };

export type LeadsFiltersState = {
  search: string;
  statusFilter: string;
  priorityFilter: string;
  aiStatusFilter: string;
  emailStatusFilter: string;
  readinessFilter: string;
  leadListFilter: string;
  industryFilter: string;
  countryFilter: string;
  tagFilter: string;
  lastContactedFrom: string;
  lastContactedTo: string;
  followUpDueFilter: boolean;
  missingPainFilter: boolean;
  missingSolutionFilter: boolean;
  notContactedFilter: boolean;
  contactGuardFilter: string;
};

const DEFAULT_FILTERS: LeadsFiltersState = {
  search: '',
  statusFilter: 'all',
  priorityFilter: 'all',
  aiStatusFilter: 'all',
  emailStatusFilter: 'all',
  readinessFilter: 'all',
  leadListFilter: 'all',
  industryFilter: '',
  countryFilter: '',
  tagFilter: '',
  lastContactedFrom: '',
  lastContactedTo: '',
  followUpDueFilter: false,
  missingPainFilter: false,
  missingSolutionFilter: false,
  notContactedFilter: false,
  contactGuardFilter: 'all',
};

/**
 * Saved-views (preset + custom filter presets) state and CRUD, extracted
 * from src/app/leads/page.tsx. The page still owns the ~17 individual filter
 * useState calls; this hook drives them in bulk via `setFilters`.
 */
export function useSavedViews({
  searchParams,
  currentFilters,
  setFilters,
}: {
  searchParams: ReadonlyURLSearchParams;
  currentFilters: LeadsFiltersState;
  setFilters: (state: LeadsFiltersState) => void;
}) {
  const toast = useToast();
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>('all');
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [savingView, setSavingView] = useState(false);
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);

  const applyCustomView = useCallback((view: { id: string; filters?: Record<string, unknown> }) => {
    setActiveViewId(view.id);
    const f = view.filters || {};
    setFilters({
      search: String(f.search || ''),
      statusFilter: String(f.status || 'all'),
      priorityFilter: String(f.priority || 'all'),
      aiStatusFilter: String(f.aiStatus || 'all'),
      emailStatusFilter: String(f.emailStatus || 'all'),
      readinessFilter: String(f.readiness || 'all'),
      leadListFilter: String(f.leadListId || 'all'),
      industryFilter: String(f.industry || ''),
      countryFilter: String(f.country || ''),
      tagFilter: String(f.tags || ''),
      lastContactedFrom: String(f.lastContactedFrom || ''),
      lastContactedTo: String(f.lastContactedTo || ''),
      followUpDueFilter: !!f.followups_due,
      missingPainFilter: !!f.missing_pain,
      missingSolutionFilter: !!f.missing_solution,
      notContactedFilter: !!f.not_contacted,
      contactGuardFilter: String(f.contactGuard || 'all'),
    });
  }, [setFilters]);

  const applyPresetView = useCallback((viewName: string) => {
    setActiveViewId(viewName);
    const next: LeadsFiltersState = { ...DEFAULT_FILTERS };

    if (viewName === 'valid_emails') {
      next.emailStatusFilter = 'valid';
    } else if (viewName === 'ready_to_send') {
      next.readinessFilter = 'ready_to_send';
    } else if (viewName === 'followups_due') {
      next.followUpDueFilter = true;
    } else if (viewName === 'high_priority') {
      next.priorityFilter = 'high';
      next.notContactedFilter = true;
    } else if (viewName === 'missing_pain') {
      next.missingPainFilter = true;
    } else if (viewName === 'not_contacted') {
      next.notContactedFilter = true;
    }

    setFilters(next);
  }, [setFilters]);

  const loadSavedViews = useCallback(async () => {
    try {
      const response = await fetch('/api/saved-views');
      const data = await response.json();
      if (response.ok && data.savedViews) {
        setSavedViews(data.savedViews);
        // Apply default view if no query parameters exist
        const hasParams = Array.from(searchParams.keys()).length > 0;
        if (!hasParams) {
          const defaultView = data.savedViews.find((v: SavedView) => v.is_default);
          if (defaultView) {
            applyCustomView(defaultView);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [searchParams, applyCustomView]);

  const saveCurrentView = useCallback(async () => {
    if (!newViewName.trim()) return;
    setSavingView(true);
    try {
      const filters = {
        search: currentFilters.search,
        status: currentFilters.statusFilter,
        priority: currentFilters.priorityFilter,
        aiStatus: currentFilters.aiStatusFilter,
        emailStatus: currentFilters.emailStatusFilter,
        readiness: currentFilters.readinessFilter,
        leadListId: currentFilters.leadListFilter,
        industry: currentFilters.industryFilter,
        country: currentFilters.countryFilter,
        tags: currentFilters.tagFilter,
        lastContactedFrom: currentFilters.lastContactedFrom,
        lastContactedTo: currentFilters.lastContactedTo,
        followups_due: currentFilters.followUpDueFilter,
        missing_pain: currentFilters.missingPainFilter,
        missing_solution: currentFilters.missingSolutionFilter,
        not_contacted: currentFilters.notContactedFilter,
        contactGuard: currentFilters.contactGuardFilter,
      };

      const response = await fetch('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newViewName, filters }),
      });

      if (response.ok) {
        toast.success(`View "${newViewName}" saved.`);
        setNewViewName('');
        setShowSaveViewModal(false);
        await loadSavedViews();
      } else {
        toast.error('Failed to save view.');
      }
    } catch {
      toast.error('Failed to save view.');
    } finally {
      setSavingView(false);
    }
  }, [newViewName, currentFilters, loadSavedViews, toast]);

  const setDefaultView = useCallback(async (viewId: string) => {
    try {
      const response = await fetch('/api/saved-views', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: viewId, is_default: true }),
      });
      if (response.ok) {
        await loadSavedViews();
      }
    } catch {
      // ignore
    }
  }, [loadSavedViews]);

  const deleteSavedView = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/saved-views?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setActiveViewId((prev) => (prev === id ? 'all' : prev));
        await loadSavedViews();
      }
    } catch {
      // ignore
    }
  }, [loadSavedViews]);

  return {
    savedViews,
    activeViewId,
    showSaveViewModal,
    setShowSaveViewModal,
    newViewName,
    setNewViewName,
    savingView,
    deleteViewId,
    setDeleteViewId,
    applyPresetView,
    applyCustomView,
    loadSavedViews,
    saveCurrentView,
    setDefaultView,
    deleteSavedView,
  };
}
