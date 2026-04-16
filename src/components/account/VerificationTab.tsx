import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldCheck, Upload, FileText, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Kind = 'PAN' | 'GST' | 'RERA' | 'BANK' | 'IDENTITY';
type Status = 'PENDING' | 'VERIFIED' | 'REJECTED';

interface Verification {
  id: string;
  account_id: string;
  kind: Kind;
  status: Status;
  reference_no: string | null;
  notes: string | null;
  proof_storage_path: string | null;
  verified_at: string | null;
  created_at: string;
}

const KIND_LABELS: Record<Kind, string> = { PAN: 'PAN', GST: 'GST', RERA: 'RERA', BANK: 'Bank account', IDENTITY: 'Identity (proprietor)' };
const STATUS_COLORS: Record<Status, string> = {
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  VERIFIED: 'bg-success/15 text-success',
  REJECTED: 'bg-destructive/15 text-destructive',
};

export function VerificationTab({ accountId }: { accountId: string }) {
  const [rows, setRows] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ id?: string; kind: Kind; status: Status; reference_no: string; notes: string; proof_storage_path: string | null }>({
    kind: 'PAN', status: 'PENDING', reference_no: '', notes: '', proof_storage_path: null,
  });
  const [proofFile, setProofFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('account_verifications').select('*').eq('account_id', accountId).order('kind');
    if (error) toast.error(error.message);
    setRows((data ?? []) as Verification[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    const used = new Set(rows.map(r => r.kind));
    const next = (['PAN', 'GST', 'RERA', 'BANK', 'IDENTITY'] as Kind[]).find(k => !used.has(k)) ?? 'PAN';
    setDraft({ kind: next, status: 'PENDING', reference_no: '', notes: '', proof_storage_path: null });
    setProofFile(null);
    setOpen(true);
  };

  const openEdit = (v: Verification) => {
    setDraft({ id: v.id, kind: v.kind, status: v.status, reference_no: v.reference_no ?? '', notes: v.notes ?? '', proof_storage_path: v.proof_storage_path });
    setProofFile(null);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    let path = draft.proof_storage_path;
    if (proofFile) {
      const ext = proofFile.name.split('.').pop();
      const newPath = `${accountId}/${draft.kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('verification-proofs').upload(newPath, proofFile, { upsert: true });
      if (upErr) { setBusy(false); toast.error(upErr.message); return; }
      path = newPath;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      account_id: accountId,
      kind: draft.kind,
      status: draft.status,
      reference_no: draft.reference_no || null,
      notes: draft.notes || null,
      proof_storage_path: path,
      verified_by: draft.status === 'VERIFIED' ? user?.id ?? null : null,
      verified_at: draft.status === 'VERIFIED' ? new Date().toISOString() : null,
    };
    const { error } = draft.id
      ? await supabase.from('account_verifications').update(payload).eq('id', draft.id)
      : await supabase.from('account_verifications').insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Verification saved');
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this verification?')) return;
    const { error } = await supabase.from('account_verifications').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Removed'); load(); }
  };

  const downloadProof = async (path: string) => {
    const { data, error } = await supabase.storage.from('verification-proofs').createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Verification</CardTitle>
          <Button size="sm" onClick={openNew}>Add verification</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No verifications yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(v => (
              <div key={v.id} className="flex items-center justify-between border rounded p-3 gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{KIND_LABELS[v.kind]}</span>
                    <Badge className={`text-[10px] ${STATUS_COLORS[v.status]}`}>{v.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {v.reference_no ?? 'No reference'} {v.verified_at && `· Verified ${format(new Date(v.verified_at), 'dd MMM yyyy')}`}
                  </div>
                  {v.notes && <p className="text-xs mt-1 text-muted-foreground line-clamp-2">{v.notes}</p>}
                </div>
                <div className="flex gap-1">
                  {v.proof_storage_path && (
                    <Button variant="ghost" size="sm" onClick={() => downloadProof(v.proof_storage_path!)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft.id ? 'Edit verification' : 'Add verification'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={draft.kind} onValueChange={v => setDraft(d => ({ ...d, kind: v as Kind }))} disabled={!!draft.id}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABELS) as Kind[]).map(k => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={v => setDraft(d => ({ ...d, status: v as Status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="VERIFIED">Verified</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference number</Label>
              <Input value={draft.reference_no} onChange={e => setDraft(d => ({ ...d, reference_no: e.target.value }))} placeholder="e.g. ABCDE1234F" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><Upload className="h-3 w-3" /> Proof document</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
              {draft.proof_storage_path && !proofFile && <p className="text-xs text-muted-foreground">Existing file attached. Upload new to replace.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
