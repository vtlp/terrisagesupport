import { useState } from 'react';
import { Search, BookOpen, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { seedKBItems } from '@/data/seedData';
import { KBBucket } from '@/types/core';
import { toast } from 'sonner';

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

export default function Knowledge() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<KBBucket | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = seedKBItems.filter(item => {
    const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content_rich_text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchBucket = selectedBucket === 'all' || item.bucket === selectedBucket;
    return matchSearch && matchBucket;
  });

  const selected = selectedId ? seedKBItems.find(k => k.kb_id === selectedId) : null;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-72 border-r border-border bg-card p-4 overflow-auto hidden md:block">
        <h2 className="text-lg font-semibold mb-4">Knowledge Base</h2>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="space-y-1 mb-4">
          <Button variant={selectedBucket === 'all' ? 'secondary' : 'ghost'} className="w-full justify-start text-sm" onClick={() => setSelectedBucket('all')}>
            <BookOpen className="h-4 w-4 mr-2" />All ({seedKBItems.length})
          </Button>
          {Object.values(KBBucket).map(b => (
            <Button key={b} variant={selectedBucket === b ? 'secondary' : 'ghost'} className="w-full justify-start text-sm" onClick={() => setSelectedBucket(b)}>
              {bucketLabels[b]} ({seedKBItems.filter(k => k.bucket === b).length})
            </Button>
          ))}
        </div>
      </div>

      {/* List + Detail */}
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="w-full md:w-80 border-r border-border overflow-auto">
          <div className="p-3 space-y-2">
            {filtered.map(item => (
              <div key={item.kb_id} className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedId === item.kb_id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`} onClick={() => setSelectedId(item.kb_id)}>
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
          {selected ? (
            <div className="p-6 max-w-3xl">
              <Badge className="mb-2">{bucketLabels[selected.bucket]}</Badge>
              <h1 className="text-2xl font-bold mb-4">{selected.title}</h1>
              <Button size="sm" variant="outline" className="mb-4" onClick={() => { navigator.clipboard.writeText(selected.content_rich_text); toast.success('Copied to clipboard'); }}>
                <Copy className="h-4 w-4 mr-1" />Copy Content
              </Button>
              <div className="bg-card border rounded-lg p-6">
                <p className="whitespace-pre-wrap text-sm">{selected.content_rich_text}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-1">
                {selected.tags.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">Select an article to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
