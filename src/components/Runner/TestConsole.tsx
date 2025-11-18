import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../Ui/card";
import { Badge } from "../Ui/badge";
import { Terminal, Activity } from "lucide-react";

type LogLevel = 'info' | 'success' | 'warning' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface TestConsoleProps {
  logs: LogEntry[];
  isRunning: boolean;
}

const logLevelColors: Record<LogLevel, string> = {
  info: "text-blue-300",
  success: "text-green-300",
  warning: "text-orange-300",
  error: "text-red-300"
};

export default function TestConsole({ logs, isRunning }: TestConsoleProps) {
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="glass-effect bg-slate-800/30 border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-green-400" />
          Test Console
          {isRunning && (
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 animate-pulse" variant={undefined}>
              <Activity className="w-3 h-3 mr-1" />
              Running
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={consoleRef}
          className="bg-slate-900 font-mono text-sm p-4 h-96 overflow-auto"
        >
          {logs.length === 0 ? (
            <div className="text-slate-500 italic">
              Console output will appear here when test starts...
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1 flex items-start gap-3">
                <span className="text-slate-500 text-xs min-w-[60px]">
                  {log.timestamp}
                </span>
                <span className={`${logLevelColors[log.level]} flex-1`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          {isRunning && (
            <div className="flex items-center gap-2 text-green-400 animate-pulse">
              <Activity className="w-4 h-4" />
              <span>Test execution in progress...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}