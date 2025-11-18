import { Card, CardContent, CardHeader, CardTitle } from "../Ui/card";
import { Button } from "../Ui/button";
import { Badge } from "../Ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../Ui/table";
import {
  BarChart3,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
} from "lucide-react";

// Define field type
type FieldType = "input" | "button" | "text" | "dropdown" | "link" | "other";

interface Field {
  mapped: boolean;
  field_name: string;
  field_type: FieldType;
  selector?: string;
}

interface MappingSummaryProps {
  fields: Field[];
  onUpdateField: (index: number, updatedField: Field) => void;
}

const fieldTypeColors: Record<FieldType, string> = {
  input: "bg-blue-500/20 text-blue-300",
  button: "bg-green-500/20 text-green-300",
  text: "bg-purple-500/20 text-purple-300",
  dropdown: "bg-orange-500/20 text-orange-300",
  link: "bg-pink-500/20 text-pink-300",
  other: "bg-slate-500/20 text-slate-300",
};

export default function MappingSummary({ fields }: MappingSummaryProps) {
  const mappedCount = fields.filter(f => f.mapped).length;
  const totalFields = fields.length;
  const completionRate = totalFields > 0 ? Math.round((mappedCount / totalFields) * 100) : 0;

  return (
    <Card className="glass-effect bg-slate-800/30 border-slate-700/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Mapping Summary
          </CardTitle>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-slate-400">Completion Rate</div>
              <div className="text-2xl font-bold text-white">{completionRate}%</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Fields Mapped</div>
              <div className="text-2xl font-bold text-green-400">
                {mappedCount}/{totalFields}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-700/50 hover:bg-slate-700/50">
                <TableHead className="text-slate-300">Status</TableHead>
                <TableHead className="text-slate-300">Field Name</TableHead>
                <TableHead className="text-slate-300">Type</TableHead>
                <TableHead className="text-slate-300">Selector</TableHead>
                <TableHead className="text-slate-300">Confidence</TableHead>
                <TableHead className="text-slate-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow
                  key={index}
                  className="hover:bg-slate-700/30 border-slate-700"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {field.mapped ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-orange-400" />
                      )}
                      <span className={`text-sm ${field.mapped ? 'text-green-300' : 'text-orange-300'}`}>
                        {field.mapped ? 'Mapped' : 'Pending'}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-white font-medium">
                      {field.field_name}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={fieldTypeColors[field.field_type] || fieldTypeColors.other}
                    >
                      {field.field_type}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <code className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">
                      {field.selector || 'Not defined'}
                    </code>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${field.mapped
                            ? 'bg-green-500'
                            : 'bg-orange-500'
                            }`}
                          style={{
                            width: field.mapped ? '100%' : '60%'
                          }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">
                        {field.mapped ? '100%' : '60%'}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-600"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
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
