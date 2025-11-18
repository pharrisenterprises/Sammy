import { Card, CardContent, CardHeader, CardTitle } from "../Ui/card";
import { Badge } from "../Ui/badge";
import {
  List,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Play
} from "lucide-react";

interface TestStep {
  id?: number;
  name: string;
  type: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration: number;
  error_message?: string | null;
}

interface TestStepsProps {
  steps: TestStep[];
  isRunning: boolean;
}

export default function TestSteps({ steps }: TestStepsProps) {
  console.log("TestSteps >>> steps >>", steps);
  const getStepIcon = (status: TestStep['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'running': return <Activity className="w-4 h-4 text-blue-400 animate-pulse" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStepStatusColor = (status: TestStep['status']) => {
    switch (status) {
      case 'passed': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'failed': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'running': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <Card className="glass-effect bg-slate-800/30 border-slate-700/50 h-fit">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <List className="w-5 h-5 text-blue-400" />
          Record Steps
          <Badge variant="secondary" className="ml-2 bg-blue-500/20 text-blue-300">
            {steps.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="space-y-1 max-h-96 overflow-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`p-4 border-b border-slate-700/50 transition-all duration-200 ${step.status === 'running'
                  ? 'bg-blue-500/10 border-l-4 border-l-blue-500'
                  : step.status === 'passed'
                    ? 'bg-green-500/5'
                    : step.status === 'failed'
                      ? 'bg-red-500/5'
                      : 'hover:bg-slate-700/30'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {getStepIcon(step.status)}
                  <span className="text-white font-medium text-sm">
                    Step {index + 1}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={getStepStatusColor(step.status)}
                >
                  {step.status || 'pending'}
                </Badge>
              </div>

              <p className="text-slate-300 text-sm mb-2">
                {step.name}
              </p>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{step.type}</span>
                {step.duration > 0 && (
                  <span>{(step.duration / 1000).toFixed(1)}s</span>
                )}
              </div>

              {step.error_message && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                  {step.error_message}
                </div>
              )}
            </div>
          ))}
        </div>

        {steps.length === 0 && (
          <div className="p-8 text-center">
            <Play className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400">No test steps defined</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}