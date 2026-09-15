export interface Subtask {
  id: string; title: string; description?: string | null; completed: boolean; taskId: string; createdAt: string;
}
export interface TaskAssignee {
  id: string; taskId: string; userId: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
}
export type Priority  = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

export interface Task {
  id: string; title: string; description?: string | null;
  priority: Priority;
  status: TaskStatus;
  startDate?: string | null; dueDate?: string | null;
  projectId: string; project: Project;
  userId: string;
  assignees: TaskAssignee[];
  subtasks: Subtask[];
  createdAt: string; updatedAt: string;
}
export interface Project {
  id: string; name: string; color: string; description?: string | null;
  tasks?: Task[]; createdAt: string;
}
