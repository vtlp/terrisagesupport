import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ImportActivity } from './shared';

const EVENT_LABEL: Record<string, string> = {
  job_created: 'Import created',
  files_uploaded: 'Files uploaded',
  file_removed: 'File removed',
  representative_input_saved: 'Representative input saved',
  extraction_triggered: 'Extraction triggered',
  extraction_completed: 'Extraction completed',
  extraction_failed: 'Extraction failed',
  review_edited: 'Review edited',
  validation_run: 'Validation run',
  import_confirmed: 'Import confirmed',
  import_completed: 'Import completed',
  import_partially_completed: 'Partially imported',
  import_failed: 'Import failed',
  rows_parsed: 'Rows parsed',
  mapping_saved: 'Column mapping saved',
};

export function ActivityLog({ jobId }: { jobId: string }) {
  const [rows, setRows] = useState<ImportActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('import_activity').select('*').eq('job_id', jobId).order('created_at', { ascending: false });
    setRows((data ?? []) as ImportActivity[]);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground py-2">No activity yet.</p>;

  return (
    <ol className="relative border-l ml-2 space-y-3">
      {rows.map(r => (
        <li key={r.id} className="ml-4">
          <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
          <div className="text-sm font-medium">{EVENT_LABEL[r.event] ?? r.event}</div>
          <div className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}</div>
          {r.detail && Object.keys(r.detail as object).length > 0 && (
            <pre className="text-[11px] text-muted-foreground bg-muted/30 rounded px-2 py-1 mt-1 overflow-x-auto">{JSON.stringify(r.detail, null, 0)}</pre>
          )}
        </li>
      ))}
    </ol>
  );
}
