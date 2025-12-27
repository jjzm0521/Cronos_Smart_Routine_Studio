export enum BlockType {
  WORK = 'WORK',
  REST = 'REST',
  PREP = 'PREP',
  OTHER = 'OTHER'
}

export interface StepBlock {
  id: string;
  name: string;
  duration: number; // in seconds
  type: BlockType;
}

export interface Routine {
  id: string;
  name: string;
  totalDuration: number;
  blocks: StepBlock[];
  lastPlayed?: number; // timestamp
  colorTheme?: string;
  coverImage?: string;
}

export interface HistoryEntry {
  id: string;
  routineName: string;
  date: number; // timestamp
  totalTime: number; // seconds completed
  status: 'COMPLETED' | 'ABORTED';
}

// View Navigation Types
export type ViewName = 'HOME' | 'EDITOR' | 'RUNNER' | 'HISTORY';

export interface NavigatorState {
  currentView: ViewName;
  data?: any; // To pass routine ID or object
}
