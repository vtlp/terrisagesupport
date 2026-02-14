import { useState, useMemo } from 'react';
import {
  Search, FolderOpen, Folder, FileText, FileSpreadsheet, Image, FileJson,
  File, Upload, Plus, ChevronRight, Download, Eye, Trash2, BookOpen, Copy,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { seedKBFolders, seedKBFiles, seedKBItems } from '@/data/seedData';
import { KBBucket, KBFileType } from '@/types/core';
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

const fileTypeIcons: Record<KBFileType, React.ReactNode> = {
  [KBFileType.PDF]: <FileText className="h-4 w-4 text-destructive" />,
  [KBFileType.XLSX]: <FileSpreadsheet className="h-4 w-4 text-success" />,
  [KBFileType.CSV]: <FileSpreadsheet className="h-4 w-4 text-info" />,
  [KBFileType.DOCX]: <FileText className="h-4 w-4 text-info" />,
  [KBFileType.PPTX]: <FileText className="h-4 w-4 text-warning" />,
  [KBFileType.PNG]: <Image className="h-4 w-4 text-primary" />,
  [KBFileType.JPG]: <Image className="h-4 w-4 text-primary" />,
  [KBFileType.JSON]: <FileJson className="h-4 w-4 text-warning" />,
  [KBFileType.TXT]: <File className="h-4 w-4 text-muted-foreground" />,
  [KBFileType.OTHER]: <File className="h-4 w-4 text-muted-foreground" />,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

type ViewMode = 'files' | 'articles';

export default function Knowledge() {
  const [viewMode, setViewMode] = useState<ViewMode>('files');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Article mode state
  const [selectedBucket, setSelectedBucket] = useState<KBBucket | 'all'>('all');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // ── Folders ──
  const [folders, setFolders] = useState<KBFolder[]>(seedKBFolders);
  const [files, setFiles] = useState<KBFile[]>(seedKBFiles);

  const rootFolders = useMemo(() => folders.filter(f => f.parent_folder_id === null), [folders]);
  const getSubFolders = (parentId: string) => folders.filter(f => f.parent_folder_id === parentId);

  const currentFiles = useMemo(() => {
    let filtered = selectedFolderId
      ? files.filter(f => f.folder_id === selectedFolderId)
      : files;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter(f => f.file_type === typeFilter);
    }
    return filtered;
  }, [files, selectedFolderId, searchQuery, typeFilter]);

  const selectedFile = selectedFileId ? files.find(f => f.id === selectedFileId) : null;
  const selectedFolder = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;

  // Breadcrumb
  const getBreadcrumb = (folderId: string | null): KBFolder[] => {
    if (!folderId) return [];
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    return [...getBreadcrumb(folder.parent_folder_id), folder];
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder: KBFolder = {
      id: `FLD_${Date.now()}`,
      name: newFolderName.trim(),
      parent_folder_id: selectedFolderId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setFolders(prev => [...prev, newFolder]);
    setNewFolderName('');
    setShowNewFolder(false);
    toast.success(`Folder "${newFolder.name}" created`);
  };

  const handleSimulateUpload = (fileName: string, fileType: KBFileType) => {
    const newFile: KBFile = {
      id: `KBF_${Date.now()}`,
      folder_id: selectedFolderId ?? rootFolders[0]?.id ?? 'FLD001',
      title: fileName,
      file_type: fileType,
      storage_url: '#',
      tags: [],
      description: '',
      version: 1,
      size_bytes: Math.floor(Math.random() * 5000000) + 50000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setFiles(prev => [...prev, newFile]);
    setShowUpload(false);
    toast.success(`"${fileName}" uploaded`);
  };

  const handleDeleteFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    if (selectedFileId === fileId) setSelectedFileId(null);
    toast.success('File removed');
  };

  // ── Article filtering ──
  const filteredArticles = seedKBItems.filter(item => {
    const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content_rich_text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchBucket = selectedBucket === 'all' || item.bucket === selectedBucket;
    return matchSearch && matchBucket;
  });
  const selectedArticle = selectedArticleId ? seedKBItems.find(k => k.kb_id === selectedArticleId) : null;

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-border bg-card overflow-auto hidden md:flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground mb-3">Knowledge Base</h2>
          <div className="flex gap-1 mb-3">
            <Button
              variant={viewMode === 'files' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setViewMode('files')}
            >
              Files
            </Button>
            <Button
              variant={viewMode === 'articles' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setViewMode('articles')}
            >
              Articles
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </div>

        {viewMode === 'files' ? (
          <div className="flex-1 overflow-auto p-2">
            {/* All files */}
            <button
              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                selectedFolderId === null ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
              }`}
              onClick={() => { setSelectedFolderId(null); setSelectedFileId(null); }}
            >
              <FolderOpen className="h-4 w-4" /> All Files
              <span className="text-xs text-muted-foreground ml-auto">{files.length}</span>
            </button>

            {/* Folder tree */}
            <div className="mt-1 space-y-0.5">
              {rootFolders.map(folder => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  files={files}
                  folders={folders}
                  selectedId={selectedFolderId}
                  onSelect={(id) => { setSelectedFolderId(id); setSelectedFileId(null); }}
                  getSubFolders={getSubFolders}
                  depth={0}
                />
              ))}
            </div>

            <Button variant="ghost" size="sm" className="w-full justify-start text-xs mt-2 text-muted-foreground" onClick={() => setShowNewFolder(true)}>
              <Plus className="h-3 w-3 mr-1" /> New Folder
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-2 space-y-0.5">
            <button
              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm ${
                selectedBucket === 'all' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
              }`}
              onClick={() => setSelectedBucket('all')}
            >
              <BookOpen className="h-4 w-4" /> All ({seedKBItems.length})
            </button>
            {Object.values(KBBucket).map(b => (
              <button
                key={b}
                className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm ${
                  selectedBucket === b ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
                }`}
                onClick={() => setSelectedBucket(b)}
              >
                {bucketLabels[b]} ({seedKBItems.filter(k => k.bucket === b).length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'files' ? (
          <>
            {/* Toolbar */}
            <div className="border-b border-border p-3 flex items-center gap-2 flex-wrap">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-sm flex-1 min-w-0">
                <button className="text-muted-foreground hover:text-foreground" onClick={() => { setSelectedFolderId(null); setSelectedFileId(null); }}>All</button>
                {getBreadcrumb(selectedFolderId).map(f => (
                  <span key={f.id} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <button className="text-muted-foreground hover:text-foreground truncate max-w-[120px]" onClick={() => { setSelectedFolderId(f.id); setSelectedFileId(null); }}>
                      {f.name}
                    </button>
                  </span>
                ))}
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.values(KBFileType).map(t => (
                    <SelectItem key={t} value={t}>.{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
            </div>

            {/* File list + Preview */}
            <div className="flex-1 flex overflow-hidden">
              {/* File list */}
              <div className="w-full md:w-96 border-r border-border overflow-auto">
                {currentFiles.length === 0 ? (
                  <div className="p-6 text-center">
                    <File className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No files in this location</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowUpload(true)}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Upload file
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {currentFiles.map(file => (
                      <button
                        key={file.id}
                        className={`w-full text-left p-3 transition-colors ${
                          selectedFileId === file.id ? 'bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedFileId(file.id)}
                      >
                        <div className="flex items-start gap-2.5">
                          {fileTypeIcons[file.file_type]}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{file.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>.{file.file_type}</span>
                              <span>{formatBytes(file.size_bytes)}</span>
                              <span>{format(new Date(file.updated_at), 'dd MMM')}</span>
                            </div>
                            {file.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {file.tags.slice(0, 3).map(t => (
                                  <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview pane */}
              <div className="hidden md:flex flex-1 overflow-auto">
                {selectedFile ? (
                  <div className="p-6 w-full max-w-2xl">
                    <div className="flex items-start gap-3 mb-4">
                      {fileTypeIcons[selectedFile.file_type]}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{selectedFile.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span>.{selectedFile.file_type}</span>
                          <span>{formatBytes(selectedFile.size_bytes)}</span>
                          <span>v{selectedFile.version}</span>
                          <span>{format(new Date(selectedFile.updated_at), 'dd MMM yyyy')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <Button size="sm" variant="outline">
                        <Download className="h-3.5 w-3.5 mr-1" /> Download
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteFile(selectedFile.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </div>

                    {selectedFile.description && (
                      <p className="text-sm text-muted-foreground mb-4">{selectedFile.description}</p>
                    )}

                    {selectedFile.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {selectedFile.tags.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
                      </div>
                    )}

                    {/* Inline preview for text/json */}
                    {(selectedFile.file_type === KBFileType.JSON || selectedFile.file_type === KBFileType.TXT) && (
                      <Card>
                        <CardContent className="p-4">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                            {`// Preview of ${selectedFile.title}\n// Content would render here in a live environment`}
                          </pre>
                        </CardContent>
                      </Card>
                    )}

                    {/* Image preview placeholder */}
                    {(selectedFile.file_type === KBFileType.PNG || selectedFile.file_type === KBFileType.JPG) && (
                      <div className="border border-border rounded-lg p-8 text-center bg-muted/30">
                        <Image className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Image preview would display here</p>
                      </div>
                    )}

                    {/* PDF preview placeholder */}
                    {selectedFile.file_type === KBFileType.PDF && (
                      <div className="border border-border rounded-lg p-8 text-center bg-muted/30">
                        <FileText className="h-12 w-12 mx-auto text-destructive/50 mb-2" />
                        <p className="text-sm text-muted-foreground">PDF preview would display here</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Select a file to preview</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Articles view */
          <div className="flex-1 flex overflow-hidden">
            <div className="w-full md:w-80 border-r border-border overflow-auto">
              <div className="p-3 space-y-2">
                {filteredArticles.map(item => (
                  <div
                    key={item.kb_id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedArticleId === item.kb_id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedArticleId(item.kb_id)}
                  >
                    <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
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
                  <h1 className="text-xl font-bold text-foreground mb-4">{selectedArticle.title}</h1>
                  <Button size="sm" variant="outline" className="mb-4" onClick={() => { navigator.clipboard.writeText(selectedArticle.content_rich_text); toast.success('Copied to clipboard'); }}>
                    <Copy className="h-4 w-4 mr-1" /> Copy Content
                  </Button>
                  <div className="bg-card border border-border rounded-lg p-6">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{selectedArticle.content_rich_text}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1">
                    {selectedArticle.tags.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Select an article to view</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              {selectedFolder ? `Inside "${selectedFolder.name}"` : 'At root level'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Folder name</Label>
            <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="e.g. Q1 Reports" />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowNewFolder(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              {selectedFolder ? `To "${selectedFolder.name}"` : 'To root'}
            </DialogDescription>
          </DialogHeader>
          <UploadForm onUpload={handleSimulateUpload} onCancel={() => setShowUpload(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Folder Tree Item ── */
function FolderTreeItem({
  folder, files, folders, selectedId, onSelect, getSubFolders, depth,
}: {
  folder: KBFolder;
  files: KBFile[];
  folders: KBFolder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getSubFolders: (id: string) => KBFolder[];
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const subs = getSubFolders(folder.id);
  const fileCount = files.filter(f => f.folder_id === folder.id).length;

  return (
    <div>
      <button
        className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
          selectedId === folder.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
        }`}
        style={{ paddingLeft: `${(depth * 12) + 8}px` }}
        onClick={() => { onSelect(folder.id); setExpanded(true); }}
      >
        {subs.length > 0 && (
          <ChevronRight
            className={`h-3 w-3 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          />
        )}
        {selectedId === folder.id ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
        <span className="truncate flex-1">{folder.name}</span>
        {fileCount > 0 && <span className="text-xs text-muted-foreground">{fileCount}</span>}
      </button>
      {expanded && subs.map(sub => (
        <FolderTreeItem
          key={sub.id}
          folder={sub}
          files={files}
          folders={folders}
          selectedId={selectedId}
          onSelect={onSelect}
          getSubFolders={getSubFolders}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

/* ── Upload Form ── */
function UploadForm({ onUpload, onCancel }: { onUpload: (name: string, type: KBFileType) => void; onCancel: () => void }) {
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<KBFileType>(KBFileType.PDF);

  return (
    <div className="space-y-3">
      <div className="border border-dashed border-muted-foreground/30 rounded-md p-6 text-center">
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground mb-1">
          Accepted: PDF, Excel, CSV, Word, PowerPoint, Images, JSON, Text
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">File name (simulate)</Label>
        <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="report.pdf" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">File type</Label>
        <Select value={fileType} onValueChange={v => setFileType(v as KBFileType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.values(KBFileType).map(t => (
              <SelectItem key={t} value={t}>.{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onUpload(fileName || `file_${Date.now()}.${fileType}`, fileType)} disabled={!fileName.trim()}>Upload</Button>
      </div>
    </div>
  );
}
