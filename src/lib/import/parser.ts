// De parser leest een .xlsx-export van de coaching-sheet en zet die om naar
// gewone JavaScript-objecten. Hij praat niet met de database: zo is hij los te
// testen (tests/import-parser.test.ts) en te gebruiken in de preview.
//
// Kernidee: de kopregels schuiven soms op, dus we zoeken op TEKST ("SESSIE",
// "SETS", "Wekelijkse recap", ...) en gebruiken vaste kolomafstanden enkel als
// terugvaloptie wanneer een kop ontbreekt.
import * as XLSX from "xlsx";
import type {
  CellValue,
  ImportWarning,
  ParsedCheckin,
  ParsedExercise,
  ParsedInfo,
  ParsedMonth,
  ParsedSession,
  ParsedWeek,
  ParsedWorkbook,
} from "./types";
import {
  cellText,
  isBlank,
  normalizeRating,
  parseDuration,
  parseExerciseName,
  parseMonthTab,
  parseNumber,
  parseReps,
  parseRpe,
  parseWeekday,
  parseWeight,
} from "./values";

// --- Werkblad als raster ----------------------------------------------------

type Cell = { r: number; c: number; value: CellValue; upper: string };

class Grid {
  private cells = new Map<string, CellValue>();
  private dateSerials = new Map<string, number>();
  readonly list: Cell[] = [];
  maxCol = 0;

  constructor(
    readonly name: string,
    sheet: XLSX.WorkSheet,
  ) {
    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith("!")) continue;
      const { r, c } = XLSX.utils.decode_cell(address);
      const object = cell as XLSX.CellObject;
      const value = toCellValue(object);
      if (value === null) continue;
      this.cells.set(`${r}:${c}`, value);
      if (isDateCell(object)) this.dateSerials.set(`${r}:${c}`, object.v as number);
      this.list.push({ r, c, value, upper: cellText(value).toUpperCase() });
      this.maxCol = Math.max(this.maxCol, c);
    }
    this.list.sort((a, b) => a.r - b.r || a.c - b.c);
  }

  get(r: number, c: number): CellValue {
    return this.cells.get(`${r}:${c}`) ?? null;
  }

  /** Voor echte datumvelden (startdatum): het onderliggende Excel-getal. */
  dateSerial(r: number, c: number): number | null {
    return this.dateSerials.get(`${r}:${c}`) ?? null;
  }

  /** Cellen waarvan de tekst aan een patroon voldoet, optioneel binnen kolommen [from, to]. */
  find(pattern: RegExp, from = 0, to = Number.MAX_SAFE_INTEGER): Cell[] {
    return this.list.filter((cell) => cell.c >= from && cell.c <= to && pattern.test(cell.upper));
  }
}

/** Een getal met een datumopmaak (bv. "d-m"). */
function isDateCell(cell: XLSX.CellObject): boolean {
  return cell.t === "n" && typeof cell.z === "string" && XLSX.SSF.is_date(cell.z);
}

function toCellValue(cell: XLSX.CellObject): CellValue {
  if (cell.v === undefined || cell.v === null) return null;
  // Valkuil: Google Sheets maakt van "10-12" (reps) of "6-7" (RPE) automatisch
  // een datum. Intern staat er dan een getal (46366), op het scherm "10-12".
  // Daarom lezen we bij datumcellen de getoonde tekst.
  if (isDateCell(cell)) return cell.w ?? String(cell.v);
  if (cell.t === "n") return cell.v as number;
  if (cell.t === "e") return cell.w ?? null; // foutwaarde zoals #N/A
  const text = String(cell.v);
  return text.trim() === "" ? null : text;
}

const address = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

// --- Kolommen herkennen -----------------------------------------------------

type ColumnKey = "comment" | "sets" | "reps" | "intensity" | "weight" | "rpe" | "notes";
type Columns = { name: number } & Record<ColumnKey, number | null>;

const HEADER_PATTERNS: Array<[Exclude<ColumnKey, "comment">, RegExp]> = [
  ["sets", /^SETS?$/],
  ["reps", /^REPS?$/],
  ["intensity", /^INTENSITEIT$/],
  ["weight", /^GEWICHT$/],
  ["rpe", /^ECHTE RPE$/],
  ["notes", /^NOTITIES$/],
];

/**
 * Bepaal per kolom waar hij staat. Gevonden kopteksten winnen; voor een
 * ontbrekende kop nemen we de standaardafstand tot de naamkolom, verschoven
 * met dezelfde verschuiving als de koppen die we wél vonden.
 */
function resolveColumns(grid: Grid, headerRow: number, nameCol: number, endCol: number, defaults: Record<ColumnKey, number>): Columns {
  const found: Partial<Record<ColumnKey, number>> = {};
  for (let c = nameCol + 1; c <= endCol; c++) {
    const text = cellText(grid.get(headerRow, c)).toUpperCase();
    for (const [key, pattern] of HEADER_PATTERNS) {
      if (found[key] === undefined && pattern.test(text)) found[key] = c;
    }
  }

  const shifts = Object.entries(found).map(([key, col]) => col! - (nameCol + defaults[key as ColumnKey]));
  const shift = mostCommon(shifts) ?? 0;
  const resolve = (key: ColumnKey) => found[key] ?? nameCol + defaults[key] + shift;

  const sets = resolve("sets");
  const comment = sets - 1 > nameCol ? sets - 1 : null; // geen ruimte = geen opmerkingkolom
  return {
    name: nameCol,
    comment,
    sets,
    reps: resolve("reps"),
    intensity: resolve("intensity"),
    weight: resolve("weight"),
    rpe: resolve("rpe"),
    notes: resolve("notes"),
  };
}

function mostCommon(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const SESSION_DEFAULTS: Record<ColumnKey, number> = { comment: 1, sets: 2, reps: 3, intensity: 4, weight: 5, rpe: 6, notes: 7 };
const EXTRA_DEFAULTS: Record<ColumnKey, number> = { comment: 0, sets: 1, reps: 2, intensity: 3, weight: 4, rpe: 5, notes: 6 };

// --- Eén oefeningrij --------------------------------------------------------

function parseExerciseRow(grid: Grid, r: number, cols: Columns, warn: (cell: string, message: string) => void): ParsedExercise | null {
  const get = (c: number | null) => (c === null ? null : grid.get(r, c));
  const nameCell = address(r, cols.name);
  const rawName = get(cols.name);
  if (isBlank(rawName)) return null;
  if (typeof rawName === "number") {
    warn(nameCell, `"${rawName}" is geen oefeningnaam; rij overgeslagen.`);
    return null;
  }
  const { name, optional } = parseExerciseName(rawName);

  const rawSets = get(cols.sets);
  const rawReps = get(cols.reps);
  const rawIntensity = get(cols.intensity);
  const rawWeight = get(cols.weight);
  const rawRpe = get(cols.rpe);
  const rawNotes = get(cols.notes);
  const rawComment = get(cols.comment);

  let targetSets = isBlank(rawSets) ? null : parseNumber(rawSets);
  if (targetSets !== null && (!Number.isInteger(targetSets) || targetSets < 1 || targetSets > 20)) {
    warn(address(r, cols.sets!), `Aantal sets "${cellText(rawSets)}" niet herkend.`);
    targetSets = null;
  } else if (targetSets === null && !isBlank(rawSets)) {
    warn(address(r, cols.sets!), `Aantal sets "${cellText(rawSets)}" niet herkend.`);
  }

  const reps = parseReps(rawReps);
  if (!reps.ok) warn(address(r, cols.reps!), `Reps "${cellText(rawReps)}" niet herkend.`);

  const weight = parseWeight(rawWeight);
  if (weight.warning) warn(address(r, cols.weight!), `${name}: ${weight.warning}`);

  const rpe = parseRpe(rawRpe);
  if (!rpe.ok) warn(address(r, cols.rpe!), `${name}: echte RPE "${cellText(rawRpe)}" niet herkend.`);

  // Regel uit de opdracht: geen gewicht én geen echte RPE = niet uitgevoerd.
  const performed = !isBlank(rawWeight) || !isBlank(rawRpe);

  let setCount = targetSets ?? 0;
  if (performed && setCount === 0) {
    warn(nameCell, `${name}: geen aantal sets ingevuld, 1 set aangenomen.`);
    setCount = 1;
  }

  const intensity = isBlank(rawIntensity)
    ? null
    : typeof rawIntensity === "number"
      ? `RPE ${String(rawIntensity).replace(".", ",")}`
      : cellText(rawIntensity);

  return {
    cell: nameCell,
    name,
    optional,
    comment: isBlank(rawComment) || parseWeekday(rawComment) !== null ? null : cellText(rawComment),
    targetSets,
    targetReps: isBlank(rawReps) ? null : cellText(rawReps),
    targetIntensity: intensity,
    actualRpe: rpe.rpe,
    notes: isBlank(rawNotes) ? null : cellText(rawNotes),
    performed,
    sets: performed
      ? Array.from({ length: setCount }, (_, i) => ({
          setNumber: i + 1,
          reps: reps.reps,
          weight: weight.weight,
          repsEstimated: reps.estimated,
        }))
      : [],
    extraFrom: null,
    // Altijd de originele celwaarden bewaren (zie raw-kolom in de database).
    raw: {
      name: rawName,
      comment: rawComment,
      sets: rawSets,
      reps: rawReps,
      intensity: rawIntensity,
      weight: rawWeight,
      rpe: rawRpe,
      notes: rawNotes,
    },
  };
}

// --- Maandtab ---------------------------------------------------------------

const SESSION_HEADER = /^(?:WEEK\s*\d+\s*[-–:,]?\s*)?SESSIE\s*(\d+)\b/;
const WEEK_HEADER = /^WEEK\s*(\d+)\b/;
const EXTRA_HEADER = /^EXTRA OEFENING/;
const RECAP_HEADER = /^WEKELIJKSE RECAP/;

type Block = { number: number; startCol: number; endCol: number; headerText: string | null };

/** Waar staan de weken? Eerst op "WEEK n"-koppen, anders op de "SESSIE 1"-koppen. */
function findWeekBlocks(grid: Grid): Block[] {
  const toBlocks = (starts: { c: number; number: number; text: string | null }[]) =>
    starts
      .sort((a, b) => a.c - b.c)
      .map((start, i, all) => ({
        number: start.number,
        startCol: start.c,
        endCol: (all[i + 1]?.c ?? grid.maxCol + 1) - 1,
        headerText: start.text,
      }));

  const weekCells = grid.find(WEEK_HEADER);
  if (weekCells.length > 0) {
    const byCol = new Map<number, Cell>();
    for (const cell of weekCells) if (!byCol.has(cell.c)) byCol.set(cell.c, cell);
    return toBlocks(
      [...byCol.values()].map((cell) => ({ c: cell.c, number: Number(cell.upper.match(WEEK_HEADER)![1]), text: cellText(cell.value) })),
    );
  }

  const firstSessions = grid.find(/^SESSIE\s*1$/);
  if (firstSessions.length === 0) return [];
  const topRow = Math.min(...firstSessions.map((cell) => cell.r));
  return toBlocks(firstSessions.filter((cell) => cell.r === topRow).map((cell, i) => ({ c: cell.c, number: i + 1, text: null })));
}

function parseWeek(grid: Grid, block: Block, warnings: ImportWarning[]): ParsedWeek {
  const warn = (cell: string, message: string) => warnings.push({ sheet: grid.name, cell, message });
  const headers = grid.find(SESSION_HEADER, block.startCol, block.endCol).filter((cell) => !EXTRA_HEADER.test(cell.upper));
  const extras = grid.find(EXTRA_HEADER, block.startCol, block.endCol);
  const recap = grid.find(RECAP_HEADER, block.startCol, block.endCol)[0] ?? null;
  // Rijen waar een sessie zeker stopt.
  const stopRows = [...headers.map((h) => h.r), ...extras.map((e) => e.r), ...(recap ? [recap.r] : [])];

  const sessions: (ParsedSession & { headerRow: number })[] = [];
  for (const header of headers) {
    const number = Number(header.upper.match(SESSION_HEADER)![1]);
    const end = Math.min(...stopRows.filter((row) => row > header.r), header.r + 60);
    const cols = resolveColumns(grid, header.r, header.c, block.endCol, SESSION_DEFAULTS);
    // Weekdag staat naast "SESSIE n" (of soms in dezelfde cel: "SESSIE 1 Maandag").
    const weekday =
      parseWeekday(grid.get(header.r, header.c + 1)) ??
      parseWeekday(header.upper.replace(SESSION_HEADER, "").trim());

    const session: ParsedSession & { headerRow: number } = {
      number,
      weekday,
      dayOffset: 0,
      exercises: [],
      cardio: [],
      headerRow: header.r,
    };

    for (let r = header.r + 1; r < end; r++) {
      // "CARDIO | SOORT | (DUUR)" sluit de sessie af; de rij eronder bevat de cardio.
      const cardioHeader = grid.find(/^\(DUUR\)$/, block.startCol, block.endCol).find((cell) => cell.r === r);
      if (cardioHeader) {
        const typeCol = grid.find(/^SOORT$/, block.startCol, block.endCol).find((cell) => cell.r === r)?.c ?? cardioHeader.c - 1;
        const flagCol = grid.find(/^CARDIO$/, block.startCol, block.endCol).find((cell) => cell.r === r)?.c ?? typeCol - 1;
        const flag = cellText(grid.get(r + 1, flagCol)).toUpperCase();
        const type = grid.get(r + 1, typeCol);
        const duration = grid.get(r + 1, cardioHeader.c);
        if (flag !== "NEE" && (!isBlank(type) || !isBlank(duration))) {
          session.cardio.push({
            type: isBlank(type) ? "Cardio" : cellText(type),
            durationMinutes: parseDuration(duration),
            raw: { done: grid.get(r + 1, flagCol), type, duration },
          });
        }
        break;
      }
      const exercise = parseExerciseRow(grid, r, cols, warn);
      if (exercise) session.exercises.push(exercise);
    }
    sessions.push(session);
  }

  // Blokken "EXTRA OEFENING VAN SESSIE 4 VOOR 3": de oefeningen horen bij sessie
  // 3 (VOOR), of anders bij de sessie net boven het blok.
  for (const extra of extras) {
    const from = Number(extra.upper.match(/VAN SESSIE\s*(\d+)/)?.[1] ?? NaN);
    const forSession = Number(extra.upper.match(/VOOR\s*(\d+)/)?.[1] ?? NaN);
    const target =
      sessions.find((s) => s.number === forSession) ??
      [...sessions].filter((s) => s.headerRow < extra.r).sort((a, b) => b.headerRow - a.headerRow)[0];
    const cols = resolveColumns(grid, extra.r, extra.c, block.endCol, EXTRA_DEFAULTS);
    const end = Math.min(...stopRows.filter((row) => row > extra.r), extra.r + 12);
    for (let r = extra.r + 1; r < end; r++) {
      const exercise = parseExerciseRow(grid, r, cols, warn); // "/"-rijen geven null
      if (!exercise) continue;
      if (!target) {
        warn(exercise.cell, `Extra oefening ${exercise.name} hoort bij geen enkele sessie; overgeslagen.`);
        continue;
      }
      target.exercises.push({ ...exercise, extraFrom: Number.isNaN(from) ? null : from });
    }
  }

  sessions.sort((a, b) => a.number - b.number);
  assignDayOffsets(sessions, block.number, (message) => warn(address(sessions[0]?.headerRow ?? 0, block.startCol), message));

  return {
    number: block.number,
    sessions: sessions.map((session) => ({
      number: session.number,
      weekday: session.weekday,
      dayOffset: session.dayOffset,
      exercises: session.exercises,
      cardio: session.cardio,
    })),
    checkin: recap ? parseRecap(grid, recap, block, warn) : null,
  };
}

/**
 * Dag binnen de week voor elke sessie. Met weekdag: die dag. Zonder weekdag:
 * de dag na de vorige sessie. Valt een weekdag vóór (of op) de vorige sessie,
 * dan is de kopregel waarschijnlijk niet aangepast: dan nemen we de dag erna.
 */
function assignDayOffsets(sessions: ParsedSession[], week: number, warn: (message: string) => void) {
  let previous = -1;
  for (const session of sessions) {
    let offset = session.weekday ?? previous + 1;
    if (session.weekday !== null && offset <= previous) {
      warn(`Week ${week}, sessie ${session.number}: weekdag valt vóór de vorige sessie; ingepland op de dag erna.`);
      offset = previous + 1;
    }
    session.dayOffset = offset;
    previous = offset;
  }
}

function parseRecap(grid: Grid, recap: Cell, block: Block, warn: (cell: string, message: string) => void): ParsedCheckin | null {
  const headerCols: Record<string, number> = {};
  for (let c = recap.c + 1; c <= block.endCol; c++) {
    const text = cellText(grid.get(recap.r, c)).toUpperCase();
    if (/^TRAINING/.test(text)) headerCols.training ??= c;
    else if (/^OVERAL+ FEELING/.test(text)) headerCols.overall ??= c;
    else if (/^MOTIVA/.test(text)) headerCols.motivation ??= c;
    else if (/^PAIN|^PIJN/.test(text)) headerCols.pain ??= c;
    else if (/^SESSIONS DONE|^SESSIES/.test(text)) headerCols.sessions ??= c;
    else if (/^(CIJFER|SCORE)/.test(text)) headerCols.score ??= c;
  }
  const valueRow = recap.r + 1;
  const value = (key: string) => (headerCols[key] === undefined ? null : grid.get(valueRow, headerCols[key]));
  const rating = (key: string) => {
    const { rating, note } = normalizeRating(value(key));
    if (note) warn(address(valueRow, headerCols[key]), `Recap: ${note}`);
    return rating;
  };

  // "Opmerking/feedback:" staat een paar rijen lager; de tekst staat rechts ervan.
  let feedback: string | null = null;
  const label = grid.find(/^OPMERKING/, block.startCol, block.endCol).find((cell) => cell.r > recap.r && cell.r <= recap.r + 4);
  if (label) {
    for (let c = label.c + 1; c <= block.endCol; c++) {
      if (!isBlank(grid.get(label.r, c))) {
        feedback = cellText(grid.get(label.r, c));
        break;
      }
    }
  }

  const sessionsDone = parseNumber(value("sessions"));
  const score = parseNumber(value("score"));
  const checkin: ParsedCheckin = {
    training: rating("training"),
    motivation: rating("motivation"),
    pain: rating("pain"),
    overallFeeling: rating("overall"),
    score: score !== null && score >= 1 && score <= 10 ? Math.round(score) : null,
    sessionsDone: sessionsDone !== null && sessionsDone >= 0 ? Math.round(sessionsDone) : null,
    feedback,
    raw: {
      training: value("training"),
      overall_feeling: value("overall"),
      motivation: value("motivation"),
      pain: value("pain"),
      sessions_done: value("sessions"),
      score: value("score"),
      feedback,
    },
  };
  const empty = Object.values(checkin.raw).every((v) => isBlank(v));
  return empty ? null : checkin;
}

/** Uitleg van de coach: tekst in de "WEEK 1"-kop, of onder een cel "UITLEG ...". */
function findDescription(grid: Grid, blocks: Block[]): string | null {
  const weekOne = blocks.find((block) => block.number === 1)?.headerText;
  const extra = weekOne?.replace(/^WEEK\s*1\s*[-–:,]?\s*(SESSIE\s*1)?\s*[-–:,]?\s*/i, "").trim();
  if (extra) return extra;

  const label = grid.find(/^UITLEG/)[0];
  if (!label) return null;
  for (let r = label.r + 1; r <= label.r + 6; r++) {
    const value = grid.get(r, label.c);
    if (!isBlank(value)) return String(value).trim();
  }
  const right = grid.get(label.r, label.c + 1);
  return isBlank(right) ? null : String(right).trim();
}

function parseMonthSheet(grid: Grid, year: number, month: number, warnings: ImportWarning[]): ParsedMonth {
  const blocks = findWeekBlocks(grid);
  if (blocks.length === 0) warnings.push({ sheet: grid.name, message: "Geen weken gevonden (geen kop \"SESSIE 1\" of \"WEEK 1\")." });
  const weeks = blocks
    .map((block) => parseWeek(grid, block, warnings))
    .filter((week) => week.sessions.some((s) => s.exercises.length > 0 || s.cardio.length > 0) || week.checkin);
  return { tab: grid.name, year, month, description: findDescription(grid, blocks), weeks };
}

// --- Info-tab ---------------------------------------------------------------

function excelDateToISO(value: CellValue): string | null {
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }
  const match = cellText(value).match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // dd/mm/jjjj
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : null;
}

const CATEGORY_NAMES: Record<string, string> = { LEGS: "Legs", BENCH: "Bench", DEADLIFT: "Deadlift", ANDERE: "Andere" };

function parseInfoSheet(grid: Grid, warnings: ImportWarning[]): ParsedInfo {
  const startLabel = grid.find(/^START\s*DATUM/)[0];
  const startDate = startLabel
    ? excelDateToISO(grid.dateSerial(startLabel.r, startLabel.c + 1) ?? grid.get(startLabel.r, startLabel.c + 1))
    : null;
  if (startLabel && !startDate) warnings.push({ sheet: grid.name, cell: address(startLabel.r, startLabel.c + 1), message: "Startdatum niet herkend." });

  // "Beschikbare oefening": de rij eronder bevat de categorieën, daaronder de oefeningen.
  const exercises: ParsedInfo["exercises"] = [];
  const listLabel = grid.find(/^BESCHIKBARE OEFENING/)[0];
  if (listLabel) {
    const headerRow = listLabel.r + 1;
    for (let c = listLabel.c; c <= listLabel.c + 6; c++) {
      const category = CATEGORY_NAMES[cellText(grid.get(headerRow, c)).toUpperCase()];
      if (!category) continue;
      for (let r = headerRow + 1; !isBlank(grid.get(r, c)); r++) {
        exercises.push({ name: cellText(grid.get(r, c)), category });
      }
    }
  }

  // Tabel "Blok | Squat | Bench | Deadlift | Totaal" (het totaal rekent de database zelf).
  const strengthTests: ParsedInfo["strengthTests"] = [];
  const blokHeader = grid.find(/^BLOK$/).find((cell) => /^SQUAT$/.test(cellText(grid.get(cell.r, cell.c + 1)).toUpperCase()));
  if (blokHeader) {
    const col: Record<string, number> = {};
    for (let c = blokHeader.c + 1; c <= blokHeader.c + 6; c++) {
      const text = cellText(grid.get(blokHeader.r, c)).toUpperCase();
      if (text === "SQUAT" || text === "BENCH" || text === "DEADLIFT") col[text.toLowerCase()] = c;
    }
    for (let r = blokHeader.r + 1; /^BLOK\s*\d+/i.test(cellText(grid.get(r, blokHeader.c))); r++) {
      const lift = (key: string) => {
        const value = col[key] === undefined ? null : parseNumber(grid.get(r, col[key]));
        return value && value > 0 ? value : null;
      };
      const test = { label: cellText(grid.get(r, blokHeader.c)), squat: lift("squat"), bench: lift("bench"), deadlift: lift("deadlift") };
      if (test.squat !== null || test.bench !== null || test.deadlift !== null) strengthTests.push(test);
    }
  }

  return { startDate, exercises, strengthTests };
}

// --- Werkboek ---------------------------------------------------------------

export function parseWorkbook(data: ArrayBuffer | Uint8Array): ParsedWorkbook {
  // cellNF: bewaar de getalopmaak per cel (cell.z), nodig om datumcellen te herkennen.
  const workbook = XLSX.read(data, { type: "array", cellNF: true });
  const warnings: ImportWarning[] = [];
  const months: ParsedMonth[] = [];
  const skippedTabs: string[] = [];
  let info: ParsedInfo | null = null;

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const month = parseMonthTab(name);
    if (month) {
      months.push(parseMonthSheet(new Grid(name.trim(), sheet), month.year, month.month, warnings));
    } else if (name.trim().toUpperCase() === "INFO") {
      info = parseInfoSheet(new Grid(name.trim(), sheet), warnings);
    } else {
      skippedTabs.push(name); // o.a. "RPE" en "Externals"
    }
  }

  months.sort((a, b) => a.year - b.year || a.month - b.month);
  return { info, months, skippedTabs, warnings };
}
