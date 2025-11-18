import { Button } from '../Ui/button';
import { Input } from '../Ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../Ui/select';
import {
  Circle,
  Square,
  Upload,
  Plus,
} from 'lucide-react';

// Define the props type
interface RecorderToolbarProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  onAddStep: () => void;
  onExportSteps?: () => void;
  onExportHeader?: () => void;
}

export default function RecorderToolbar({
  isRecording,
  onToggleRecording,
  onAddStep,
  onExportSteps,
  onExportHeader
}: RecorderToolbarProps) {

  return (
    <div className="flex items-center gap-2 mb-4 p-3 bg-slate-800 rounded-xl border border-slate-700">
      <Button
        onClick={onToggleRecording}
        variant={isRecording ? 'destructive' : 'outline'}
        className={`gap-2 ${isRecording
          ? 'bg-red-500/80 hover:bg-red-500'
          : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
          }`}
      >
        {isRecording ? (
          <Square className="w-4 h-4" />
        ) : (
          <Circle className="w-4 h-4 text-red-500" />
        )}
        {isRecording ? 'Stop' : 'Record'}
      </Button>

      <div className="h-6 w-px bg-slate-600"></div>

      <Button onClick={onAddStep} variant="ghost" className="gap-2 hover:bg-slate-700">
        <Plus className="w-4 h-4" />
        Add Variable
      </Button>
      {onExportSteps && (
        <Button variant="ghost" className="gap-2 hover:bg-slate-700" onClick={onExportSteps}>
          <Upload className="w-4 h-4 rotate-180" /> {/* flipped icon for export */}
          Export Process
        </Button>
      )}

       {onExportHeader && (
        <Button variant="ghost" className="gap-2 hover:bg-slate-700" onClick={onExportHeader}>
          <Upload className="w-4 h-4 rotate-180" />
          Export Header CSV
        </Button>
      )}

      <div className="flex items-center gap-2 ml-auto">
        <span className="text-sm text-slate-400">Delay:</span>
        <Input
          type="number"
          defaultValue="4"
          className="w-16 h-8 bg-slate-700 border-slate-600"
        />
        <Select defaultValue="static">
          <SelectTrigger className="w-28 h-8 bg-slate-700 border-slate-600">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-700 border-slate-600 text-white">
            <SelectItem value="static">Static</SelectItem>
            <SelectItem value="dynamic">Dynamic</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
