import { useState, useEffect } from "react";
import { Button } from "../components/Ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/Ui/card";
import { Input } from "../components/Ui/input";
import {
  Plus,
  Search,
  Copy,
  Trash2,
  FileCode,
  Calendar,
  Edit,
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils/index";
import { format } from "date-fns";
import CreateProjectDialog from "../components/Dashboard/CreateProjectDialog";
import ProjectStats from "../components/Dashboard/ProjectStats";
import ConfirmationModal from "../components/Dashboard/ConfirmationModal";
import EditProjectModal from "../components/Dashboard/EditProjectModal";

type ProjectType = {
  status: string;
  id: string;
  name: string;
  description: string;
  created_date: number;
  updated_date: number;
};

type TestRunType = {
  id: string;
  status: "completed" | "failed" | "pending";
};

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectType[]>([]);
  const [testRuns] = useState<TestRunType[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectType | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const initAndLoadData = async () => {
      setIsLoading(true);

      try {
        // Step 1: Try to load from background
        chrome.runtime.sendMessage({ action: "get_all_projects" }, async (response) => {
          console.log("response >>", response);
          if (response?.success && response.projects.length > 0) {
            console.log("Loaded from background:", response.projects);
            setProjects(response.projects.map((project: any) => ({
              ...project,
              status: project.status ?? "draft",
              name: project.name ?? "Untitled",
              description: project.description ?? "",
              created_date: project.created_date ?? new Date().toISOString(),
              updated_date: project.updated_date ?? new Date().toISOString(),
            })));
          }
          setIsLoading(false);
        });
      } catch (error) {
        ////console.error("Error initializing or loading data:", error);
        setIsLoading(false);
      }
    };
    initAndLoadData();
  }, []);

  const loadData = async (): Promise<void> => {
    setIsLoading(true);
    try {
      chrome.runtime.sendMessage({ action: "get_all_projects" }, (response) => {
        if (response?.success) {
          setProjects(
            response.projects.map((project: any) => ({
              ...project,
              status: project.status ?? "draft",
              name: project.name ?? "Untitled",
              description: project.description ?? "",
              created_date: project.created_date ?? new Date().toISOString(),
              updated_date: project.updated_date ?? new Date().toISOString(),
            }))
          );
        } else {
          //console.error("Failed to fetch projects:", response?.error);
        }
      });
    } catch (error) {
      //console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const duplicateProject = async (): Promise<void> => {
    try {
      await loadData();
    } catch (error) {
      //console.error("Error duplicating project:", error);
    }
  };

  const handleDeleteClick = (projectId: string) => {
    setSelectedProjectId(projectId);
    setConfirmOpen(true);
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    try {
      chrome.runtime.sendMessage(
        {
          action: "delete_project",
          payload: { projectId },
        },
        async (response) => {
          if (response.success) {
            console.log("Project deleted successfully");
            await loadData(); // Re-fetch or update local state
          } else {
            //console.error("Failed to delete project:", response.error);
          }
        }
      );
    } catch (error) {
      //console.error("Error deleting project:", error);
    }
  };

  const confirmDelete = () => {
    if (selectedProjectId) {
      deleteProject(selectedProjectId);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Process
          </Button>
        </div>

        <ProjectStats projects={projects} testRuns={testRuns} />
        {/* <QuickActions /> */}

        {/* Search */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Search Process..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Project Cards */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="glass-effect rounded-2xl p-6 animate-pulse">
                    <div className="h-6 bg-slate-700 rounded mb-4"></div>
                    <div className="h-4 bg-slate-700 rounded mb-2 w-3/4"></div>
                    <div className="h-4 bg-slate-700 rounded mb-4 w-1/2"></div>
                    <div className="flex gap-2">
                      <div className="h-8 bg-slate-700 rounded w-20"></div>
                      <div className="h-8 bg-slate-700 rounded w-16"></div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => {
                return (
                  <Card
                    key={project.id}
                    className="glass-effect border-slate-700/50 hover:border-blue-500/30 transition-all duration-300 group hover:scale-[1.02] bg-slate-800/30"
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-white text-xl mb-2 group-hover:text-blue-300 transition-colors break-all	line-clamp-2">
                            {project.name}
                          </CardTitle>
                          <p className="text-slate-400 text-sm mb-3 break-all	line-clamp-2">{project.description || "No description"}</p>
                          {/* <Badge
                            variant="outline"
                            className={`${statusConfig[project.status]?.color} border font-medium`}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                          </Badge> */}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(project.updated_date), "MMM d, yyyy")}
                        </div>
                        {/* <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDistanceToNow(new Date(project.updated_date), { addSuffix: true })}
                        </div> */}
                      </div>

                      <div className="flex gap-2">
                        <Link to={createPageUrl(`Recorder?project=${project.id}`)} className="flex-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400"
                          >
                            Open Recorder
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateProject()}
                          className="text-slate-400 hover:text-white hover:bg-slate-700"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        {/* New Edit Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedProject(project);
                            setEditOpen(true);
                          }}
                          className="text-slate-400 hover:text-blue-300 hover:bg-blue-500/10"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(project.id)}
                          className="text-slate-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {!isLoading && filteredProjects.length === 0 && (
            <div className="text-center py-12">
              <FileCode className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-300 mb-2">
                {searchTerm ? "No Process found" : "No Process yet"}
              </h3>
              <p className="text-slate-400 mb-4">
                {searchTerm ? "Try adjusting your search terms" : "Create your first test process to get started"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-500 hover:bg-blue-600">
                  <Plus className="w-5 h-5 mr-2" />
                  Create Process
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateProjectDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => {
          setShowCreateDialog(false);
          loadData();
        }}
      />
      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Project?"
        description="This will permanently delete the project and cannot be undone."
      />
      {/* Edit Modal */}
      <EditProjectModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        projectData={selectedProject || undefined}
        onSave={async (updatedProject) => {
          chrome.runtime.sendMessage(
            {
              action: "update_project",
              payload: updatedProject,
            },
            async (response) => {
              if (response.success) {
                await loadData();
                setEditOpen(false);
              } else {
                //console.error("Update failed:", response.error);
              }
            }
          );
        }}
      />
    </div>
  );
}
