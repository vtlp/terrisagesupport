import { useState } from 'react';
import { Search, BookOpen, Copy, FolderOpen, Folder, File, Upload, Plus, ChevronRight, Download, Link2, FileText, Image, Table2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { seedKBItems, seedKBFolders, seedKBFiles } from '@/data/seedData';
import { KBBucket } from '@/types/core';
import type { KBFolder, KBFile } from '@/types/core';
import { toast } from 'sonner';
import { format } from 'date-fns';

const bucketLabels: Record<KBBucket, string> = {
  [KBBucket.SALES_CONTENT]: 'Sales Content',
  [KBBucket.CHECKLISTS]: 'Checklists',
  [KBBucket.SUPPORT_UI_GUIDE]: 'Support UI Guide',
  [KBBucket.PLATFORM_GUIDES]: 'Platform Guides',
  [KBBucket.BUILDER_WORKSHEETS]: 'Builder Worksheets',
  [KBBucket.CRM_TEMPLATES]: 'CRM Templates',
  [KBBucket.BULK_IMPORT_TEMPLATES]: 'Bulk Import Templates',
  [KBBucket.DEMO_TIPS]: 'Demo Tips & Pitches',
  [KBBucket.ONBOARDING_PACKS]: 'Onboarding Packs',
};

const fileTypeIcon = (type: string) => {
  if (['pdf', 'docx', 'doc'].includes(type)) return <FileText className="h-4 w-4 text-destructive" />;
  if (['xlsx', 'xls', 'csv'].includes(type)) return <Table2 className="h-4 w-4 text-success" />;
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(type)) return <Image className="h-4 w-4 text-info" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export default function Knowledge() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'articles' | 'files'>('files');
  const [selectedBucket, setSelectedBucket] = useState<KBBucket | 'all'>('all');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Folder tree helpers
  const getChildren = (parentId: string | null) => seedKBFolders.filter(f => f.parent_id === parentId);
  const getFilesInFolder = (folderId: string) => seedKBFiles.filter(f => f.folder_id === folderId);
  const getCurrentFolder = () => seedKBFolders.find(f => f.folder_id === currentFolderId) ?? null;

  // Breadcrumb
  const getBreadcrumb = (): KBFolder[] => {
    const trail: KBFolder[] = [];
    let current = getCurrentFolder();
    while (current) {
      trail.unshift(current);
      current = seedKBFolders.find(f => f.folder_id === current!.parent_id) ?? null;
    }
    return trail;
  };

  // Articles filtering
  const filteredArticles = seedKBItems.filter(item => {
    const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content_rich_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchBucket = selectedBucket === 'all' || item.bucket === selectedBucket;
    return matchSearch && matchBucket;
  });

  // Files filtering
  const filteredFiles = currentFolderId
    ? getFilesInFolder(currentFolderId).filter(f => !searchQuery || f.file_name.toLowerCase().includes(searchQuery.toLowerCase()) || f.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
    : seedKBFiles.filter(f => searchQuery && (f.file_name.toLowerCase().includes(searchQuery.toLowerCase()) || f.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))));

  const selectedArticle = selectedArticleId ? seedKBItems.find(k => k.kb_id === selectedArticleId) : null;
  const childFolders = getChildren(currentFolderId);
  const breadcrumb = getBreadcrumb();

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    seedKBFolders.push({
      folder_id: `FLD${Date.now()}`,
      name: newFolderName.trim(),
      parent_id: currentFolderId,
      created_at: new Date().toISOString(),
    });
    setNewFolderName('');
    setShowNewFolderDialog(false);
    toast.success(`Folder "${newFolderName}" created`);
  };

  const handleUploadFile = (fileName: string) => {
    if (!currentFolderId) {
      toast.error('Navigate to a folder first');
      return;
    }
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    seedKBFiles.push({
      file_id: `FILE${Date.now()}`,
      folder_id: currentFolderId,
      file_name: fileName,
      file_type: ext,
      file_size: Math.floor(Math.random() * 500000) + 10000,
      file_url: '#',
      tags: [],
      uploaded_by_user_id: 'U001',
      created_at: new Date().toISOString(),
    });
    setShowUploadDialog(false);
    toast.success(`"${fileName}" uploaded`);
  };

  // Recursive folder tree component
  function FolderTreeItem({ folder, depth = 0 }: { folder: KBFolder; depth?: number }) {
    const children = getChildren(folder.folder_id);
    const isActive = currentFolderId === folder.folder_id;
    const fileCount = getFilesInFolder(folder.folder_id).length;
    return (
      <div>
        <button
          className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-muted/50 ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => { setCurrentFolderId(folder.folder_id); setActiveTab('files'); }}
        >
          {isActive ? <FolderOpen className="h-4 w-4 flex-shrink-0" /> : <Folder className="h-4 w-4 flex-shrink-0" />}
          <span className="truncate flex-1">{folder.name}</span>
          {fileCount > 0 && <span className="text-xs text-muted-foreground">{fileCount}</span>}
        </button>
        {children.map(child => <FolderTreeItem key={child.folder_id} folder={child} depth={depth + 1} />)}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <div className="w-64 border-r border-border bg-card p-3 overflow-auto hidden md:flex flex-col gap-3">
        <h2 className="text-lg font-semibold px-1">Knowledge Base</h2>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          <button className={`flex-1 text-xs py-1.5 rounded ${activeTab === 'files' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`} onClick={() => setActiveTab('files')}>Files</button>
          <button className={`flex-1 text-xs py-1.5 rounded ${activeTab === 'articles' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`} onClick={() => setActiveTab('articles')}>Articles</button>
        </div>

        {activeTab === 'files' ? (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">Folders</span>
              <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setShowNewFolderDialog(true)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <button
              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-muted/50 ${currentFolderId === null ? 'bg-primary/10 text-primary font-medium' : ''}`}
              onClick={() => setCurrentFolderId(null)}
            >
              <BookOpen className="h-4 w-4" /> All Files
            </button>
            {getChildren(null).map(folder => <FolderTreeItem key={folder.folder_id} folder={folder} />)}
          </>
        ) : (
          <>
            <Button variant={selectedBucket === 'all' ? 'secondary' : 'ghost'} className="w-full justify-start text-sm h-8" onClick={() => setSelectedBucket('all')}>
              <BookOpen className="h-4 w-4 mr-2" />All ({seedKBItems.length})
            </Button>
            {Object.values(KBBucket).map(b => (
              <Button key={b} variant={selectedBucket === b ? 'secondary' : 'ghost'} className="w-full justify-start text-xs h-7" onClick={() => setSelectedBucket(b)}>
                {bucketLabels[b]} ({seedKBItems.filter(k => k.bucket === b).length})
              </Button>
            ))}
          </>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'files' ? (
          <div className="p-4 md:p-6 space-y-4">
            {/* Breadcrumb + Actions */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 text-sm">
                <button className="text-primary hover:underline" onClick={() => setCurrentFolderId(null)}>Root</button>
                {breadcrumb.map(f => (
                  <span key={f.folder_id} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <button className="text-primary hover:underline" onClick={() => setCurrentFolderId(f.folder_id)}>{f.name}</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowNewFolderDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Folder
                </Button>
                {currentFolderId && (
                  <Button size="sm" onClick={() => setShowUploadDialog(true)}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile search */}
            <div className="md:hidden relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search files..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>

            {/* Subfolders */}
            {childFolders.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {childFolders.map(f => (
                  <Card key={f.folder_id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setCurrentFolderId(f.folder_id)}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <Folder className="h-8 w-8 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{getFilesInFolder(f.folder_id).length} files</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Files */}
            {(currentFolderId || searchQuery) && (
              <Card>
                <CardContent className="p-0">
                  {filteredFiles.length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                      {currentFolderId ? 'No files in this folder.' : 'Search for files...'}
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredFiles.map(file => (
                        <div key={file.file_id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                          {fileTypeIcon(file.file_type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.file_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatFileSize(file.file_size)}</span>
                              <span>•</span>
                              <span>{format(new Date(file.created_at), 'dd MMM yyyy')}</span>
                              {file.tags.length > 0 && file.tags.map(t => <Badge key={t} variant="outline" className="text-[10px] px-1 py-0">{t}</Badge>)}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { navigator.clipboard.writeText(file.file_url); toast.success('Link copied'); }}>
                              <Link2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => toast.success(`Downloading ${file.file_name}`)}>
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Root view — show top-level folders */}
            {!currentFolderId && !searchQuery && childFolders.length === 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {getChildren(null).map(f => (
                  <Card key={f.folder_id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setCurrentFolderId(f.folder_id)}>
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <Folder className="h-10 w-10 text-primary" />
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{getFilesInFolder(f.folder_id).length} files</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Articles view */
          <div className="flex flex-col md:flex-row h-full">
            <div className="w-full md:w-80 border-r border-border overflow-auto">
              <div className="p-3 space-y-2">
                {filteredArticles.map(item => (
                  <div key={item.kb_id} className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedArticleId === item.kb_id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`} onClick={() => setSelectedArticleId(item.kb_id)}>
                    <h4 className="text-sm font-medium">{item.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.content_rich_text}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {item.tags.slice(0, 3).map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {selectedArticle ? (
                <div className="p-6 max-w-3xl">
                  <Badge className="mb-2">{bucketLabels[selectedArticle.bucket]}</Badge>
                  <h1 className="text-2xl font-bold mb-4">{selectedArticle.title}</h1>
                  <Button size="sm" variant="outline" className="mb-4" onClick={() => { navigator.clipboard.writeText(selectedArticle.content_rich_text); toast.success('Copied'); }}>
                    <Copy className="h-4 w-4 mr-1" />Copy
                  </Button>
                  <div className="bg-card border rounded-lg p-6">
                    <p className="whitespace-pre-wrap text-sm">{selectedArticle.content_rich_text}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1">
                    {selectedArticle.tags.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
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

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>Create a new folder{currentFolderId ? ` inside ${getCurrentFolder()?.name}` : ' at root level'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Folder Name</Label>
              <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="e.g., Q2 Materials" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowNewFolderDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>Upload to: {getCurrentFolder()?.name ?? 'Root'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border border-dashed border-muted-foreground/30 rounded-md p-8 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Drag & drop files here</p>
              <p className="text-xs text-muted-foreground mb-3">PDF, XLSX, CSV, DOCX, PPTX, Images, JSON, TXT</p>
              <Button size="sm" onClick={() => handleUploadFile(`document_${Date.now().toString(36)}.pdf`)}>
                Simulate Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
