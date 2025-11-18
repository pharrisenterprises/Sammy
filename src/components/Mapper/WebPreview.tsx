import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../Ui/card";
import { Input } from "../Ui/input";
import { Button } from "../Ui/button";
import { Badge } from "../Ui/badge";
import {
  ExternalLink,
  RefreshCw,
  Eye,
  Target,
  Crosshair,
} from "lucide-react";

interface Field {
  field_name: string;
  // Add other field properties here if needed
}

interface WebPreviewProps {
  targetUrl: string;
  onUrlChange: (url: string) => void;
  selectedField: number | null;
  fields: Field[];
  onFieldMap: (fieldIndex: number) => void;
}

export default function WebPreview({
  targetUrl,
  onUrlChange,
  selectedField,
  fields }: WebPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isHighlightMode, setIsHighlightMode] = useState(false);

  const loadUrl = () => {
    if (targetUrl) {
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  const toggleHighlightMode = () => {
    setIsHighlightMode(!isHighlightMode);
  };

  return (
    <Card className="glass-effect bg-slate-800/30 border-slate-700/50 h-full">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Eye className="w-5 h-5 text-green-400" />
          Web Preview
          {selectedField !== null && (
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30" variant={undefined}>
              Mapping: {fields[selectedField]?.field_name}
            </Badge>
          )}
        </CardTitle>

        <div className="flex gap-3">
          <div className="flex-1 flex gap-2">
            <Input
              value={targetUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com"
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
            />
            <Button
              onClick={loadUrl}
              disabled={!targetUrl || isLoading}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={toggleHighlightMode}
              variant={isHighlightMode ? "default" : "outline"}
              className={
                isHighlightMode
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
              }
            >
              <Target className="w-4 h-4 mr-2" />
              {isHighlightMode ? 'Exit Highlight' : 'Highlight Mode'}
            </Button>

            <Button
              variant="outline"
              onClick={() => window.open(targetUrl, '_blank')}
              disabled={!targetUrl}
              className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 h-[500px]">
        {targetUrl ? (
          <div className="relative w-full h-full bg-slate-900 rounded-b-lg overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
                  <p className="text-slate-400">Loading website...</p>
                </div>
              </div>
            ) : (
              <>
                <iframe
                  src={targetUrl}
                  className="w-full h-full border-none"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  title="Web Preview"
                />

                {isHighlightMode && (
                  <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-2 text-blue-300">
                        <Crosshair className="w-5 h-5" />
                        <span className="font-medium">Highlight Mode Active</span>
                      </div>
                      <p className="text-slate-400 text-sm mt-1">
                        Click elements to map them to script fields
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full bg-slate-900 rounded-b-lg">
            <div className="text-center">
              <Eye className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-slate-300 font-semibold mb-2">Web Preview</h3>
              <p className="text-slate-400 mb-4">
                Enter a URL to preview the target website
              </p>
              <Input
                value={targetUrl}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="https://example.com"
                className="max-w-sm mx-auto bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
