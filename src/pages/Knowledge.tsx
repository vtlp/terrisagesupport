import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, BookOpen, Copy, Folder, FolderOpen, File as FileIcon, Upload, Plus, FolderPlus, ChevronRight, ChevronDown, Download, FileText, Image as ImageIcon, Table2, Loader2, Trash2, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/context/UserContext';

const buckets = [
  { v: 'SALES_CONTENT', l: 'Sales Content' },
  { v: 'CHECKLISTS', l: 'Checklists' },
  { v: 'SUPPORT_UI_GUIDE', l: 'Support UI Guide' },
  { v: 'PLATFORM_GUIDES', l: 'Platform Guides' },
  { v: 'BUILDER_WORKSHEETS', l: 'Builder Worksheets' },
  { v: 'CRM_TEMPLATES', l: 'CRM Templates' },
  { v: 'BULK_IMPORT_TEMPLATES', l: 'Bulk Import Templates' },
  { v: 'DEMO_TIPS', l: 'Demo Tips & Pitches' },
  { v: 'ONBOARDING_PACKS', l: 'Onboarding Packs' },
];

interface Article { id: string; title: string; body: string; bucket_key: string; tags: string[] | null; updated_at: string; }
interface KFolder { id: string; name: string; parent_id: string | null; }
interface KFile { id: string; folder_id: string | null; name: string; size_bytes: number | null; mime_type: string | null; storage_path: string; created_at: string; }

const fileIcon = (mime?: string | null, name?: string) => {
  const ext = name?.split('.').pop()?.toLowerCase() ?? '';
  if (mime?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return <ImageIcon className="h-4 w-4 text-info" />;
  if (mime?.includes('sheet') || ['xlsx', 'xls', 'csv'].includes(ext)) return <Table2 className="h-4 w-4 text-success" />;
  if (mime === 'application/pdf' || ['pdf', 'doc', 'docx'].includes(ext)) return <FileText className="h-4 w-4 text-destructive" />;
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
};
const fmtSize = (b?: number | null) => {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

const isPreviewable = (mime?: string | null, name?: string) => {
  const ext = name?.split('.').pop()?.toLowerCase() ?? '';
  if (mime?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime?.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (mime?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
  if (mime?.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'log'].includes(ext)) return 'text';
  return null;
};

export default function Knowledge() {
  const { currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<'articles' | 'files'>('files');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<string>('all');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const [articles, setArticles] = useState<Article[]>([]);
  const [folders, setFolders] = useState<KFolder[]>([]);
  const [files, setFiles] = useState<KFile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderTarget, setNewFolderTarget] = useState<{ parentId: string | null; parentName: string | null }>({ parentId: null, parentName: null });
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [newArticle, setNewArticle] = useState({ title: '', body: '', bucket_key: 'SALES_CONTENT', tags: '' });
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Sidebar folder expand/collapse + drag-to-reorganize
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | 'root' | null>(null);

  // Preview state
  const [previewFile, setPreviewFile] = useState<KFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: a }, { data: f }, { data: fi }] = await Promise.all([
      supabase.from('kb_articles').select('id, title, body, bucket_key, tags, updated_at').order('updated_at', { ascending: false }),
      supabase.from('kb_folders').select('id, name, parent_id'),
      supabase.from('kb_files').select('id, folder_id, name, size_bytes, mime_type, storage_path, created_at').order('created_at', { ascending: false }),
    ]);
    setArticles((a ?? []) as Article[]);
    setFolders((f ?? []) as KFolder[]);
    setFiles((fi ?? []) as KFile[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getChildren = (parentId: string | null) => folders.filter(f => f.parent_id === parentId);
  const getFilesInFolder = (id: string | null) => files.filter(f => f.folder_id === id);
  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) ?? null : null;

  const folderPath = useCallback((id: string | null): string => {
    if (!id) return 'Root';
    const trail: string[] = [];
    let cur = folders.find(f => f.id === id) ?? null;
    while (cur) { trail.unshift(cur.name); cur = folders.find(f => f.id === cur!.parent_id) ?? null; }
    return trail.join(' / ');
  }, [folders]);

  const breadcrumb: KFolder[] = (() => {
    const trail: KFolder[] = [];
    let cur = currentFolder;
    while (cur) { trail.unshift(cur); cur = folders.find(f => f.id === cur!.parent_id) ?? null; }
    return trail;
  })();

  // Auto-expand ancestors of the currently selected folder
  useEffect(() => {
    if (!currentFolderId) return;
    setExpandedFolders(prev => {
      const next = new Set(prev);
      let cur = folders.find(f => f.id === currentFolderId) ?? null;
      while (cur && cur.parent_id) { next.add(cur.parent_id); cur = folders.find(f => f.id === cur!.parent_id) ?? null; }
      next.add(currentFolderId);
      return next;
    });
  }, [currentFolderId, folders]);

  const toggleExpanded = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Move a folder under a new parent (null = root). Prevents cycles.
  const moveFolder = async (folderId: string, newParentId: string | null) => {
    if (folderId === newParentId) return;
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    if (folder.parent_id === newParentId) return;
    // Prevent moving into own descendant
    if (newParentId) {
      let cur = folders.find(f => f.id === newParentId) ?? null;
      while (cur) {
        if (cur.id === folderId) { toast.error('Cannot move a folder into one of its subfolders.'); return; }
        cur = folders.find(f => f.id === cur!.parent_id) ?? null;
      }
    }
    // Prevent name clash at destination
    if (folders.some(f => f.parent_id === newParentId && f.name === folder.name && f.id !== folderId)) {
      toast.error(`A folder named “${folder.name}” already exists here.`);
      return;
    }
    const { error } = await supabase.from('kb_folders').update({ parent_id: newParentId }).eq('id', folderId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved “${folder.name}”`);
    load();
  };

  const filteredArticles = articles.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q) || (a.tags ?? []).some(t => t.toLowerCase().includes(q));
    const matchBucket = selectedBucket === 'all' || a.bucket_key === selectedBucket;
    return matchSearch && matchBucket;
  });

  // Files: when searching, search globally across ALL files; otherwise show current folder
  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return files.filter(f => f.name.toLowerCase().includes(q));
    }
    return getFilesInFolder(currentFolderId);
  }, [files, searchQuery, currentFolderId]);

  const selectedArticle = selectedArticleId ? articles.find(a => a.id === selectedArticleId) : null;
  const childFolders = getChildren(currentFolderId);

  // ---------- Folder creation (explicit parent) ----------
  const openNewFolder = (parentId: string | null) => {
    setNewFolderTarget({ parentId, parentName: parentId ? (folders.find(f => f.id === parentId)?.name ?? null) : null });
    setNewFolderName('');
    setShowNewFolder(true);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const { error } = await supabase.from('kb_folders').insert({
      name: newFolderName.trim(), parent_id: newFolderTarget.parentId, created_by: currentUser.user_id,
    });
    if (error) { toast.error(error.message); return; }
    setNewFolderName(''); setShowNewFolder(false);
    toast.success('Folder created');
    load();
  };

  const createArticle = async () => {
    if (!newArticle.title.trim()) return;
    const { error } = await supabase.from('kb_articles').insert({
      title: newArticle.title.trim(),
      body: newArticle.body,
      bucket_key: newArticle.bucket_key,
      tags: newArticle.tags ? newArticle.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      created_by: currentUser.user_id,
    });
    if (error) { toast.error(error.message); return; }
    setNewArticle({ title: '', body: '', bucket_key: 'SALES_CONTENT', tags: '' });
    setShowNewArticle(false);
    toast.success('Article created');
    load();
  };

  // ---------- Single file upload ----------
  const uploadFile = async (file: File, targetFolderId: string | null) => {
    if (!targetFolderId) { toast.error('Open a folder first'); return; }
    const path = `${targetFolderId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('kb-files').upload(path, file);
    if (upErr) throw upErr;
    const { error: insErr } = await supabase.from('kb_files').insert({
      folder_id: targetFolderId, name: file.name, size_bytes: file.size,
      mime_type: file.type || null, storage_path: path, uploaded_by: currentUser.user_id,
    });
    if (insErr) throw insErr;
  };

  // ---------- Drag & drop folder upload (preserves structure) ----------
  // Uses webkitGetAsEntry to walk dropped folders, recreating structure under currentFolderId.
  const ensureFolder = async (name: string, parentId: string | null, cache: Map<string, string>): Promise<string> => {
    const key = `${parentId ?? 'root'}::${name}`;
    if (cache.has(key)) return cache.get(key)!;
    // Check existing
    const existing = folders.find(f => f.parent_id === parentId && f.name === name);
    if (existing) { cache.set(key, existing.id); return existing.id; }
    const { data, error } = await supabase.from('kb_folders').insert({
      name, parent_id: parentId, created_by: currentUser.user_id,
    }).select('id').single();
    if (error || !data) throw error ?? new Error('Folder create failed');
    cache.set(key, data.id);
    // Reflect locally so siblings find it during the same drop
    setFolders(prev => [...prev, { id: data.id, name, parent_id: parentId }]);
    folders.push({ id: data.id, name, parent_id: parentId });
    return data.id;
  };

  const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
    new Promise((res, rej) => reader.readEntries(r => res(r as FileSystemEntry[]), rej));

  const entryToFile = (entry: FileSystemFileEntry): Promise<File> =>
    new Promise((res, rej) => entry.file(res, rej));

  const walkEntry = async (entry: FileSystemEntry, parentId: string | null, cache: Map<string, string>, counter: { count: number }) => {
    if (entry.isFile) {
      const f = await entryToFile(entry as FileSystemFileEntry);
      await uploadFile(f, parentId);
      counter.count += 1;
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const newFolderId = await ensureFolder(dirEntry.name, parentId, cache);
      const reader = dirEntry.createReader();
      // Read all entries (may need multiple calls)
      let all: FileSystemEntry[] = [];
      let batch = await readEntries(reader);
      while (batch.length > 0) { all = all.concat(batch); batch = await readEntries(reader); }
      for (const child of all) {
        await walkEntry(child, newFolderId, cache, counter);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!currentFolderId) {
      toast.error('Open a folder first to drop files into.');
      return;
    }
    const items = Array.from(e.dataTransfer.items ?? []);
    const entries = items
      .map(it => (it as DataTransferItem).webkitGetAsEntry?.())
      .filter(Boolean) as FileSystemEntry[];

    setUploading(true);
    const cache = new Map<string, string>();
    const counter = { count: 0 };
    try {
      if (entries.length > 0) {
        for (const ent of entries) await walkEntry(ent, currentFolderId, cache, counter);
      } else {
        // Fallback: plain files (no folder support in browser)
        const list = Array.from(e.dataTransfer.files);
        for (const f of list) { await uploadFile(f, currentFolderId); counter.count += 1; }
      }
      toast.success(`${counter.count} file${counter.count !== 1 ? 's' : ''} uploaded`);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
      load();
    } finally {
      setUploading(false);
    }
  };

  // ---------- Folder picker upload (input webkitdirectory) ----------
  const handleFolderPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentFolderId) { toast.error('Open a folder first'); return; }
    const list = Array.from(e.target.files ?? []);
    if (list.length === 0) return;
    setUploading(true);
    const cache = new Map<string, string>();
    let count = 0;
    try {
      for (const f of list) {
        // webkitRelativePath: "rootFolder/sub/file.png"
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? f.name;
        const parts = rel.split('/');
        const fileName = parts.pop()!;
        let parentId: string | null = currentFolderId;
        for (const seg of parts) {
          parentId = await ensureFolder(seg, parentId, cache);
        }
        // Re-create file with correct name (already correct)
        await uploadFile(new File([f], fileName, { type: f.type }), parentId);
        count += 1;
      }
      toast.success(`${count} file${count !== 1 ? 's' : ''} uploaded`);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
      load();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentFolderId) { toast.error('Open a folder first'); return; }
    const list = Array.from(e.target.files ?? []);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const f of list) await uploadFile(f, currentFolderId);
      toast.success(`${list.length} file${list.length !== 1 ? 's' : ''} uploaded`);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ---------- File actions ----------
  const downloadFile = async (f: KFile) => {
    const { data, error } = await supabase.storage.from('kb-files').createSignedUrl(f.storage_path, 60, { download: f.name });
    if (error || !data) { toast.error('Could not generate link'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const openPreview = async (f: KFile) => {
    // revoke previous blob if any
    if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); }
    setPreviewBlobUrl(null);
    setPreviewFile(f);
    setPreviewUrl(null);
    setPreviewText(null);
    setPreviewLoading(true);
    const kind = isPreviewable(f.mime_type, f.name);
    const { data, error } = await supabase.storage.from('kb-files').createSignedUrl(f.storage_path, 600);
    if (error || !data) {
      toast.error('Could not load preview');
      setPreviewLoading(false);
      return;
    }
    setPreviewUrl(data.signedUrl);
    // For PDFs, fetch as blob so the browser renders it inline (avoids Chrome
    // blocking iframes when storage returns Content-Disposition: attachment).
    if (kind === 'pdf') {
      try {
        const res = await fetch(data.signedUrl);
        const blob = await res.blob();
        const typedBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
        setPreviewBlobUrl(URL.createObjectURL(typedBlob));
      } catch {
        toast.error('Could not load PDF for preview');
      }
    }
    if (kind === 'text') {
      try {
        const res = await fetch(data.signedUrl);
        const text = await res.text();
        setPreviewText(text.slice(0, 200_000));
      } catch {
        setPreviewText('Could not load text content.');
      }
    }
    setPreviewLoading(false);
  };

  const deleteFile = async (f: KFile) => {
    if (!confirm(`Delete ${f.name}?`)) return;
    await supabase.storage.from('kb-files').remove([f.storage_path]);
    const { error } = await supabase.from('kb_files').delete().eq('id', f.id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); load(); }
  };

  // ---------- Sidebar tree item ----------
  function FolderTreeItem({ folder, depth = 0 }: { folder: KFolder; depth?: number }) {
    const children = getChildren(folder.id);
    const isActive = currentFolderId === folder.id;
    const fileCount = getFilesInFolder(folder.id).length;
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = children.length > 0;
    const isDropTarget = dragOverFolderId === folder.id;
    const isBeingDragged = draggedFolderId === folder.id;

    return (
      <div>
        <div
          className={`group flex items-center gap-1 w-full text-sm rounded-md hover:bg-muted/50 ${isActive ? 'bg-primary/10 text-primary font-medium' : ''} ${isDropTarget ? 'ring-2 ring-primary ring-inset bg-primary/10' : ''} ${isBeingDragged ? 'opacity-40' : ''}`}
          style={{ paddingLeft: `${4 + depth * 12}px` }}
          draggable
          onDragStart={(e) => { e.stopPropagation(); setDraggedFolderId(folder.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', folder.id); }}
          onDragEnd={() => { setDraggedFolderId(null); setDragOverFolderId(null); }}
          onDragOver={(e) => {
            if (!draggedFolderId || draggedFolderId === folder.id) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            setDragOverFolderId(folder.id);
          }}
          onDragLeave={(e) => { e.stopPropagation(); if (dragOverFolderId === folder.id) setDragOverFolderId(null); }}
          onDrop={(e) => {
            if (!draggedFolderId || draggedFolderId === folder.id) return;
            e.preventDefault();
            e.stopPropagation();
            const id = draggedFolderId;
            setDraggedFolderId(null); setDragOverFolderId(null);
            moveFolder(id, folder.id);
          }}
          title="Drag to move into another folder"
        >
          <button
            className="p-0.5 rounded hover:bg-muted flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpanded(folder.id); }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button
            className="flex items-center gap-2 flex-1 min-w-0 text-left py-1.5 pr-1"
            onClick={() => { setCurrentFolderId(folder.id); setActiveTab('files'); if (hasChildren && !isExpanded) toggleExpanded(folder.id); }}
          >
            {isActive ? <FolderOpen className="h-4 w-4 flex-shrink-0" /> : <Folder className="h-4 w-4 flex-shrink-0" />}
            <span className="truncate flex-1">{folder.name}</span>
            {fileCount > 0 && <span className="text-xs text-muted-foreground">{fileCount}</span>}
          </button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
                  onClick={(e) => { e.stopPropagation(); openNewFolder(folder.id); if (!isExpanded) toggleExpanded(folder.id); }}
                  aria-label={`New subfolder inside ${folder.name}`}
                >
                  <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">New subfolder inside “{folder.name}”</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {isExpanded && children.map(c => <FolderTreeItem key={c.id} folder={c} depth={depth + 1} />)}
      </div>
    );
  }

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const previewKind = previewFile ? isPreviewable(previewFile.mime_type, previewFile.name) : null;

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-border bg-card p-3 overflow-auto hidden md:flex flex-col gap-3">
        <h2 className="text-lg font-semibold px-1">Knowledge Base</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={activeTab === 'files' ? 'Search files (all folders)…' : 'Search articles…'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          <button className={`flex-1 text-xs py-1.5 rounded ${activeTab === 'files' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`} onClick={() => setActiveTab('files')}>Files</button>
          <button className={`flex-1 text-xs py-1.5 rounded ${activeTab === 'articles' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`} onClick={() => setActiveTab('articles')}>Articles</button>
        </div>
        {activeTab === 'files' ? (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">Folders</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => openNewFolder(null)} aria-label="New root folder">
                      <FolderPlus className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">New folder at root level</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <button
              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 ${currentFolderId === null ? 'bg-primary/10 text-primary font-medium' : ''} ${dragOverFolderId === 'root' ? 'ring-2 ring-primary ring-inset bg-primary/10' : ''}`}
              onClick={() => setCurrentFolderId(null)}
              onDragOver={(e) => { if (!draggedFolderId) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId('root'); }}
              onDragLeave={() => { if (dragOverFolderId === 'root') setDragOverFolderId(null); }}
              onDrop={(e) => {
                if (!draggedFolderId) return;
                e.preventDefault();
                const id = draggedFolderId;
                setDraggedFolderId(null); setDragOverFolderId(null);
                moveFolder(id, null);
              }}
              title={draggedFolderId ? 'Drop here to move folder to root' : undefined}
            >
              <BookOpen className="h-4 w-4" /> All Files
              {draggedFolderId && <span className="ml-auto text-xs text-muted-foreground">drop to root</span>}
            </button>
            {getChildren(null).map(f => <FolderTreeItem key={f.id} folder={f} />)}
          </>
        ) : (
          <>
            <Button variant={selectedBucket === 'all' ? 'secondary' : 'ghost'} className="w-full justify-start text-sm h-8" onClick={() => setSelectedBucket('all')}>
              <BookOpen className="h-4 w-4 mr-2" />All ({articles.length})
            </Button>
            {buckets.map(b => (
              <Button key={b.v} variant={selectedBucket === b.v ? 'secondary' : 'ghost'} className="w-full justify-start text-xs h-7" onClick={() => setSelectedBucket(b.v)}>
                {b.l} ({articles.filter(a => a.bucket_key === b.v).length})
              </Button>
            ))}
            <Button size="sm" className="mt-2" onClick={() => setShowNewArticle(true)}><Plus className="h-3 w-3 mr-1" /> New article</Button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'files' ? (
          <div
            className={`p-4 md:p-6 space-y-4 min-h-full relative ${isDragging ? 'bg-primary/5' : ''}`}
            onDragOver={(e) => { e.preventDefault(); if (currentFolderId) setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-4 border-2 border-dashed border-primary rounded-lg bg-primary/5 flex items-center justify-center pointer-events-none z-10">
                <div className="text-center">
                  <Upload className="h-10 w-10 mx-auto text-primary mb-2" />
                  <p className="text-sm font-medium">Drop files or folders to upload to “{currentFolder?.name ?? 'Root'}”</p>
                  <p className="text-xs text-muted-foreground mt-1">Folder structure will be preserved.</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 text-sm flex-wrap">
                <button className="text-primary hover:underline" onClick={() => setCurrentFolderId(null)}>Root</button>
                {breadcrumb.map(f => (
                  <span key={f.id} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <button className="text-primary hover:underline" onClick={() => setCurrentFolderId(f.id)}>{f.name}</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => openNewFolder(currentFolderId)}>
                        <FolderPlus className="h-3.5 w-3.5 mr-1" />
                        {currentFolderId ? 'New subfolder' : 'New folder'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Creates a folder inside “{currentFolder?.name ?? 'Root'}”
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {currentFolderId && (
                  <>
                    <input
                      ref={folderInputRef}
                      type="file"
                      className="hidden"
                      // @ts-expect-error - non-standard but supported in Chromium / WebKit
                      webkitdirectory=""
                      directory=""
                      multiple
                      onChange={handleFolderPick}
                    />
                    <Button size="sm" variant="outline" disabled={uploading} onClick={() => folderInputRef.current?.click()}>
                      <FolderOpen className="h-3.5 w-3.5 mr-1" /> Upload folder
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={handleFilePick}
                    />
                    <Button size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Uploading…' : 'Upload files'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {currentFolderId && (
              <p className="text-xs text-muted-foreground">
                Tip: drag a folder from your computer onto this area — its structure (subfolders included) will be recreated here.
              </p>
            )}

            {!searchQuery && childFolders.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {childFolders.map(f => (
                  <Card key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setCurrentFolderId(f.id)}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <Folder className="h-8 w-8 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{getFilesInFolder(f.id).length} files</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                {filteredFiles.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {searchQuery
                      ? 'No files match your search.'
                      : currentFolderId
                        ? 'No files in this folder. Drop files here or click Upload.'
                        : 'Select a folder from the sidebar, or use the search bar above to find files across all folders.'}
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredFiles.map(file => (
                      <div key={file.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
                        {fileIcon(file.mime_type, file.name)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <span>{fmtSize(file.size_bytes)}</span><span>•</span>
                            <span>{format(new Date(file.created_at), 'dd MMM yyyy')}</span>
                            {searchQuery && (<><span>•</span><span className="truncate">{folderPath(file.folder_id)}</span></>)}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openPreview(file)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Preview</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => downloadFile(file)}>
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => deleteFile(file)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row h-full">
            <div className="w-full md:w-80 border-r border-border overflow-auto">
              <div className="p-3 space-y-2">
                {filteredArticles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No articles.</p>
                ) : filteredArticles.map(item => (
                  <div key={item.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedArticleId === item.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedArticleId(item.id)}>
                    <h4 className="text-sm font-medium">{item.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.body}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {(item.tags ?? []).slice(0, 3).map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {selectedArticle ? (
                <div className="p-6 max-w-3xl">
                  <Badge className="mb-2">{buckets.find(b => b.v === selectedArticle.bucket_key)?.l ?? selectedArticle.bucket_key}</Badge>
                  <h1 className="text-2xl font-bold mb-4">{selectedArticle.title}</h1>
                  <Button size="sm" variant="outline" className="mb-4" onClick={() => { navigator.clipboard.writeText(selectedArticle.body); toast.success('Copied'); }}>
                    <Copy className="h-4 w-4 mr-1" />Copy
                  </Button>
                  <div className="bg-card border rounded-lg p-6">
                    <p className="whitespace-pre-wrap text-sm">{selectedArticle.body}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1">
                    {(selectedArticle.tags ?? []).map(t => <Badge key={t} variant="outline">{t}</Badge>)}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">Select an article to view</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New folder dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>
              {newFolderTarget.parentName ? `Will be created inside “${newFolderTarget.parentName}”.` : 'Will be created at the root level.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Folder name</Label>
              <Input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="e.g., Q2 Materials"
                onKeyDown={(e) => { if (e.key === 'Enter' && newFolderName.trim()) createFolder(); }}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowNewFolder(false)}>Cancel</Button>
              <Button onClick={createFolder} disabled={!newFolderName.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New article dialog */}
      <Dialog open={showNewArticle} onOpenChange={setShowNewArticle}>
        <DialogContent>
          <DialogHeader><DialogTitle>New article</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Title</Label>
              <Input value={newArticle.title} onChange={e => setNewArticle(a => ({ ...a, title: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Bucket</Label>
              <Select value={newArticle.bucket_key} onValueChange={v => setNewArticle(a => ({ ...a, bucket_key: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{buckets.map(b => <SelectItem key={b.v} value={b.v}>{b.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Body</Label>
              <Textarea rows={8} value={newArticle.body} onChange={e => setNewArticle(a => ({ ...a, body: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Tags (comma separated)</Label>
              <Input value={newArticle.tags} onChange={e => setNewArticle(a => ({ ...a, tags: e.target.value }))} placeholder="onboarding, demo, pricing" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowNewArticle(false)}>Cancel</Button>
              <Button onClick={createArticle} disabled={!newArticle.title.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* In-app file preview dialog */}
      <Dialog open={!!previewFile} onOpenChange={(o) => {
        if (!o) {
          if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
          setPreviewBlobUrl(null);
          setPreviewFile(null); setPreviewUrl(null); setPreviewText(null);
        }
      }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
          <div className="p-4 border-b flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {previewFile && fileIcon(previewFile.mime_type, previewFile.name)}
              <div className="min-w-0">
                <DialogTitle className="text-base truncate">{previewFile?.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  {previewFile && `${fmtSize(previewFile.size_bytes)} • ${folderPath(previewFile.folder_id)}`}
                </DialogDescription>
              </div>
            </div>
            <div className="flex gap-2 mr-6 flex-shrink-0">
              {previewFile && previewUrl && (
                <Button size="sm" variant="outline" onClick={() => window.open(previewBlobUrl ?? previewUrl, '_blank')}>
                  Open in new tab
                </Button>
              )}
              {previewFile && (
                <Button size="sm" variant="outline" onClick={() => downloadFile(previewFile)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto bg-muted/30">
            {previewLoading && (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!previewLoading && previewFile && previewUrl && (
              <>
                {previewKind === 'image' && (
                  <div className="h-full flex items-center justify-center p-4">
                    <img src={previewUrl} alt={previewFile.name} className="max-h-full max-w-full object-contain" />
                  </div>
                )}
                {previewKind === 'pdf' && (
                  previewBlobUrl ? (
                    <iframe src={previewBlobUrl} title={previewFile.name} className="w-full h-full border-0" />
                  ) : (
                    <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  )
                )}
                {previewKind === 'video' && (
                  <div className="h-full flex items-center justify-center p-4">
                    <video src={previewUrl} controls className="max-h-full max-w-full" />
                  </div>
                )}
                {previewKind === 'audio' && (
                  <div className="h-full flex items-center justify-center p-4">
                    <audio src={previewUrl} controls />
                  </div>
                )}
                {previewKind === 'text' && (
                  <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono">{previewText ?? ''}</pre>
                )}
                {previewKind === null && (
                  <div className="h-full flex items-center justify-center p-6 text-center">
                    <div>
                      <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium mb-1">In-app preview not supported for this file type.</p>
                      <p className="text-xs text-muted-foreground mb-4">You can open it in a new tab or download it.</p>
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" variant="outline" onClick={() => window.open(previewUrl, '_blank')}>
                          Open in new tab
                        </Button>
                        <Button size="sm" onClick={() => previewFile && downloadFile(previewFile)}>
                          <Download className="h-3.5 w-3.5 mr-1" /> Download
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
