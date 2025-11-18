import { useState, FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../Ui/dialog";
import { Button } from "../Ui/button";
import { Input } from "../Ui/input";
import { Label } from "../Ui/label";
import { Textarea } from "../Ui/textarea";
import { Loader2 } from "lucide-react";

type CreateProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type FormData = {
  name: string;
  description: string;
  target_url: string;
  status: string;
  created_date: number,
  updated_date: number,
};

export default function CreateProjectDialog({
  open,
  onClose,
  onSuccess,
}: CreateProjectDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    target_url: "",
    status: "",
    created_date: 0,
    updated_date: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsSubmitting(true);
    try {
      chrome.runtime.sendMessage(
        {
          action: "add_project",
          payload: {
            name: formData.name,
            description: formData.description,
            target_url: formData.target_url,
            status: "draft",
            created_date: new Date().toISOString(),
            updated_date: new Date().toISOString(),
          },
        },
        (response) => {
          if (response.success) {
            console.log("Process added:", response.id);
            onSuccess();
            setFormData({ name: "", description: "", target_url: "", status: "", created_date: 0, updated_date: 0 });
          } else {
            //console.error("Error:", response.error);
          }
          setIsSubmitting(false);
        }
      );
    } catch (error) {
      //console.error("Error creating Process:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            Create New Process
          </DialogTitle>
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
                  Creating...
                </>
              ) : (
                "Create Process"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
