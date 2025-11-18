import { useState, useEffect } from "react";
import { Button } from "../components/Ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/Ui/card";
import { Input } from "../components/Ui/input";
import stringSimilarity from "string-similarity";
import {
  MapPin,
  Save,
  RefreshCw,
  AlertCircle,
  Play,
  ArrowRight,
  Zap,
  FileSpreadsheet,
  CheckCircle
} from "lucide-react";
import { Alert, AlertDescription } from "../components/Ui/alert";
import { createPageUrl } from "../utils/index";
import FieldMappingTable from "../components/Mapper/FieldMappingTable";
import Papa from "papaparse";

interface Field {
  field_name: string;
  mapped: boolean;
  inputvarfields: string;
}

interface RecordedStep {
  name?: string;
  [key: string]: any;
}

interface ProjectType {
  id: string;
  name: string;
  recorded_steps?: RecordedStep[];
  parsed_fields?: Field[];
  csv_data?: Field[];
  target_url?: string;
  status?: string;
}

export default function FieldMapper() {
  const [currentProject, setCurrentProject] = useState<ProjectType | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [, setCsvdata] = useState<[]>([]);
  const [recordedSteps, setRecordedSteps] = useState<RecordedStep[]>([]);
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [isMapping, setIsMapping] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploadingCSV, setIsUploadingCSV] = useState<boolean>(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  console.log(projectId);
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.split("?")[1]);
    const projectId = urlParams.get("project");
    if (projectId) {
      loadProject(projectId);
      setProjectId(projectId);
    } else {
      setIsLoading(false);
      setError("No project ID found in URL.");
    }
  }, []);

  const loadProject = async (projectId: string) => {
    setIsLoading(true);
    try {
      chrome.runtime.sendMessage(
        {
          action: "get_project_by_id",
          payload: { id: parseInt(projectId, 10) },
        },
        (response) => {
          if (response?.success) {
            const project = response.project;
            console.log('Loaded project:', project);
            setCurrentProject(project);
            setRecordedSteps(project.recorded_steps || []);
            setFields(project.parsed_fields || []);
            setTargetUrl(project.target_url || "");
            setCsvdata(project.csv_data || "");

          } else {
            //console.error("Failed to load project:", response?.error);
            setError("Error loading project: " + (response?.error as Error).message);
          }
          setIsLoading(false);
        }
      );
    } catch (err) {
      setError("Error loading project: " + (err as Error).message);
    }
    setIsLoading(false);
  };

  const handleCSVUpload = async (file: File | null) => {
    if (!file) return;
    if (!currentProject) return;
    setIsUploadingCSV(true);
    setError("");
    setFields([]);

    try {
      const fileName = file.name.toLowerCase();

      let extractedRows: any[] = [];

      if (fileName.endsWith(".csv")) {
        // 📦 Parse CSV
        const text = await file.text();
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        });

        if (result.errors.length > 0) {
          setError("Error parsing CSV: " + result.errors[0].message);
          setIsUploadingCSV(false);
          return;
        }

        extractedRows = result.data;
      } else {
        setError("Unsupported file format. Please upload a CSV file.");
        setIsUploadingCSV(false);
        return;
      }

      if (extractedRows.length === 0) {
        setError("The file is empty or could not be parsed.");
        setIsUploadingCSV(false);
        return;
      }

      const headers = Object.keys(extractedRows[0]);
      const dataPreview: any = extractedRows.slice(0, 10);
      //const dataPreview:any = extractedRows;
      console.log("dataPreview >>>", dataPreview);
      setCsvdata(dataPreview);
      updateProjectcsv(
        parseInt(currentProject.id),
        dataPreview,
        () => {
          setError("CSV successfully saved !");
        },
        (error) => {
          //addLog("error", `Failed to save: ${error}`);
          setError("Error saving mappings: " + error);
        }
      );

      const csvFields = headers.map((header) => ({
        field_name: header,
        mapped: false,
        inputvarfields: "",
      }));
      setFields(csvFields);
      setError(`Successfully imported ${csvFields.length} fields. Ready for mapping.`);
    } catch (err) {
      //console.error("Error:", err);
      setError("Unexpected error while processing the file.");
    }

    setIsUploadingCSV(false);
  };

  const updateFieldMapping = (fieldIndex: number, updates: Partial<Field>) => {
    setFields(currentFields =>
      currentFields.map((field, index) =>
        index === fieldIndex ? { ...field, ...updates } : field
      )
    );
  };

  const autoMapFields = () => {
    setIsMapping(true);
    setError("");
    let newlyMappedCount = 0;

    fields.forEach((field, index) => {
      if (field.mapped || field.inputvarfields) return;

      const normalizedFieldName = field.field_name
        .toLowerCase()
        .replace(/[\s_]/g, "");

      let bestMatch: any = null;
      let bestScore = 0;

      recordedSteps.forEach((step) => {
        const stepName = step.label?.toLowerCase().replace(/[\s_]/g, "");
        if (!stepName) return;

        const score = stringSimilarity.compareTwoStrings(normalizedFieldName, stepName);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = step;
        }
      });

      // agar similarity 0.3 (30%) se upar ho
      if (bestMatch && bestScore >= 0.3) {
        newlyMappedCount++;
        updateFieldMapping(index, {
          mapped: true,
          inputvarfields: bestMatch.label || "",
        });
      }
    });

    if (newlyMappedCount > 0) {
      setError(`Auto-mapping successfully completed. ${newlyMappedCount} new fields were matched.`);
    } else {
      setError("Auto-mapping attempt completed, but no new matches were found.");
    }

    setIsMapping(false);
  };

  const saveMappings = async () => {
    if (!currentProject) return;
    const mappedFields = fields.filter(f => f.mapped);
    if (mappedFields.length === 0 && fields.length > 0) {
      setError("No fields have been mapped. Please map at least one field to save.");
      return;
    }

    const status = 'testing';

    updateProjectFields(
      parseInt(currentProject.id),
      fields,
      status,
      () => {
        setError("Mappings saved successfully!");
      },
      (error) => {
        //addLog("error", `Failed to save: ${error}`);
        setError("Error saving mappings: " + error);
      }
    );
  };

  const runTest = async () => {
    const mappedFields = fields.filter(f => f.mapped);
    if (mappedFields.length === 0 && fields.length > 0) {
      setError("No fields have been mapped. Please map at least one field to proceed.");
      return;
    }
    await saveMappings();
    if (!currentProject?.id) {
      setError("No project ID found.");
      return;
    }
    window.location.href = createPageUrl(`index.html#/TestRunner?project=${currentProject.id}`);
  };

  const updateProjectFields = (
    projectId: number,
    field: Field[],
    status: string,
    onSuccess: () => void,
    onError: (error: string) => void
  ) => {
    chrome.runtime.sendMessage(
      {
        action: "update_project_fields",
        payload: {
          id: projectId,
          parsed_fields: field,
          status: status
        },
      },
      (response) => {
        if (response?.success) {
          onSuccess();
        } else {
          onError(response?.error || "Unknown error");
        }
      }
    );
  };

  const updateProjectcsv = (
    projectId: number,
    dataPreview: [],
    onSuccess: () => void,
    onError: (error: string) => void
  ) => {
    chrome.runtime.sendMessage(
      {
        action: "update_project_csv",
        payload: {
          id: projectId,
          csv_data: dataPreview,
        },
      },
      (response) => {
        if (response?.success) {
          onSuccess();
        } else {
          onError(response?.error || "Unknown error");
        }
      }
    );
  };

  const mappedCount = fields.filter(f => f.mapped).length;
  const totalFields = fields.length;


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <MapPin className="w-8 h-8 text-blue-400" />
              Field Mapper
            </h1>
            {currentProject && (
              <p className="text-slate-400 text-lg">
                Process: <span className="text-blue-400 font-semibold">{currentProject.name}</span>
              </p>
            )}
            {isUploadingCSV && <p className="text-blue-400 text-sm animate-pulse">Processing file...</p>}
            <div className="mt-4">
              <div className="flex items-center gap-4">
                <div className="text-left">
                  <div className="text-2xl font-bold text-white">{mappedCount}/{totalFields}</div>
                  <div className="text-sm text-slate-400">Fields Mapped</div>
                </div>
                {totalFields > 0 && (
                  <div className="flex-1 max-w-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Progress</span>
                      <span className="text-sm text-slate-400">{Math.round((mappedCount / totalFields) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${(mappedCount / totalFields) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <label htmlFor="csv-upload-mapper" className="cursor-pointer">
              <Button type="button" variant="outline" className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600" asChild>
                <span><FileSpreadsheet className="w-4 h-4 mr-2" />Upload CSV</span>
              </Button>
              <input
                id="csv-upload-mapper"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleCSVUpload(e.target.files?.[0] || null)}
              />
            </label>
            <Button
              onClick={autoMapFields}
              disabled={isMapping || fields.length === 0}
              variant="outline"
              className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 mr-2" />
              {isMapping ? 'Mapping...' : 'Auto-Map'}
            </Button>
            <Button onClick={saveMappings} disabled={!fields || fields.length === 0} className="bg-blue-500 hover:bg-blue-600">
              <Save className="w-4 h-4 mr-2" />Save
            </Button>
            <Button onClick={runTest} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
              <Play className="w-4 h-4 mr-2" />Run Process<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {error && (
          <Alert
            variant={error.toLowerCase().includes('successfully') ? 'default' : 'destructive'}
            className={
              error.toLowerCase().includes('successfully')
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }
          >
            {error.toLowerCase().includes('successfully') ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="glass-effect bg-slate-800/30 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white text-lg">Reading Start URL</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="Enter the target URL for the test runner"
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
            />
          </CardContent>
        </Card>

        <FieldMappingTable fields={fields} onUpdateField={updateFieldMapping} recordedSteps={recordedSteps as any} />
      </div>
    </div>
  );
}