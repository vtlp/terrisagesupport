import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Ticket, Building } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { mockTickets, mockAccounts } from '@/data/mockData';
import { StatusPill } from '@/components/tickets/StatusPill';
import { PriorityPill } from '@/components/tickets/PriorityPill';
import { formatDistanceToNow } from 'date-fns';

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filteredTickets = mockTickets.filter(
    (t) =>
      t.subject.toLowerCase().includes(query.toLowerCase()) ||
      t.id.toLowerCase().includes(query.toLowerCase())
  );

  const filteredAccounts = mockAccounts.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.company?.toLowerCase().includes(query.toLowerCase())
  );

  const hasResults = filteredTickets.length > 0 || filteredAccounts.length > 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-secondary mb-6">Search</h1>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search tickets, accounts, properties, leads..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12 h-12 text-lg"
          autoFocus
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 bg-muted/50">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            All Results
          </TabsTrigger>
          <TabsTrigger value="tickets" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Tickets
          </TabsTrigger>
          <TabsTrigger value="accounts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Accounts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {!query && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Start typing to search across all entities</p>
            </div>
          )}

          {query && !hasResults && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No results found for "{query}"</p>
            </div>
          )}

          {query && filteredTickets.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Tickets ({filteredTickets.length})
              </h3>
              <div className="bg-card rounded-lg border border-border divide-y divide-border">
                {filteredTickets.slice(0, 5).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {ticket.id}
                      </span>
                      <StatusPill status={ticket.status} />
                      <PriorityPill priority={ticket.priority} compact />
                    </div>
                    <h4 className="font-medium">{ticket.subject}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ticket.account.name} · Updated{' '}
                      {formatDistanceToNow(ticket.updatedAt, { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {query && filteredAccounts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Accounts ({filteredAccounts.length})
              </h3>
              <div className="bg-card rounded-lg border border-border divide-y divide-border">
                {filteredAccounts.slice(0, 5).map((account) => (
                  <div
                    key={account.id}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/accounts/${account.id}`)}
                  >
                    <h4 className="font-medium">{account.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {account.company} · {account.email}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tickets">
          <div className="bg-card rounded-lg border border-border divide-y divide-border">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {ticket.id}
                  </span>
                  <StatusPill status={ticket.status} />
                  <PriorityPill priority={ticket.priority} compact />
                </div>
                <h4 className="font-medium">{ticket.subject}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {ticket.account.name} · Updated{' '}
                  {formatDistanceToNow(ticket.updatedAt, { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="accounts">
          <div className="bg-card rounded-lg border border-border divide-y divide-border">
            {filteredAccounts.map((account) => (
              <div
                key={account.id}
                className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/accounts/${account.id}`)}
              >
                <h4 className="font-medium">{account.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {account.company} · {account.email}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
