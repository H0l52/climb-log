// Mirrors docs/data-model.md. Change both together.
export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD', Australia/Melbourne calendar date
export type EpochMs = number;

export interface Gym {
  id: ID;
  name: string;
  active: boolean;
  setDays: number[]; // ISO weekdays, Monday = 1
}

export interface GradeSystem {
  id: ID;
  name: string;
}

export interface GradeBand {
  id: ID;
  gradeSystemId: ID;
  name: string;
  hex: string;
  order: number; // 1 = easiest
  approxV: number | null; // display only
  active: boolean;
}

export type WallKind = 'boulder' | 'board';

export interface Wall {
  id: ID;
  gymId: ID;
  name: string;
  kind: WallKind;
  gradeSystemId: ID;
  styleTags: string[];
  active: boolean;
  mergedIntoId: ID | null;
  createdAt: EpochMs;
}

export interface WallSet {
  id: ID;
  wallId: ID;
  setDate: ISODate;
  retiredDate: ISODate | null; // null = current set
}

export type ProblemStatus = 'project' | 'sent' | 'expired';

export interface Problem {
  id: ID;
  wallSetId: ID;
  gradeBandId: ID;
  nickname: string | null;
  photoId: ID | null;
  styleTags: string[];
  status: ProblemStatus;
  createdAt: EpochMs;
}

export interface Session {
  id: ID;
  gymId: ID;
  date: ISODate;
  startedAt: EpochMs;
  endedAt: EpochMs | null;
  notes: string | null;
  energy: 1 | 2 | 3 | 4 | 5 | null;
}

export type AttemptResult = 'flash' | 'send' | 'fail';
export type Felt = 'easy' | 'fair' | 'hard';

export interface Attempt {
  id: ID;
  problemId: ID;
  sessionId: ID;
  tries: number;
  result: AttemptResult;
  felt: Felt | null;
  notes: string | null;
  createdAt: EpochMs;
}

export interface BoardLog {
  id: ID;
  sessionId: ID;
  wallId: ID;
  climbName: string | null;
  angle: number | null;
  vGrade: number | null;
  tries: number;
  result: 'send' | 'fail';
  createdAt: EpochMs;
}

export type GoalType = 'first-send-of-colour' | 'sessions-per-week' | 'sends-of-colour' | 'flash-rate';

export interface Goal {
  id: ID;
  type: GoalType;
  gradeBandId: ID | null;
  target: number;
  deadline: ISODate | null;
  createdAt: EpochMs;
  achievedAt: EpochMs | null;
}

export interface Photo {
  id: ID;
  blob: Blob;
  thumb: Blob;
  createdAt: EpochMs;
}

export interface Setting {
  key: string;
  value: unknown;
}

export type SettingKey =
  | 'seedVersionApplied' | 'lastGymId' | 'backupLastAt' | 'photoRetentionDays' | 'persistGranted' | 'wallLastUsed' | 'lastReset';

/** Shape of src/data/seed.json. */
export interface SeedData {
  seedVersion: number;
  gyms: Gym[];
  gradeSystems: GradeSystem[];
  gradeBands: GradeBand[];
  walls: Array<Pick<Wall, 'id' | 'gymId' | 'name' | 'kind' | 'styleTags'>>;
  styleTags: string[];
}
