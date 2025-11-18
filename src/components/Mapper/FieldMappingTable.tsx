import { Card, CardContent, CardHeader, CardTitle } from "../Ui/card";
import { Badge } from "../Ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../Ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../Ui/table";
import {
  Target,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface Field {
  field_name: string;
  mapped?: boolean;
  inputvarfields?: string;
}

interface Step {
  id: string;
  name: string;
  label: string;
  path: string | undefined;
  event: string | undefined;
}

interface Props {
  fields: Field[];
  onUpdateField: (index: number, updatedField: Partial<Field>) => void;
  recordedSteps: Step[];
}

export default function FieldMappingTable({ fields, onUpdateField, recordedSteps }: Props) {
  console.log("recordedSteps", recordedSteps);
  console.log("fields", fields);
  return (
    <Card className="glass-effect bg-slate-800/30 border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Target className="w-6 h-6 text-orange-400" />
          Field Mapping Configuration
          <Badge variant="secondary" className="ml-2 bg-orange-500/20 text-orange-300">
            {fields?.length || 0} fields
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-700/50 hover:bg-slate-700/50 border-slate-600">
                <TableHead className="text-slate-300 font-semibold">CSV HEADER</TableHead>
                {/* <TableHead className="text-slate-300 font-semibold">PREVIEW INFORMATION</TableHead> */}
                <TableHead className="text-slate-300 font-semibold text-center">MAPPED</TableHead>
                {/* <TableHead className="text-slate-300 font-semibold">IMPORT AS</TableHead> */}
                <TableHead className="text-slate-300 font-semibold">INPUT VAR FIELDS</TableHead>
                {/* <TableHead className="text-slate-300 font-semibold">MANAGE EXISTING VALUES</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields && fields.length > 0 ? (
                fields.map((field, index) => (
                  <TableRow
                    key={`${field.field_name}-${index}`}
                    className="hover:bg-slate-700/20 border-slate-700/50"
                  >
                    <TableCell className="limited_word_td">
                      <div className="font-medium text-white">
                        {field.field_name || `Field ${index + 1}`}
                      </div>
                    </TableCell>

                    {/* <TableCell>
                      <div className="text-slate-400 text-sm space-y-1">
                        {field.preview_data && field.preview_data.length > 0 ? (
                          field.preview_data.map((preview, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-orange-400/50"></div>
                              <span>{preview}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-500 italic">No preview data</span>
                        )}
                      </div>
                    </TableCell> */}

                    <TableCell className="text-center limited_word_td">
                      {field.mapped ? (
                        <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-400 mx-auto" />
                      )}
                    </TableCell>

                    {/* <TableCell>
                      <Select value="Contact properties" disabled>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-48">
                          <SelectValue />
                        </SelectTrigger>
                      </Select>
                    </TableCell> */}

                    <TableCell className="limited_word_td">
                      <Select
                        value={field.inputvarfields || ""}
                        onValueChange={(value) => {
                          //onUpdateField(index, { inputvarfields: value, mapped: !!value })
                          const selectedStep = recordedSteps.find((step) => step.label === value);

                          if (selectedStep) {
                            onUpdateField(index, {
                              inputvarfields: selectedStep.label,
                              mapped: true,
                            });
                          } else {
                            onUpdateField(index, {
                              inputvarfields: value,
                              mapped: !!value
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-full">
                          <SelectValue placeholder="Choose or create a property" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                          {/* <SelectItem value="" className="text-slate-400 hover:bg-slate-700">
                            Choose or create a property
                          </SelectItem> */}
                          {recordedSteps && recordedSteps.length > 0 ? (
                            Array.from(
                              new Map(
                                recordedSteps
                                  .filter((step) => step.label && step.label !== "open page")
                                  .map((step) => [step.label, step])
                              ).values()
                            ).map((step) => (
                              <SelectItem
                                key={step.id}
                                value={step.label}
                                className="text-white hover:bg-slate-700"
                              >
                                {step.label}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-steps" disabled className="text-slate-500 hover:bg-slate-700">
                              No recorded steps available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* <TableCell>
                      <Select value="dont_overwrite" disabled>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-40">
                          <SelectValue />
                        </SelectTrigger>
                      </Select>
                    </TableCell> */}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-300 mb-2">No Fields to Map</h3>
                    <p className="text-slate-400">
                      Upload a file to begin mapping its columns to your recorded script steps.
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
