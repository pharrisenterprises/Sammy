import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../Ui/card";
import { Input } from "../Ui/input";
import { Badge } from "../Ui/badge";
import { Button } from "../Ui/button";
import {
  Search,
  Target,
  CheckCircle,
  AlertCircle,
  Edit,
  Save,
  X,
} from "lucide-react";

interface Field {
  field_name: string;
  selector?: string;
  field_type: keyof typeof fieldTypeColors;
  mapped?: boolean;
}

interface FieldMappingPanelProps {
  fields: Field[];
  selectedField: number | null;
  onSelectField: (index: number) => void;
  onUpdateField: (index: number, updatedField: Partial<Field>) => void;
}

const fieldTypeColors: Record<string, string> = {
  input: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  button: "bg-green-500/20 text-green-300 border-green-500/30",
  text: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  dropdown: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  link: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  other: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export default function FieldMappingPanel({
  fields,
  selectedField,
  onSelectField,
  onUpdateField,
}: FieldMappingPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingField, setEditingField] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<Field>>({});

  const filteredFields = fields.filter(
    (field) =>
      field.field_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.field_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.selector?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEdit = (index: number, field: Field) => {
    setEditingField(index);
    setEditValues({
      field_name: field.field_name,
      selector: field.selector || "",
      field_type: field.field_type,
    });
  };

  const saveEdit = (index: number) => {
    onUpdateField(index, editValues);
    setEditingField(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValues({});
  };

  return (
    <Card className="glass-effect bg-slate-800/30 border-slate-700/50 h-full">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-400" />
          Script Fields
          <Badge
            variant="secondary"
            className="ml-2 bg-orange-500/20 text-orange-300"
          >
            {fields.length}
          </Badge>
        </CardTitle>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-auto">
          {filteredFields.map((field) => {
            const actualIndex = fields.indexOf(field);
            const isSelected = selectedField === actualIndex;
            const isEditing = editingField === actualIndex;

            return (
              <div
                key={actualIndex}
                className={`p-4 border-b border-slate-700/50 cursor-pointer transition-all duration-200 ${isSelected
                    ? "bg-blue-500/10 border-l-4 border-l-blue-500"
                    : "hover:bg-slate-700/30"
                  }`}
                onClick={() => !isEditing && onSelectField(actualIndex)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {field.mapped ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-orange-400" />
                    )}

                    {isEditing ? (
                      <Input
                        value={editValues.field_name || ""}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            field_name: e.target.value,
                          })
                        }
                        className="bg-slate-700 border-slate-600 text-white text-sm h-8"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-white font-medium">
                        {field.field_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveEdit(actualIndex);
                          }}
                          className="h-6 w-6 p-0 text-green-400 hover:bg-green-500/20"
                        >
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEdit();
                          }}
                          className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/20"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(actualIndex, field);
                        }}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-600"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Badge
                    variant="outline"
                    className={fieldTypeColors[field.field_type] || fieldTypeColors.other}
                  >
                    {field.field_type}
                  </Badge>
                  {field.mapped && (
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30" variant={undefined}>
                      Mapped
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-slate-400 font-mono bg-slate-900 p-2 rounded">
                  {isEditing ? (
                    <Input
                      value={editValues.selector || ""}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          selector: e.target.value,
                        })
                      }
                      placeholder="CSS selector or XPath"
                      className="bg-slate-800 border-slate-700 text-slate-300 text-xs h-6"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    field.selector || "No selector defined"
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredFields.length === 0 && (
          <div className="p-8 text-center">
            <Target className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400">No fields found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
