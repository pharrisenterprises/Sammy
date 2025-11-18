import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../Ui/dialog";
import { Button } from "../Ui/button";
import { Input } from "../Ui/input";
import { Textarea } from "../Ui/textarea";
import { Label } from "../Ui/label";
import { Loader2 } from "lucide-react";

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { id: string; name: string; description: string; target_url?: string }) => Promise<void>;
  projectData?: { id: string; name: string; description: string; target_url?: string };
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({
  open,
  onClose,
  onSave,
  projectData,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    target_url: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (projectData) {
      setFormData({
        name: projectData.name || "",
        description: projectData.description || "",
        target_url: projectData.target_url || "",
      });
    }
  }, [projectData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectData) return;
    setIsSubmitting(true);
    await onSave({ id: projectData.id, ...formData });
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 text-white max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Edit Process</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-300">
              Process Name *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="My Test Process"
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-slate-300">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe your test process..."
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_url" className="text-slate-300">
              Reading Start URL
            </Label>
            <Input
              id="target_url"
              value={formData.target_url}
              onChange={(e) =>
                setFormData({ ...formData, target_url: e.target.value })
              }
              placeholder="https://example.com"
              type="url"
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.name || isSubmitting}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Process"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectModal;
