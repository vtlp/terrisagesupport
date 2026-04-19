import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Paperclip, Upload, Trash2, Download, Loader2, FileIcon, Eye, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface AttachmentRow {
  id: string;
  ticket_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  uploaded_by: string | null;
}

interface Props { ticketId: string }

const BUCKET = 'ticket-attachments';

export function TicketAttachments({ ticketId }: Props) {
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [previewRow, setPreviewRow] = useState<AttachmentRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });
    if (error) { toast.error('Failed to load attachments'); setLoading(false); return; }
    setRows((data ?? []) as AttachmentRow[]);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;
    let success = 0;
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) { toast.error(`${file.name} exceeds 25MB`); continue; }
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${ticketId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (upErr) { toast.error(`Upload failed: ${file.name}`); continue; }
      const { error: insErr } = await supabase.from('ticket_attachments').insert({
        ticket_id: ticketId, file_name: file.name, storage_path: path,
        mime_type: file.type || null, size_bytes: file.size, uploaded_by: userId,
      });
      if (insErr) {
        toast.error(`Saved upload but record failed: ${file.name}`);
        await supabase.storage.from(BUCKET).remove([path]);
        continue;
      }
      success++;
    }
    setUploading(false);
    if (success) { toast.success(`${success} file(s) uploaded`); load(); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };

  const download = async (row: AttachmentRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60);
    if (error || !data) { toast.error('Could not download'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const preview = async (row: AttachmentRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 300);
    if (error || !data) { toast.error('Could not preview'); return; }
    setPreviewRow(row);
    setPreviewUrl(data.signedUrl);
  };

  const closePreview = () => { setPreviewRow(null); setPreviewUrl(null); };

  const startRename = (row: AttachmentRow) => {
    setEditingId(row.id);
    setEditName(row.file_name);
  };

  const saveRename = async (row: AttachmentRow) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === row.file_name) { setEditingId(null); return; }
    const { error } = await supabase.from('ticket_attachments').update({ file_name: trimmed }).eq('id', row.id);
    if (error) { toast.error('Rename failed'); return; }
    toast.success('Renamed');
    setEditingId(null);
    load();
  };

  const remove = async (row: AttachmentRow) => {
    if (!confirm(`Delete ${row.file_name}?`)) return;
    const { error: delErr } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (delErr) { toast.error('Storage delete failed'); return; }
    const { error: rowErr } = await supabase.from('ticket_attachments').delete().eq('id', row.id);
    if (rowErr) { toast.error('Record delete failed'); return; }
    toast.success('Removed');
    load();
  };

  const fmtSize = (n: number | null) => {
    if (!n && n !== 0) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  const isPreviewable = (mime: string | null) => {
    if (!mime) return false;
    return mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('text/') || mime.startsWith('video/') || mime.startsWith('audio/');
  };

  const renderPreviewBody = () => {
    if (!previewRow || !previewUrl) return null;
    const mime = previewRow.mime_type ?? '';
    if (mime.startsWith('image/')) return <img src={previewUrl} alt={previewRow.file_name} className="max-h-[70vh] mx-auto object-contain" />;
    if (mime === 'application/pdf') return <iframe src={previewUrl} title={previewRow.file_name} className="w-full h-[70vh] border-0" />;
    if (mime.startsWith('video/')) return <video src={previewUrl} controls className="max-h-[70vh] mx-auto" />;
    if (mime.startsWith('audio/')) return <audio src={previewUrl} controls className="w-full" />;
    if (mime.startsWith('text/')) return <iframe src={previewUrl} title={previewRow.file_name} className="w-full h-[70vh] border-0 bg-card" />;
    return <p className="text-sm text-muted-foreground">Preview not available for this file type.</p>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> Attachments ({rows.length})
        </h3>
        <input ref={fileRef} type="file" multiple hidden onChange={onPick} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
          Upload
        </Button>
      </div>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        className="border border-dashed border-border rounded-md p-4 text-center text-xs text-muted-foreground hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        Drag & drop files here, or click to browse
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map(r => (
            <Card key={r.id}>
              <CardContent className="p-2.5 flex items-center gap-3">
                <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {editingId === r.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveRename(r);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveRename(r)} title="Save">
                        <Check className="h-3.5 w-3.5 text-success" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)} title="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm truncate">{r.file_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {fmtSize(r.size_bytes)} · {format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}
                      </div>
                    </>
                  )}
                </div>
                {editingId !== r.id && (
                  <>
                    {isPreviewable(r.mime_type) && (
                      <Button variant="ghost" size="icon" onClick={() => preview(r)} title="Preview">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => startRename(r)} title="Rename">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => download(r)} title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewRow} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent className="max-w-4xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm truncate">{previewRow?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">{renderPreviewBody()}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
