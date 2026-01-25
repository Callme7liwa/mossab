import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, FileJson, FileSpreadsheet, X, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UploadedFile {
  name: string;
  size: number;
  type: "csv" | "json";
  records: number;
}

export function FileUpload() {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([
    { name: "market_data_2024.csv", size: 245000, type: "csv", records: 1250 },
    { name: "property_listings.json", size: 180000, type: "json", records: 850 },
  ]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "csv" || ext === "json") {
        setUploadedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: ext as "csv" | "json",
            records: Math.floor(Math.random() * 1000) + 100,
          },
        ]);
      }
    }
  }, []);

  const removeFile = (name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "bento-card border-2 border-dashed transition-all duration-300 cursor-pointer",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        )}
      >
        <div className="flex flex-col items-center justify-center py-12">
          <motion.div
            animate={{ y: dragActive ? -5 : 0 }}
            transition={{ type: "spring", stiffness: 300 }}
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
              dragActive ? "bg-primary" : "bg-primary/10"
            )}
          >
            <Upload
              className={cn(
                "w-8 h-8 transition-colors",
                dragActive ? "text-primary-foreground" : "text-primary"
              )}
            />
          </motion.div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            Upload Your Data
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            Drag and drop your CSV or JSON files here, or click to browse
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-sm">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">CSV</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-sm">
              <FileJson className="w-4 h-4 text-accent" />
              <span className="text-muted-foreground">JSON</span>
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="bento-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-foreground">
              Uploaded Files
            </h3>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export All
            </Button>
          </div>
          <div className="space-y-3">
            {uploadedFiles.map((file, index) => (
              <motion.div
                key={file.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        file.type === "csv" ? "bg-primary/10" : "bg-accent/10"
                      )}
                    >
                      {file.type === "csv" ? (
                        <FileSpreadsheet className="w-5 h-5 text-primary" />
                      ) : (
                        <FileJson className="w-5 h-5 text-accent" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSize(file.size)} • {file.records.toLocaleString()}{" "}
                        records
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <Check className="w-3 h-3" />
                      Processed
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file.name)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="bento-card">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">
          Export Options
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <FileSpreadsheet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Export to CSV</p>
                <p className="text-sm text-muted-foreground">
                  Download data as spreadsheet
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <Download className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="font-medium text-foreground">Export Report (PDF)</p>
                <p className="text-sm text-muted-foreground">
                  Generate comprehensive report
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
