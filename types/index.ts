export interface WeatherData {
  temperature: number; feelsLike: number; condition: string;
  humidity: number; windSpeed: number; icon: string; high: number; low: number;
  forecast: ForecastDay[];
}
export interface ForecastDay {
  date: string; high: number; low: number; condition: string; icon: string;
}
export interface CalendarEvent {
  id: string; summary: string; start: string; end: string;
  location?: string; description?: string; colorId?: string;
}

export interface Subtask {
  id: string; title: string; description?: string | null; completed: boolean; taskId: string; createdAt: string;
}
export interface TaskAssignee {
  id: string; taskId: string; userId: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
}
export type Priority  = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type SprintMode = "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";

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

export type TimerMode = "IDLE" | SprintMode;
export interface TimerState {
  mode: TimerMode; secondsLeft: number; sprintsCompleted: number;
  activeTask: string; activeProjectId: string; isRunning: boolean;
}
export type TimerAction =
  | { type: "START" } | { type: "PAUSE" } | { type: "RESET" } | { type: "TICK" }
  | { type: "CYCLE_COMPLETE" } | { type: "SET_TASK"; task: string }
  | { type: "SET_PROJECT"; projectId: string } | { type: "SET_MODE"; mode: TimerMode; seconds: number };

export type ChatSender = "USER" | "SOLOMON";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: ChatSender;
  content: string;
  command: string | null;
  createdAt: string;
}
