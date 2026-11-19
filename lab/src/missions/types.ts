// Mission and worksheet model. Scenario packs (one per training day) are plain data in this shape.
import type { Host } from '../shell/types';
import type { SeatFacts } from '../hosts/hosts';

export type HostId = 'demo-win' | 'demo-linux' | 'seat-win' | 'seat-linux' | 'ws-win' | 'ws-linux' | 'ws-seat-win' | 'ws-seat-linux';

export interface Step {
  id: string;
  host?: HostId;         // terminal where the step is checked (omit for manual steps)
  manual?: boolean;      // completed with a "Mark as done" button (e.g. work in the browser or with a partner)
  link?: string;         // optional external reference opened in the trainee's browser
  text: string;          // what to do (plain text, may contain `code`)
  try?: string;          // a suggested command shown on "Show hint"
  why?: string;          // what to notice in the output
  match: RegExp[];       // the step is done when a command line on `host` matches any of these
}

export type FieldKind = 'text' | 'area' | 'select';
export interface Field { id: string; label: string; kind: FieldKind; options?: string[]; placeholder?: string; wide?: boolean }

export interface WorksheetTable { id: string; title?: string; columns: { id: string; label: string; kind?: FieldKind; options?: string[] }[]; rows: { id: string; label?: string }[] }

export interface Worksheet {
  id: string;
  title: string;
  intro?: string;
  tables?: WorksheetTable[];
  fields?: Field[];
  fieldsFirst?: boolean;   // render the questions before the tables
  /** Returns per-field verdicts: true = correct, false = check again, undefined = not auto-checked. */
  grade?: (values: Record<string, string>, ctx: GradeCtx) => Record<string, { ok: boolean; hint?: string }>;
}

export interface GradeCtx { facts: SeatFacts; hosts: Record<HostId, Host> }

export interface Mission {
  id: string;
  day: number;
  kind: 'practice' | 'activity' | 'workspace';
  title: string;
  subtitle: string;
  minutes?: number;
  video?: string;        // demo video this practice mirrors
  hosts: HostId[];       // terminals shown for this mission
  intro: string;
  steps: Step[];
  worksheet?: Worksheet;
  cheats?: { group: string; host: HostId; cmds: string[] }[]; // workspace only: one-click commands
}

export interface ScenarioPack { day: number; title: string; missions: Mission[] }
