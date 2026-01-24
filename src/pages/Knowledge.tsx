import { useState } from 'react';
import { Search, BookOpen, Eye, ThumbsUp, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockKBArticles } from '@/data/mockData';
import { formatDistanceToNow } from 'date-fns';

export default function Knowledge() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);

  const categories = [
    { value: 'listings_inventory', label: 'Listings & Inventory' },
    { value: 'billing_plan', label: 'Billing & Plan' },
    { value: 'api_integrations', label: 'API & Integrations' },
    { value: 'onboarding_migration', label: 'Onboarding & Migration' },
    { value: 'security_access', label: 'Security & Access' },
    { value: 'compliance_legal', label: 'Compliance & Legal' },
    { value: 'performance_reliability', label: 'Performance & Reliability' },
  ];

  const filteredArticles = mockKBArticles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const article = selectedArticle
    ? mockKBArticles.find((a) => a.id === selectedArticle)
    : null;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card p-4 overflow-auto">
        <h2 className="text-lg font-semibold text-secondary mb-4">
          Knowledge Base
        </h2>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-1">
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant="ghost"
              className="w-full justify-start text-sm"
            >
              <BookOpen className="h-4 w-4 mr-2 text-muted-foreground" />
              {cat.label}
            </Button>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            All Articles
          </h3>
          <div className="space-y-2">
            {filteredArticles.map((article) => (
              <div
                key={article.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedArticle === article.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedArticle(article.id)}
              >
                <h4 className="text-sm font-medium mb-1">{article.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {article.summary}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {article.usedCount}
                  </span>
                  {article.helpfulRating && (
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {article.helpfulRating}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {article ? (
          <div className="max-w-3xl mx-auto p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
                  {article.category.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Updated {formatDistanceToNow(article.updatedAt, { addSuffix: true })}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-secondary">{article.title}</h1>
              <p className="text-muted-foreground mt-2">{article.summary}</p>
            </div>

            <div className="flex gap-2 mb-6">
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                Insert as Reply
              </Button>
              <Button size="sm" variant="outline">
                Insert as Note
              </Button>
            </div>

            <div className="prose prose-sm max-w-none">
              <div className="bg-card border border-border rounded-lg p-6">
                <p className="whitespace-pre-wrap">{article.content}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-1">
              {article.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg font-medium text-muted-foreground">
                Select an article to view
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
