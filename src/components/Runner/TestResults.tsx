import { Card, CardContent, CardHeader, CardTitle } from "../Ui/card";
import { Badge } from "../Ui/badge";
import { Button } from "../Ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../Ui/table";
import {
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from "lucide-react";

interface TestStep {
  id: number;
  name: string;
  type: string;
  selector: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration: number;
  error_message: string | null;
}

interface TestRun {
  total_steps?: number;
  passed_steps?: number;
  failed_steps?: number;
  [key: string]: any; // Additional properties if needed
}

interface TestResultsProps {
  testRun?: TestRun | null;
  steps: TestStep[];
}

export default function TestResults({ testRun, steps }: TestResultsProps) {
  const getStepIcon = (status: TestStep['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'running': return <Clock className="w-4 h-4 text-blue-400 animate-pulse" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStepStatusColor = (status: TestStep['status']) => {
    switch (status) {
      case 'passed': return 'bg-green-500/20 text-green-300';
      case 'failed': return 'bg-red-500/20 text-red-300';
      case 'running': return 'bg-blue-500/20 text-blue-300';
      default: return 'bg-slate-500/20 text-slate-300';
    }
  };

  return (
    <Card className="glass-effect bg-slate-800/30 border-slate-700/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Test Results
          </CardTitle>

          <Button
            variant="outline"
            size="sm"
            className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {testRun && (
          <div className="mb-6 p-4 bg-slate-700/30 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">
                  {testRun.total_steps || steps.length}
                </div>
                <div className="text-sm text-slate-400">Total Steps</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {testRun.passed_steps || steps.filter(s => s.status === 'passed').length}
                </div>
                <div className="text-sm text-slate-400">Passed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">
                  {testRun.failed_steps || steps.filter(s => s.status === 'failed').length}
                </div>
                <div className="text-sm text-slate-400">Failed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">
                  {Math.round((((testRun.passed_steps || 0) / (testRun.total_steps || 1)) * 100))}%
                </div>
                <div className="text-sm text-slate-400">Success Rate</div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-700/50 hover:bg-slate-700/50">
                <TableHead className="text-slate-300">Step</TableHead>
                <TableHead className="text-slate-300">Status</TableHead>
                <TableHead className="text-slate-300">Duration</TableHead>
                <TableHead className="text-slate-300">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step, index) => (
                <TableRow
                  key={index}
                  className="hover:bg-slate-700/30 border-slate-700"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {getStepIcon(step.status)}
                      <div>
                        <p className="text-white font-medium limited_word_p">
                          {step.name}
                        </p>
                        <p className="text-sm text-slate-400">
                          {step.type} • {step.selector}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={getStepStatusColor(step.status)}
                    >
                      {step.status || 'pending'}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <span className="text-slate-300">
                      {step.duration ? `${(step.duration / 1000).toFixed(1)}s` : '-'}
                    </span>
                  </TableCell>

                  <TableCell>
                    {step.error_message ? (
                      <div className="flex items-center gap-2 text-red-300">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm">{step.error_message}</span>
                      </div>
                    ) : step.status === 'passed' ? (
                      <span className="text-green-300 text-sm">Completed successfully</span>
                    ) : (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}