import Dexie, { type EntityTable } from 'dexie';
import type {
  Attempt, BoardLog, Goal, GradeBand, GradeSystem, Gym, Photo, Problem, Session, Setting, Wall, WallSet,
} from './types';

export const DB_NAME = 'climb-log';

export class ClimbDB extends Dexie {
  gyms!: EntityTable<Gym, 'id'>;
  gradeSystems!: EntityTable<GradeSystem, 'id'>;
  gradeBands!: EntityTable<GradeBand, 'id'>;
  walls!: EntityTable<Wall, 'id'>;
  wallSets!: EntityTable<WallSet, 'id'>;
  problems!: EntityTable<Problem, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  attempts!: EntityTable<Attempt, 'id'>;
  boardLogs!: EntityTable<BoardLog, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    // Version 1. Never edit this declaration: add db.version(2) with an upgrade() instead.
    this.version(1).stores({
      gyms: 'id',
      gradeSystems: 'id',
      gradeBands: 'id, gradeSystemId, order',
      walls: 'id, gymId',
      wallSets: 'id, wallId, setDate',
      problems: 'id, wallSetId, gradeBandId, status',
      sessions: 'id, gymId, date',
      attempts: 'id, problemId, sessionId, createdAt',
      boardLogs: 'id, sessionId, wallId',
      goals: 'id',
      photos: 'id',
      settings: 'key',
    });
  }
}
