import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText, Image as ImageIcon, Table2, File as FileIcon, FileType, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'office' | null;

export function detectPreviewKind(mime?: string | null, name?: string | null): PreviewKind {
  const ext = name?.split('.').pop()?.toLowerCase() ?? '';
  if (mime?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime?.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'video';
  if (mime?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
  if (mime?.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'log', 'xml', 'yaml', 'yml'].includes(ext)) return 'text';
  return null;
}

export function previewIcon(mime?: string | null, name?: string | null) {
  const kind = detectPreviewKind(mime, name);
  if (kind === 'image') return <ImageIcon className="h-4 w-4 text-info" />;
  const ext = name?.split('.').pop()?.toLowerCase() ?? '';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <Table2 className="h-4 w-4 text-success" />;
  if (kind === 'pdf' || ['doc', 'docx'].includes(ext)) return <FileText className="h-4 w-4 text-destructive" />;
  if (['ppt', 'pptx'].includes(ext)) return <FileType className="h-4 w-4 text-warning" />;
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Storage bucket id, e.g. 'contact-attachments', 'kb-files' */
  bucket: string;
  /** Object path in the bucket. Pass null for inline HTML documents. */
  path: string | null;
  /** Display name */
  name: string | null;
  /** Optional MIME type */
  mime?: string | null;
  /** If provided, renders this HTML inline (no Storage fetch). Used for in-app rich-text documents. */
  inlineHtml?: string | null;
}

/** Reusable file preview dialog: images, PDFs, video/audio, text, Office docs, and inline rich-text documents. */
export function FilePreviewDialog({ open, onOpenChange, bucket, path, name, mime, inlineHtml }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const kind = detectPreviewKind(mime, name);

  const isInline = inlineHtml != null;

  useEffect(() => {
    if (!open || !path || isInline) return;
    let revokedUrl: string | null = null;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setSignedUrl(null);
      setBlobUrl(null);
      setTextContent(null);
      setLoadError(null);

      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (error || !data) {
        toast.error('Could not load preview');
        setLoadError('Could not load this file preview.');
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setSignedUrl(data.signedUrl);

      if (kind === 'pdf') {
        try {
          const res = await fetch(data.signedUrl);
          if (!res.ok) throw new Error('PDF fetch failed');
          const blob = await res.blob();
          const typed = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
          const url = URL.createObjectURL(typed);
          revokedUrl = url;
          if (!cancelled) setBlobUrl(url);
        } catch {
          toast.error('Could not load PDF');
          if (!cancelled) setLoadError('PDF preview is unavailable in-app for this file.');
        }
      } else if (kind === 'text') {
        try {
          const res = await fetch(data.signedUrl);
          if (!res.ok) throw new Error('Text fetch failed');
          const t = await res.text();
          if (!cancelled) setTextContent(t.slice(0, 200_000));
        } catch {
          if (!cancelled) {
            setTextContent('Could not load text content.');
            setLoadError('Text preview is unavailable in-app for this file.');
          }
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [open, bucket, path, kind]);

  const download = async () => {
    if (!path || !name) return;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60, { download: name });
    if (error || !data) { toast.error('Could not generate link'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const officeUrl = kind === 'office' && signedUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <div className="p-4 border-b flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {previewIcon(mime, name)}
            <div className="min-w-0">
              <DialogTitle className="text-base truncate">{name ?? 'Preview'}</DialogTitle>
              <DialogDescription className="text-xs">In-app file preview</DialogDescription>
            </div>
          </div>
          <div className="flex gap-2 mr-6 flex-shrink-0">
            {signedUrl && (
              <Button size="sm" variant="outline" onClick={() => window.open(blobUrl ?? signedUrl, '_blank')}>
                Open in new tab
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={download}>
              <Download className="h-3.5 w-3.5 mr-1" /> Download
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto bg-muted/30">
          {loading && (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && signedUrl && loadError && (
            <div className="h-full flex items-center justify-center p-6 text-center">
              <div>
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">{loadError}</p>
                <p className="text-xs text-muted-foreground mb-4">Try opening it in a new tab or downloading it.</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" onClick={() => window.open(blobUrl ?? signedUrl, '_blank')}>Open in new tab</Button>
                  <Button size="sm" onClick={download}><Download className="h-3.5 w-3.5 mr-1" /> Download</Button>
                </div>
              </div>
            </div>
          )}
          {!loading && signedUrl && !loadError && (
            <>
              {kind === 'image' && (
                <div className="h-full flex items-center justify-center p-4">
                  <img src={signedUrl} alt={name ?? ''} className="max-h-full max-w-full object-contain" />
                </div>
              )}
              {kind === 'pdf' && (
                blobUrl
                  ? (
                    <object data={blobUrl} type="application/pdf" className="w-full h-full">
                      <div className="h-full flex items-center justify-center p-6 text-center">
                        <div>
                          <p className="text-sm font-medium mb-1">PDF preview is unavailable in-app for this file.</p>
                          <p className="text-xs text-muted-foreground mb-4">Try opening it in a new tab or downloading it.</p>
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" onClick={() => window.open(blobUrl, '_blank')}>Open in new tab</Button>
                            <Button size="sm" onClick={download}><Download className="h-3.5 w-3.5 mr-1" /> Download</Button>
                          </div>
                        </div>
                      </div>
                    </object>
                  )
                  : <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              )}
              {kind === 'video' && (
                <div className="h-full flex items-center justify-center p-4">
                  <video src={signedUrl} controls className="max-h-full max-w-full" />
                </div>
              )}
              {kind === 'audio' && (
                <div className="h-full flex items-center justify-center p-4">
                  <audio src={signedUrl} controls />
                </div>
              )}
              {kind === 'text' && (
                <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono">{textContent ?? ''}</pre>
              )}
              {kind === 'office' && officeUrl && (
                <iframe src={officeUrl} title={name ?? 'Document'} className="w-full h-full border-0" />
              )}
              {kind === null && (
                <div className="h-full flex items-center justify-center p-6 text-center">
                  <div>
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium mb-1">In-app preview not supported for this file type.</p>
                    <p className="text-xs text-muted-foreground mb-4">You can open it in a new tab or download it.</p>
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" variant="outline" onClick={() => window.open(signedUrl, '_blank')}>Open in new tab</Button>
                      <Button size="sm" onClick={download}><Download className="h-3.5 w-3.5 mr-1" /> Download</Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
