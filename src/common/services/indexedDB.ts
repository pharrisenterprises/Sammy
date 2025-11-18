import Dexie, { Table } from 'dexie';

interface Project {
    id?: number;
    name: string;
    description: string;
    target_url: string;
    status: string;
    created_date: number;
    updated_date: number;
    recorded_steps?: any[];
    parsed_fields?: any[];
    csv_data?: any[];
}

interface TestRun {
    id?: number;
    project_id: number;
    status: string;
    start_time: string;
    end_time?: string;
    total_steps: number;
    passed_steps: number;
    failed_steps: number;
    test_results: any[]; // Array of step results
    logs: string;
}

class ProjectDB extends Dexie {
    public projects!: Table<Project, number>;
    public testRuns!: Table<TestRun, number>;

    constructor() {
        super("ProjectDatabase");
        this.version(1).stores({
            projects: "++id, name, description, target_url, status, created_date, updated_date, recorded_steps, parsed_fields, csv_data",
            testRuns: "++id, project_id, status, start_time, end_time, total_steps, passed_steps, failed_steps"
        });
    }

    public async addProject(project: Project): Promise<number> {
        return await this.projects.add(project);
    }

    public async updateProject(id: number, updates: Partial<Project>): Promise<number> {
        return await this.projects.update(id, updates);
    }

    public async getAllProjects(): Promise<Project[]> {
        return await this.projects.toArray();
    }

    public async deleteProject(projectId: number): Promise<void> {
        return await this.projects.delete(projectId);
    }

    // TestRun methods
    public async createTestRun(run: TestRun): Promise<number> {
        return await this.testRuns.add(run);
    }

    public async updateTestRun(id: number, updates: Partial<TestRun>): Promise<number> {
        return await this.testRuns.update(id, updates);
    }

    public async getTestRunsByProject(projectId: number): Promise<TestRun[]> {
        return await this.testRuns
            .where("project_id")
            .equals(projectId)
            .reverse()
            .sortBy("start_time");
    }
}

export const DB = new ProjectDB();