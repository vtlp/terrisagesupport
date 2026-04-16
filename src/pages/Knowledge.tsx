import { useCallback, useEffect, useState } from 'react';
import { Search, BookOpen, Copy, Folder, FolderOpen, File, Upload, Plus, ChevronRight, Download, FileText, Image as ImageIcon, Table2, Loader2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  return <File className="h-4 w-4 text-muted-foreground" />;
};
const fmtSize = (b?: number | null) => {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
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
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [newArticle, setNewArticle] = useState({ title: '', body: '', bucket_key: 'SALES_CONTENT', tags: '' });
  const [uploading, setUploading] = useState(false);

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

  const breadcrumb: KFolder[] = (() => {
    const trail: KFolder[] = [];
    let cur = currentFolder;
    while (cur) { trail.unshift(cur); cur = folders.find(f => f.id === cur!.parent_id) ?? null; }
    return trail;
  })();

  const filteredArticles = articles.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q) || (a.tags ?? []).some(t => t.toLowerCase().includes(q));
    const matchBucket = selectedBucket === 'all' || a.bucket_key === selectedBucket;
    return matchSearch && matchBucket;
  });

  const filteredFiles = currentFolderId
    ? getFilesInFolder(currentFolderId).filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files.filter(f => searchQuery && f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const selectedArticle = selectedArticleId ? articles.find(a => a.id === selectedArticleId) : null;
  const childFolders = getChildren(currentFolderId);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const { error } = await supabase.from('kb_folders').insert({
      name: newFolderName.trim(), parent_id: currentFolderId, created_by: currentUser.user_id,
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

  const uploadFile = async (file: File) => {
    if (!currentFolderId) { toast.error('Open a folder first'); return; }
    setUploading(true);
    const path = `${currentFolderId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('kb-files').upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error: insErr } = await supabase.from('kb_files').insert({
      folder_id: currentFolderId, name: file.name, size_bytes: file.size,
      mime_type: file.type || null, storage_path: path, uploaded_by: currentUser.user_id,
    });
    setUploading(false);
    if (insErr) { toast.error(insErr.message); return; }
    toast.success(`${file.name} uploaded`);
    load();
  };

  const downloadFile = async (f: KFile) => {
    const { data, error } = await supabase.storage.from('kb-files').createSignedUrl(f.storage_path, 60);
    if (error || !data) { toast.error('Could not generate link'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const deleteFile = async (f: KFile) => {
    if (!confirm(`Delete ${f.name}?`)) return;
    await supabase.storage.from('kb-files').remove([f.storage_path]);
    const { error } = await supabase.from('kb_files').delete().eq('id', f.id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); load(); }
  };

  function FolderTreeItem({ folder, depth = 0 }: { folder: KFolder; depth?: number }) {
    const children = getChildren(folder.id);
    const isActive = currentFolderId === folder.id;
    const fileCount = getFilesInFolder(folder.id).length;
    return (
      <div>
        <button
          className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 ${isActive ? 'bg-primary/10 text-primary font-medium' : ''}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => { setCurrentFolderId(folder.id); setActiveTab('files'); }}
        >
          {isActive ? <FolderOpen className="h-4 w-4 flex-shrink-0" /> : <Folder className="h-4 w-4 flex-shrink-0" />}
          <span className="truncate flex-1">{folder.name}</span>
          {fileCount > 0 && <span className="text-xs text-muted-foreground">{fileCount}</span>}
        </button>
        {children.map(c => <FolderTreeItem key={c.id} folder={c} depth={depth + 1} />)}
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
          <Input placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          <button className={`flex-1 text-xs py-1.5 rounded ${activeTab === 'files' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`} onClick={() => setActiveTab('files')}>Files</button>
          <button className={`flex-1 text-xs py-1.5 rounded ${activeTab === 'articles' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`} onClick={() => setActiveTab('articles')}>Articles</button>
        </div>
        {activeTab === 'files' ? (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">Folders</span>
              <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setShowNewFolder(true)}><Plus className="h-3 w-3" /></Button>
            </div>
            <button
              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 ${currentFolderId === null ? 'bg-primary/10 text-primary font-medium' : ''}`}
              onClick={() => setCurrentFolderId(null)}
            >
              <BookOpen className="h-4 w-4" /> All Files
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
          <div className="p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 text-sm">
                <button className="text-primary hover:underline" onClick={() => setCurrentFolderId(null)}>Root</button>
                {breadcrumb.map(f => (
                  <span key={f.id} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <button className="text-primary hover:underline" onClick={() => setCurrentFolderId(f.id)}>{f.name}</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowNewFolder(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Folder</Button>
                {currentFolderId && (
                  <label className="inline-flex">
                    <input type="file" className="hidden" disabled={uploading} onChange={e => {
                      const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '';
                    }} />
                    <Button size="sm" disabled={uploading} asChild>
                      <span><Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Uploading…' : 'Upload'}</span>
                    </Button>
                  </label>
                )}
              </div>
            </div>

            {childFolders.length > 0 && (
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

            {(currentFolderId || searchQuery) && (
              <Card>
                <CardContent className="p-0">
                  {filteredFiles.length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                      {currentFolderId ? 'No files in this folder.' : 'Search for files…'}
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredFiles.map(file => (
                        <div key={file.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
                          {fileIcon(file.mime_type, file.name)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{fmtSize(file.size_bytes)}</span><span>•</span>
                              <span>{format(new Date(file.created_at), 'dd MMM yyyy')}</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => downloadFile(file)}>
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => deleteFile(file)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!currentFolderId && !searchQuery && childFolders.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">No folders yet. Create one to start organising files.</p>
            )}
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

      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>{currentFolder ? `Inside ${currentFolder.name}` : 'At root level'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Folder name</Label>
              <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="e.g., Q2 Materials" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowNewFolder(false)}>Cancel</Button>
              <Button onClick={createFolder} disabled={!newFolderName.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
