
import { Card, CardContent, CardHeader, CardTitle } from "../Ui/card";
import {
  FileCode,
  Play,
  CheckCircle,
  TrendingUp,
  LucideIcon,
} from "lucide-react";

// Define expected types for props
type Project = {
  status: string;
};

type TestRun = {
  status: string;
};

type ProjectStatsProps = {
  projects: Project[];
  testRuns: TestRun[];
};

// Component
export default function ProjectStats({ projects, testRuns }: ProjectStatsProps) {
  // Define stat card structure
  const stats: {
    title: string;
    value: number | string;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
  }[] = [
      {
        title: "Total Process",
        value: projects.length,
        icon: FileCode,
        color: "text-blue-400",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/20",
      },
      {
        title: "Active Tests",
        value: projects.filter((p) => p.status === "testing").length,
        icon: Play,
        color: "text-green-400",
        bgColor: "bg-green-500/10",
        borderColor: "border-green-500/20",
      },
      {
        title: "Completed",
        value: projects.filter((p) => p.status === "completed").length,
        icon: CheckCircle,
        color: "text-purple-400",
        bgColor: "bg-purple-500/10",
        borderColor: "border-purple-500/20",
      },
      {
        title: "Success Rate",
        value:
          testRuns.length > 0
            ? `${Math.round(
              (testRuns.filter((r) => r.status === "completed").length /
                testRuns.length) *
              100
            )}%`
            : "0%",
        icon: TrendingUp,
        color: "text-orange-400",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/20",
      },
    ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className={`glass-effect bg-slate-800/30 border ${stat.borderColor} hover:border-opacity-50 transition-all duration-200`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              {stat.title}
            </CardTitle>
            <div className={`${stat.bgColor} p-2 rounded-lg`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
