'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export type SequenceStep = {
  id?: string;
  step_number: number;
  delay_days: number | string;
  condition?: string;
  subject: string;
  body: string;
};

/**
 * Local sequence-step array CRUD (add/update/remove/reindex) plus the
 * delete-then-insert-with-legacy-`condition`-fallback save logic, shared
 * between the campaign detail page and the new-campaign wizard.
 */
export function useSequenceSteps(initialSteps: SequenceStep[] = []) {
  const supabase = createClient();
  const [sequences, setSequences] = useState<SequenceStep[]>(initialSteps);
  const [savingSequence, setSavingSequence] = useState(false);

  const addStep = useCallback(() => {
    setSequences((current) => {
      const nextStepNum = current.length + 1;
      return [
        ...current,
        {
          step_number: nextStepNum,
          delay_days: nextStepNum === 1 ? 0 : 2, // step 1 defaults to 0 (immediate), subsequent steps to 2 days
          condition: 'always',
          subject: 'Quick question {{first_name}}',
          body: 'Hi {{first_name}},\n\n{{ai_personalization}}\n\nWould you be open to a quick call next week?\n\nBest,\n{{sender_name}}',
        },
      ];
    });
  }, []);

  const updateStepField = useCallback((index: number, field: string, value: any) => {
    setSequences((current) => {
      const updated = [...current];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const removeStep = useCallback((index: number) => {
    setSequences((current) =>
      current.filter((_, i) => i !== index).map((step, idx) => ({
        ...step,
        step_number: idx + 1, // Re-index step numbers
      }))
    );
  }, []);

  const saveSequences = useCallback(async (campaignId: string, options?: { deleteExisting?: boolean }) => {
    setSavingSequence(true);
    try {
      if (options?.deleteExisting) {
        const { error: deleteError } = await supabase
          .from('sequences')
          .delete()
          .eq('campaign_id', campaignId);
        if (deleteError) throw deleteError;
      }

      if (sequences.length > 0) {
        const insertPayload = sequences.map(({ step_number, delay_days, subject, body, condition }, idx) => ({
          campaign_id: campaignId,
          step_number,
          delay_days: Number(delay_days),
          subject,
          body,
          condition: idx === 0 ? 'always' : (condition || 'always'),
        }));

        let { error: insertError } = await supabase
          .from('sequences')
          .insert(insertPayload);

        if (insertError && String(insertError.message || '').toLowerCase().includes('condition')) {
          // Databases without the conditions migration still accept plain steps.
          const legacyPayload = insertPayload.map(({ condition: _condition, ...rest }) => rest);
          const legacyResponse = await supabase.from('sequences').insert(legacyPayload);
          insertError = legacyResponse.error;
        }

        if (insertError) throw insertError;
      }
    } finally {
      setSavingSequence(false);
    }
  }, [sequences, supabase]);

  return { sequences, setSequences, savingSequence, addStep, updateStepField, removeStep, saveSequences };
}
