import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, BookOpen, Copy, Folder, FolderOpen, File as FileIcon, Upload, Plus, FolderPlus, ChevronRight, ChevronDown, Download, FileText, Image as ImageIcon, Table2, Loader2, Trash2, Eye, Pencil, FolderInput } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/context/UserContext';
import { FilePreviewDialog } from '@/components/shared/FilePreviewDialog';
import { RichTextEditor } from '@/components/shared/RichTextEditor';

interface KFolder { id: string; name: string; parent_id: string | null; }
interface KFile {
  id: string;
  folder_id: string | null;
  name: string;
  size_bytes: number | null;
  mime_type: string | null;
  storage_path: string;
  content_html: string | null;
  created_at: string;
}

const isInlineDoc = (f: Pick<KFile, 'mime_type' | 'storage_path'>) =>
  f.mime_type === 'text/html' && f.storage_path.startsWith('inline://');

const fileIcon = (file: Pick<KFile, 'mime_type' | 'name' | 'storage_path'>) => {
  if (isInlineDoc(file)) return <FileText className="h-4 w-4 text-primary" />;
  const mime = file.mime_type;
  const ext = file.name?.split('.').pop()?.toLowerCase() ?? '';
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

export default function Knowledge() {
  const { currentUser, isAdmin } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const [folders, setFolders] = useState<KFolder[]>([]);
  const [files, setFiles] = useState<KFile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderTarget, setNewFolderTarget] = useState<{ parentId: string | null; parentName: string | null }>({ parentId: null, parentName: null });
  const [newFolderName, setNewFolderName] = useState('');

  // Inline rich-text document authoring
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docForm, setDocForm] = useState<{ name: string; content_html: string }>({ name: '', content_html: '' });
  const [docFolderId, setDocFolderId] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<{ kind: 'folder' | 'file'; id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Move file dialog
  const [moveTarget, setMoveTarget] = useState<KFile | null>(null);
  const [moveSelectedId, setMoveSelectedId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Sidebar folder expand/collapse + drag-to-reorganize
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | 'root' | null>(null);

  // Preview state
  const [previewFile, setPreviewFile] = useState<KFile | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: f }, { data: fi }] = await Promise.all([
      supabase.from('kb_folders').select('id, name, parent_id'),
      supabase.from('kb_files').select('id, folder_id, name, size_bytes, mime_type, storage_path, content_html, created_at').order('created_at', { ascending: false }),
    ]);
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

  // Files: when searching, search globally across ALL files; otherwise show current folder
  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return files.filter(f => f.name.toLowerCase().includes(q));
    }
    return getFilesInFolder(currentFolderId);
  }, [files, searchQuery, currentFolderId]);

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

  // ---------- Inline rich-text documents ----------
  const openNewDoc = () => {
    if (!currentFolderId) { toast.error('Open a folder first'); return; }
    setEditingDocId(null);
    setDocFolderId(currentFolderId);
    setDocForm({ name: '', content_html: '' });
    setShowDocDialog(true);
  };

  const openEditDoc = (f: KFile) => {
    setEditingDocId(f.id);
    setDocFolderId(f.folder_id);
    setDocForm({ name: f.name, content_html: f.content_html ?? '' });
    setShowDocDialog(true);
  };

  const saveDoc = async () => {
    const name = docForm.name.trim();
    if (!name) { toast.error('Name is required'); return; }
    if (editingDocId) {
      const { error } = await supabase
        .from('kb_files')
        .update({ name, content_html: docForm.content_html })
        .eq('id', editingDocId);
      if (error) { toast.error(error.message); return; }
      toast.success('Document updated');
    } else {
      if (!docFolderId) { toast.error('Open a folder first'); return; }
      const id = crypto.randomUUID();
      const { error } = await supabase.from('kb_files').insert({
        folder_id: docFolderId,
        name,
        mime_type: 'text/html',
        storage_path: `inline://${id}`,
        content_html: docForm.content_html,
        size_bytes: new Blob([docForm.content_html ?? '']).size,
        uploaded_by: currentUser.user_id,
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Document created');
    }
    setShowDocDialog(false);
    setEditingDocId(null);
    load();
  };

  // ---------- Rename folder / file ----------
  const openRename = (kind: 'folder' | 'file', id: string, name: string) => {
    setRenameTarget({ kind, id, name });
    setRenameValue(name);
  };

  const saveRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) { toast.error('Name cannot be empty'); return; }
    if (name === renameTarget.name) { setRenameTarget(null); return; }
    if (renameTarget.kind === 'folder') {
      const folder = folders.find(f => f.id === renameTarget.id);
      if (!folder) return;
      const clash = folders.some(f =>
        f.parent_id === folder.parent_id && f.id !== folder.id && f.name.toLowerCase() === name.toLowerCase());
      if (clash) { toast.error(`A folder named "${name}" already exists here.`); return; }
      const { error } = await supabase.from('kb_folders').update({ name }).eq('id', folder.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Folder renamed');
    } else {
      const { error } = await supabase.from('kb_files').update({ name }).eq('id', renameTarget.id);
      if (error) { toast.error(error.message); return; }
      toast.success('File renamed');
    }
    setRenameTarget(null);
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

  const openPreview = (f: KFile) => setPreviewFile(f);

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
            onClick={() => { setCurrentFolderId(folder.id); if (hasChildren && !isExpanded) toggleExpanded(folder.id); }}
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
          {isAdmin && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
                    onClick={(e) => { e.stopPropagation(); openRename('folder', folder.id, folder.name); }}
                    aria-label={`Rename ${folder.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Rename folder</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {isExpanded && children.map(c => <FolderTreeItem key={c.id} folder={c} depth={depth + 1} />)}
      </div>
    );
  }

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-border bg-card p-3 overflow-auto hidden md:flex flex-col gap-3">
        <h2 className="text-lg font-semibold px-1">Knowledge Base</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search files (all folders)…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
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
      </div>

      <div className="flex-1 overflow-auto">
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
                  <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Uploading…' : 'Upload files'}
                  </Button>
                  {isAdmin && (
                    <Button size="sm" onClick={openNewDoc}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> New document
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {currentFolderId && (
            <p className="text-xs text-muted-foreground">
              Tip: drag a folder from your computer onto this area, or click New document to write a rich-text document in this folder.
            </p>
          )}

          {!searchQuery && childFolders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {childFolders.map(f => (
                <Card key={f.id} className="group cursor-pointer hover:bg-muted/50 relative" onClick={() => setCurrentFolderId(f.id)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Folder className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{getFilesInFolder(f.id).length} files</p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); openRename('folder', f.id, f.name); }}
                        aria-label={`Rename ${f.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
                      ? 'No files in this folder. Drop files here, click Upload, or create a new document.'
                      : 'Select a folder from the sidebar, or use the search bar above to find files across all folders.'}
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredFiles.map(file => {
                    const inline = isInlineDoc(file);
                    return (
                      <div key={file.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
                        {fileIcon(file)}
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => openPreview(file)}
                        >
                          <p className="text-sm font-medium truncate hover:underline">{file.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            {inline ? <span>Document</span> : <span>{fmtSize(file.size_bytes)}</span>}
                            <span>•</span>
                            <span>{format(new Date(file.created_at), 'dd MMM yyyy')}</span>
                            {searchQuery && (<><span>•</span><span className="truncate">{folderPath(file.folder_id)}</span></>)}
                          </div>
                        </button>
                        <div className="flex gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openPreview(file)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{inline ? 'Open' : 'Preview'}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {!inline && (
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
                          )}
                          {isAdmin && inline && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEditDoc(file)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit document</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {isAdmin && !inline && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openRename('file', file.id, file.name)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Rename</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {isAdmin && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openMove(file)}>
                                    <FolderInput className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Move to folder</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => deleteFile(file)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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

      {/* Document dialog: create + edit inline rich-text documents */}
      <Dialog open={showDocDialog} onOpenChange={(o) => { setShowDocDialog(o); if (!o) setEditingDocId(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingDocId ? 'Edit document' : 'New document'}</DialogTitle>
            <DialogDescription>
              Rich text is preserved when staff copy this document into emails or chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label>
              <Input
                value={docForm.name}
                onChange={e => setDocForm(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Welcome email template"
              />
            </div>
            <div className="space-y-1"><Label>Content</Label>
              <RichTextEditor
                value={docForm.content_html}
                onChange={(html) => setDocForm(d => ({ ...d, content_html: html }))}
                placeholder="Write the document content here…"
                minHeight={240}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowDocDialog(false); setEditingDocId(null); }}>Cancel</Button>
              <Button onClick={saveDoc} disabled={!docForm.name.trim()}>
                {editingDocId ? 'Save changes' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename dialog (folder or file) */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => { if (!o) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.kind === 'folder' ? 'folder' : 'file'}</DialogTitle>
            <DialogDescription>
              {renameTarget?.kind === 'folder'
                ? 'Renaming a folder does not move any of its files.'
                : 'Renaming a file changes the display name and the name used when downloading.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>New name</Label>
              <Input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && renameValue.trim()) saveRename(); }}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
              <Button onClick={saveRename} disabled={!renameValue.trim() || renameValue.trim() === renameTarget?.name}>Rename</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FilePreviewDialog
        open={!!previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null);
        }}
        bucket="kb-files"
        path={previewFile?.storage_path ?? null}
        name={previewFile?.name ?? null}
        mime={previewFile?.mime_type ?? null}
      />
    </div>
  );
}
