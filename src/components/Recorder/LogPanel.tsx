import { Card, CardContent, CardHeader } from '../Ui/card';
import { Button } from '../Ui/button';
import { Terminal, Trash2 } from 'lucide-react';

// Define the shape of a single log item
type LogItem = {
  timestamp: string;
  message: string;
  level: 'info' | 'error' | 'success';
};

// Props type
interface LogPanelProps {
  logs: LogItem[];
  onClear: () => void;
}

export default function LogPanel({ logs, onClear }: LogPanelProps) {
  return (
    <Card className="glass-effect bg-slate-800/30 border-slate-700/50 mt-4">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Logs</h3>
        </div>
        <Button onClick={onClear} variant="ghost" size="sm" className="gap-2">
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-slate-900 font-mono text-sm p-4 h-32 overflow-auto">
          {logs.map((log, index) => (
            <div key={index} className="flex gap-4">
              <span className="text-slate-500">{log.timestamp}</span>
              <span
                className={
                  log.level === 'error'
                    ? 'text-red-400 overflow-wrap-anywhere'
                    : log.level === 'success'
                      ? 'text-green-400 overflow-wrap-anywhere'
                      : 'text-slate-300 overflow-wrap-anywhere'
                }
              >
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
