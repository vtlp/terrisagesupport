import { useState } from 'react';
import { Search, FileText, Play, Edit, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockMacros } from '@/data/mockData';

export default function Macros() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);

  const filteredMacros = mockMacros.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const macro = selectedMacro
    ? mockMacros.find((m) => m.id === selectedMacro)
    : null;

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-80 border-r border-border bg-card p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-secondary">Macros</h2>
          <Button size="sm" className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search macros..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-2">
          {filteredMacros.map((m) => (
            <div
              key={m.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedMacro === m.id
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-muted/50 border border-transparent'
              }`}
              onClick={() => setSelectedMacro(m.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium">{m.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.description}
                  </p>
                </div>
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {m.category}
                </Badge>
                {m.statusTransition && (
                  <Badge variant="secondary" className="text-xs bg-accent/20 text-accent-foreground">
                    → {m.statusTransition.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto">
        {macro ? (
          <div className="max-w-2xl mx-auto p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-secondary">{macro.name}</h1>
                <p className="text-muted-foreground mt-1">{macro.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Play className="h-4 w-4 mr-1" />
                  Apply
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-2">Reply Template</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {macro.replyTemplate}
                </p>
              </div>

              {macro.internalNoteTemplate && (
                <div className="bg-warning/5 border border-warning/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-2">Internal Note Template</h3>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {macro.internalNoteTemplate}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{macro.category}</Badge>
                {macro.statusTransition && (
                  <Badge className="bg-accent/20 text-accent-foreground border-accent/30">
                    Sets status: {macro.statusTransition.replace('_', ' ')}
                  </Badge>
                )}
                {macro.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg font-medium text-muted-foreground">
                Select a macro to view
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Use macros to quickly reply to common enquiries
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
