import { useState, useEffect } from 'react';
import { GitBranch } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { Queue, Category, Product } from '@/types/support';
import { toast } from 'sonner';

interface QueueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue?: Queue | null;
  onSave: (queue: Partial<Queue>) => void;
}

const categoryOptions: { value: Category; label: string }[] = [
  { value: 'listings_inventory', label: 'Listings & Inventory' },
  { value: 'billing_plan', label: 'Billing & Plan' },
  { value: 'api_integrations', label: 'API & Integrations' },
  { value: 'onboarding_migration', label: 'Onboarding & Migration' },
  { value: 'security_access', label: 'Security & Access' },
  { value: 'compliance_legal', label: 'Compliance & Legal' },
  { value: 'performance_reliability', label: 'Performance & Reliability' },
  { value: 'other', label: 'Other' },
];

const productOptions: { value: Product; label: string }[] = [
  { value: 'crm', label: 'CRM' },
  { value: 'customer_app', label: 'Customer App' },
];

export function QueueFormDialog({ open, onOpenChange, queue, onSave }: QueueFormDialogProps) {
  const isEditing = !!queue;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categories: [] as Category[],
    products: [] as Product[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (queue) {
      setFormData({
        name: queue.name,
        description: queue.description || '',
        categories: queue.categories,
        products: queue.products || [],
      });
    } else {
      setFormData({
        name: '',
        description: '',
        categories: [],
        products: [],
      });
    }
    setErrors({});
  }, [queue, open]);

  const handleCategoryToggle = (category: Category) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  };

  const handleProductToggle = (product: Product) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.includes(product)
        ? prev.products.filter(p => p !== product)
        : [...prev.products, product],
    }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Queue name is required';
    }

    if (formData.categories.length === 0) {
      newErrors.categories = 'Select at least one category';
    }

    if (formData.products.length === 0) {
      newErrors.products = 'Select at least one product';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    onSave({
      id: queue?.id || `q${Date.now()}`,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      categories: formData.categories,
      products: formData.products,
    });

    toast.success(isEditing ? 'Queue updated' : 'Queue created', {
      description: `"${formData.name}" has been ${isEditing ? 'updated' : 'created'} successfully`,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            {isEditing ? 'Edit Queue' : 'Create New Queue'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the queue settings and routing categories'
              : 'Set up a new queue to route tickets based on category and product'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Queue Name */}
          <div className="space-y-2">
            <Label htmlFor="queue-name">Queue Name *</Label>
            <Input
              id="queue-name"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Technical Support"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="queue-description">Description</Label>
            <Textarea
              id="queue-description"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of what this queue handles..."
              rows={2}
            />
          </div>

          <Separator />

          {/* Categories */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Ticket Categories *</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Tickets with these categories will be routed to this queue
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categoryOptions.map(cat => (
                <div
                  key={cat.value}
                  className={`flex items-center gap-2 p-2 rounded-md border transition-colors cursor-pointer ${
                    formData.categories.includes(cat.value)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => handleCategoryToggle(cat.value)}
                >
                  <Checkbox
                    id={`cat-${cat.value}`}
                    checked={formData.categories.includes(cat.value)}
                    onCheckedChange={() => handleCategoryToggle(cat.value)}
                  />
                  <label
                    htmlFor={`cat-${cat.value}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {cat.label}
                  </label>
                </div>
              ))}
            </div>
            {errors.categories && (
              <p className="text-sm text-destructive">{errors.categories}</p>
            )}
          </div>

          <Separator />

          {/* Products */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Products *</Label>
              <p className="text-xs text-muted-foreground mt-1">
                This queue handles tickets for these products
              </p>
            </div>
            <div className="flex gap-3">
              {productOptions.map(prod => (
                <div
                  key={prod.value}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors cursor-pointer ${
                    formData.products.includes(prod.value)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => handleProductToggle(prod.value)}
                >
                  <Checkbox
                    id={`prod-${prod.value}`}
                    checked={formData.products.includes(prod.value)}
                    onCheckedChange={() => handleProductToggle(prod.value)}
                  />
                  <label
                    htmlFor={`prod-${prod.value}`}
                    className="text-sm cursor-pointer uppercase font-medium"
                  >
                    {prod.label}
                  </label>
                </div>
              ))}
            </div>
            {errors.products && (
              <p className="text-sm text-destructive">{errors.products}</p>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90">
              {isEditing ? 'Save Changes' : 'Create Queue'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
