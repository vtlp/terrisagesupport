import { useRef, useState, forwardRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SpeechRecognitionResult { transcript: string; }
interface SpeechRecognitionEvt { results: { [k: number]: { [k: number]: SpeechRecognitionResult } }; }
interface SR { lang: string; interimResults: boolean; continuous: boolean; onresult: (e: SpeechRecognitionEvt) => void; onerror: () => void; onend: () => void; start: () => void; stop: () => void; }
type SRCtor = new () => SR;
declare global { interface Window { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor; } }

interface BaseProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}
interface TextareaPropsX extends BaseProps { as?: 'textarea'; rows?: number; }
interface InputPropsX extends BaseProps { as: 'input'; }
type Props = TextareaPropsX | InputPropsX;

export const VoiceTextarea = forwardRef<HTMLTextAreaElement | HTMLInputElement, Props>(function VoiceTextarea(props, ref) {
  const { value, onChange, placeholder, className, disabled, id } = props;
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);

  const toggle = () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { toast.error('Voice-to-text is not supported in this browser'); return; }
    if (listening && recRef.current) { recRef.current.stop(); setListening(false); return; }
    const r = new Ctor();
    r.lang = 'en-IN'; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => {
      const t = e.results[0][0].transcript;
      onChange(value ? `${value} ${t}` : t);
    };
    r.onerror = () => { setListening(false); toast.error('Voice recognition error'); };
    r.onend = () => setListening(false);
    recRef.current = r; r.start(); setListening(true);
  };

  const isInput = (props as InputPropsX).as === 'input';
  const rows = (props as TextareaPropsX).rows ?? 3;

  return (
    <div className={cn('relative', className)}>
      {isInput ? (
        <Input
          ref={ref as React.Ref<HTMLInputElement>}
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-9"
        />
      ) : (
        <Textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className="pr-9"
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggle}
        disabled={disabled}
        title={listening ? 'Stop dictation' : 'Dictate'}
        className={cn(
          'absolute top-1 right-1 h-7 w-7',
          listening && 'text-destructive',
        )}
      >
        {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
});
