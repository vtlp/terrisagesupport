import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Upload, X } from 'lucide-react';

interface AttachmentUploaderProps {
  attachments: { file_name: string; file_url: string }[];
  onUpload?: (fileName: string) => void;
}

export function AttachmentUploader({ attachments, onUpload }: AttachmentUploaderProps) {
  const [showUpload, setShowUpload] = useState(false);

  const handleFakeUpload = () => {
    if (onUpload) {
      const name = `document_${Date.now()}.pdf`;
      onUpload(name);
      setShowUpload(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> Attachments ({attachments.length})
        </h4>
        {onUpload && (
          <Button variant="outline" size="sm" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-3 w-3 mr-1" /> Upload
          </Button>
        )}
      </div>
      {showUpload && (
        <div className="border border-dashed border-muted-foreground/30 rounded-md p-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">Drag & drop or click to upload</p>
          <Button size="sm" onClick={handleFakeUpload}>Simulate Upload</Button>
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => setShowUpload(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
              <Paperclip className="h-3 w-3 text-muted-foreground" />
              <span>{a.file_name}</span>
            </div>
          ))}
        </div>
      )}
      {attachments.length === 0 && !showUpload && (
        <p className="text-sm text-muted-foreground">No attachments.</p>
      )}
    </div>
  );
}
