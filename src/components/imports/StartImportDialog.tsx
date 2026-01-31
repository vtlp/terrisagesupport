import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Upload, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { mockAccounts } from '@/data/mockData';

type ImportType = 'leads' | 'listings' | 'inventory' | 'enquiries';
type Step = 'type' | 'account' | 'upload' | 'mapping' | 'review';

interface StartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const importTypes: { value: ImportType; label: string; description: string }[] = [
  { value: 'leads', label: 'Leads', description: 'Contact information and lead data' },
  { value: 'listings', label: 'Listings', description: 'Property listings and details' },
  { value: 'inventory', label: 'Inventory', description: 'Unit inventory for projects' },
  { value: 'enquiries', label: 'Enquiries', description: 'Customer enquiries and requests' },
];

const sampleFields: Record<ImportType, string[]> = {
  leads: ['Name', 'Phone', 'Email', 'Source', 'Budget', 'Property Type', 'Location'],
  listings: ['Property Name', 'Locality', 'Price', 'Bedrooms', 'Area (sqft)', 'Type'],
  inventory: ['Unit ID', 'Project', 'Floor', 'Unit Type', 'Status', 'Price'],
  enquiries: ['Customer Name', 'Phone', 'Property', 'Enquiry Date', 'Notes'],
};

export function StartImportDialog({ open, onOpenChange }: StartImportDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('type');
  const [importType, setImportType] = useState<ImportType>('leads');
  const [accountId, setAccountId] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const steps: Step[] = ['type', 'account', 'upload', 'mapping', 'review'];
  const currentStepIndex = steps.indexOf(step);

  const resetDialog = () => {
    setStep('type');
    setImportType('leads');
    setAccountId('');
    setFileName('');
    setMappings({});
    setUploadProgress(0);
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setIsUploading(true);
      
      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          // Initialize mappings with detected fields
          const fields = sampleFields[importType];
          const newMappings: Record<string, string> = {};
          fields.forEach(field => {
            newMappings[field] = field.toLowerCase().replace(/\s+/g, '_');
          });
          setMappings(newMappings);
        }
      }, 100);
    }
  };

  const handleStartImport = () => {
    toast.success('Import started successfully!', {
      description: `Importing ${importType} data for ${mockAccounts.find(a => a.id === accountId)?.name}`,
    });
    handleClose();
    navigate('/imports');
  };

  const canProceed = () => {
    switch (step) {
      case 'type':
        return !!importType;
      case 'account':
        return !!accountId;
      case 'upload':
        return !!fileName && !isUploading;
      case 'mapping':
        return Object.keys(mappings).length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Start Import
          </DialogTitle>
          <DialogDescription>
            Import data from CSV or Excel files
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-4">
          {steps.map((s, index) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index < currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : index === currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index < currentStepIndex ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {/* Step 1: Select Import Type */}
          {step === 'type' && (
            <div className="space-y-4">
              <Label className="text-base font-medium">What would you like to import?</Label>
              <RadioGroup
                value={importType}
                onValueChange={(value) => setImportType(value as ImportType)}
                className="grid grid-cols-2 gap-3"
              >
                {importTypes.map((type) => (
                  <div key={type.value}>
                    <RadioGroupItem
                      value={type.value}
                      id={type.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={type.value}
                      className="flex flex-col items-start gap-1 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                    >
                      <span className="font-medium">{type.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {type.description}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 2: Select Account */}
          {step === 'account' && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Select Account</Label>
              <p className="text-sm text-muted-foreground">
                Choose the account this import belongs to
              </p>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  {mockAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} - {account.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 3: Upload File */}
          {step === 'upload' && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Upload your file</Label>
              <p className="text-sm text-muted-foreground">
                Supported formats: CSV, XLS, XLSX (max 10MB)
              </p>
              
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                {!fileName ? (
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <Label
                        htmlFor="file-upload"
                        className="cursor-pointer text-primary hover:underline"
                      >
                        Click to upload
                      </Label>
                      <span className="text-muted-foreground"> or drag and drop</span>
                    </div>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
                    <p className="font-medium">{fileName}</p>
                    {isUploading ? (
                      <div className="max-w-xs mx-auto space-y-2">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-sm text-muted-foreground">
                          Uploading... {uploadProgress}%
                        </p>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFileName('');
                          setUploadProgress(0);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Field Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Map your fields</Label>
              <p className="text-sm text-muted-foreground">
                Match columns from your file to system fields
              </p>
              
              <div className="border rounded-lg divide-y max-h-[250px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 font-medium text-sm">
                  <span>Your Column</span>
                  <span>System Field</span>
                </div>
                {sampleFields[importType].map((field) => (
                  <div key={field} className="grid grid-cols-2 gap-4 p-3 items-center">
                    <span className="text-sm">{field}</span>
                    <Select
                      value={mappings[field] || ''}
                      onValueChange={(value) =>
                        setMappings({ ...mappings, [field]: value })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {sampleFields[importType].map((f) => (
                          <SelectItem
                            key={f}
                            value={f.toLowerCase().replace(/\s+/g, '_')}
                          >
                            {f}
                          </SelectItem>
                        ))}
                        <SelectItem value="skip">Skip this column</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Review Import</Label>
              <p className="text-sm text-muted-foreground">
                Please review the details before starting the import
              </p>
              
              <div className="border rounded-lg divide-y">
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">Import Type</span>
                  <span className="font-medium capitalize">{importType}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">Account</span>
                  <span className="font-medium">
                    {mockAccounts.find((a) => a.id === accountId)?.name}
                  </span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">File</span>
                  <span className="font-medium">{fileName}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">Mapped Fields</span>
                  <span className="font-medium">{Object.keys(mappings).length}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-muted border border-border rounded-lg">
                <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Duplicate Detection
                  </p>
                  <p className="text-muted-foreground">
                    The system will automatically detect and flag duplicates during import.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={step === 'type' ? handleClose : handleBack}
          >
            {step === 'type' ? (
              'Cancel'
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </>
            )}
          </Button>
          
          {step === 'review' ? (
            <Button onClick={handleStartImport}>
              <FileUp className="h-4 w-4 mr-1" />
              Start Import
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
