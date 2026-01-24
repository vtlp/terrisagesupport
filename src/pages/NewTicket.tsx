import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockAccounts, mockQueues } from '@/data/mockData';

export default function NewTicket() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    product: '',
    market: '',
    accountId: '',
    category: '',
    priority: '',
    type: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would create the ticket
    navigate('/tickets');
  };

  const categories = [
    { value: 'listings_inventory', label: 'Listings & Inventory' },
    { value: 'billing_plan', label: 'Billing & Plan' },
    { value: 'api_integrations', label: 'API & Integrations' },
    { value: 'onboarding_migration', label: 'Onboarding & Migration' },
    { value: 'security_access', label: 'Security & Access' },
    { value: 'compliance_legal', label: 'Compliance & Legal' },
    { value: 'performance_reliability', label: 'Performance & Reliability' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-secondary">Create New Ticket</h1>
        <p className="text-muted-foreground">
          Create an internal support ticket for a customer enquiry
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <h3 className="font-semibold text-secondary">Ticket Details</h3>

          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder="Brief summary of the issue"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="product">Product *</Label>
              <Select
                value={formData.product}
                onValueChange={(v) => setFormData({ ...formData, product: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="customer_app">Customer App</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="market">Market *</Label>
              <Select
                value={formData.market}
                onValueChange={(v) => setFormData({ ...formData, market: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select market" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="lettings">Lettings</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="new_homes">New Homes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="account">Account *</Label>
            <Select
              value={formData.accountId}
              onValueChange={(v) => setFormData({ ...formData, accountId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Search for account..." />
              </SelectTrigger>
              <SelectContent className="bg-card">
                {mockAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} – {account.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority *</Label>
              <Select
                value={formData.priority}
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="P1">P1 – Critical (1h SLA)</SelectItem>
                  <SelectItem value="P2">P2 – High (4h SLA)</SelectItem>
                  <SelectItem value="P3">P3 – Medium (24h SLA)</SelectItem>
                  <SelectItem value="P4">P4 – Low (48h SLA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="type">Ticket Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => setFormData({ ...formData, type: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="incident">Incident</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Detailed description of the issue or request"
              rows={6}
              required
            />
          </div>

          <div>
            <Label>Attachments</Label>
            <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Paperclip className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag and drop files here, or click to browse
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90">
            Create Ticket
          </Button>
        </div>
      </form>
    </div>
  );
}
