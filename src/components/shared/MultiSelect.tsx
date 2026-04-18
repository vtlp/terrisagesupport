import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  className,
  disabled,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter(v => v !== value));
    else onChange([...selected, value]);
  };

  const remove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(v => v !== value));
  };

  const labelFor = (v: string) => options.find(o => o.value === v)?.label ?? v;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-auto min-h-10 w-full justify-between font-normal',
            selected.length === 0 && 'text-muted-foreground',
            className,
          )}
        >
          <div className="flex flex-wrap gap-1 py-0.5">
            {selected.length === 0 ? (
              <span>{placeholder}</span>
            ) : (
              selected.map(v => (
                <Badge key={v} variant="secondary" className="gap-1 pr-1">
                  {labelFor(v)}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => remove(v, e)}
                    className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {options.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No options</p>
            ) : (
              options.map(opt => {
                const isSelected = selected.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggle(opt.value)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
                  >
                    <div className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-sm border',
                      isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input',
                    )}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="flex-1">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
