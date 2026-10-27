"use client";
// Client Component: de preview herberekent datums live wanneer je de startdatum
// van week 1 aanpast, en houdt je keuzes voor oefeningkoppelingen bij.
import { Badge } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { sessionDate } from "@/lib/import/dates";
import type { ImportPreview } from "@/lib/import/actions";
import { nameKey, type ImportChoices, type NameChoice } from "@/lib/import/matching";
import type { ParsedExercise, ParsedMonth } from "@/lib/import/types";
import { formatNumber } from "@/lib/stats";
import { EXERCISE_CATEGORIES } from "@/lib/types";
import { groupByCategory, uniqueByName } from "@/lib/exercises";

type Props = {
  preview: ImportPreview;
  choices: ImportChoices;
  onChange: (choices: ImportChoices) => void;
};

const MONTH_NAMES = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

export function ImportPreviewView({ preview, choices, onChange }: Props) {
  const { workbook, unknown, library } = preview;
  const counts = workbook.months
    .filter((month) => choices.tabs[month.tab]?.include)
    .flatMap((month) => month.weeks.flatMap((week) => week.sessions))
    .reduce(
      (total, session) => ({
        sessions: total.sessions + 1,
        exercises: total.exercises + session.exercises.length,
        planned: total.planned + session.exercises.filter((e) => !e.performed).length,
      }),
      { sessions: 0, exercises: 0, planned: 0 },
    );

  const setName = (key: string, choice: NameChoice) => onChange({ ...choices, names: { ...choices.names, [key]: choice } });

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="preview-title" className="border border-chalk/30 p-5">
        <h2 id="preview-title" className="text-xl font-bold">
          Voorbeeld van {preview.label}
        </h2>
        <p className="mt-1 text-chalk/70">
          {workbook.months.length} maandtabs · {counts.sessions} sessies · {counts.exercises} oefeningrijen ({counts.planned} gepland, niet
          uitgevoerd)
          {workbook.skippedTabs.length > 0 && ` · overgeslagen: ${workbook.skippedTabs.join(", ")}`}
        </p>
        {workbook.warnings.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold">
              <span aria-hidden="true">▲ </span>
              {workbook.warnings.length} waarschuwingen: rijen die niet (helemaal) gelezen konden worden
            </summary>
            <ul className="mt-3 max-h-72 divide-y divide-chalk/10 overflow-y-auto border-y border-chalk/10 text-sm">
              {workbook.warnings.map((warning, index) => (
                <li key={index} className="flex gap-3 py-2">
                  <span className="w-28 shrink-0 font-mono text-chalk/60">
                    {warning.sheet}
                    {warning.cell ? `!${warning.cell}` : ""}
                  </span>
                  <span>{warning.message}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {workbook.info && (
        <section aria-labelledby="info-title">
          <h2 id="info-title" className="mb-3 text-lg font-semibold">
            Info-tab
          </h2>
          <label className="mb-3 flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-lime"
              checked={choices.includeInfo}
              onChange={(event) => onChange({ ...choices, includeInfo: event.target.checked })}
            />
            Maxima per blok en de oefeningenlijst importeren
          </label>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="border border-chalk/15 p-3">
              <dt className="text-chalk/60">Startdatum</dt>
              <dd className="font-semibold">{workbook.info.startDate ? formatDate(workbook.info.startDate, { day: "numeric", month: "long", year: "numeric" }) : "–"}</dd>
            </div>
            <div className="border border-chalk/15 p-3">
              <dt className="text-chalk/60">Oefeningen</dt>
              <dd className="font-semibold">{workbook.info.exercises.length} in de lijst</dd>
            </div>
            <div className="border border-chalk/15 p-3">
              <dt className="text-chalk/60">Maxima</dt>
              <dd className="font-semibold">
                {workbook.info.strengthTests.map((t) => `${t.label}: ${formatNumber((t.squat ?? 0) + (t.bench ?? 0) + (t.deadlift ?? 0))} kg`).join(" · ") || "–"}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {unknown.length > 0 && (
        <section aria-labelledby="names-title">
          <h2 id="names-title" className="text-lg font-semibold">
            Onbekende oefeningen ({unknown.length})
          </h2>
          <p className="mb-3 text-sm text-chalk/70">
            Deze namen staan niet (exact) in de bibliotheek. Koppel ze aan een bestaande oefening of maak ze nieuw aan.
          </p>
          <ul className="divide-y divide-chalk/10 border-y border-chalk/15">
            {unknown.map((name) => {
              const choice = choices.names[name.key];
              const selectValue = choice?.kind === "existing" ? choice.exerciseId : "new";
              return (
                <li key={name.key} className="grid gap-2 py-3 sm:grid-cols-[1fr_16rem_9rem] sm:items-center">
                  <p>
                    <span className="font-semibold">{name.name}</span>
                    <span className="ml-2 text-sm text-chalk/60">{name.count}×</span>
                  </p>
                  <label className="sr-only" htmlFor={`map-${name.key}`}>
                    Koppeling voor {name.name}
                  </label>
                  <select
                    id={`map-${name.key}`}
                    className="field min-h-11"
                    value={selectValue}
                    onChange={(event) =>
                      setName(
                        name.key,
                        event.target.value === "new"
                          ? { kind: "new", name: name.suggestion.kind === "new" ? name.suggestion.name : name.name, category: name.suggestion.kind === "new" ? name.suggestion.category : "Andere" }
                          : { kind: "existing", exerciseId: event.target.value },
                      )
                    }
                  >
                    <option value="new">+ Nieuw: {choice?.kind === "new" ? choice.name : name.name}</option>
                    {groupByCategory(uniqueByName(library, null)).map((group) => (
                      <optgroup key={group.category} label={group.category}>
                        {group.items.map((exercise) => (
                          <option key={exercise.id} value={exercise.id}>
                            {exercise.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {choice?.kind === "new" ? (
                    <>
                      <label className="sr-only" htmlFor={`cat-${name.key}`}>
                        Categorie voor {name.name}
                      </label>
                      <select
                        id={`cat-${name.key}`}
                        className="field min-h-11"
                        value={choice.category}
                        onChange={(event) => setName(name.key, { ...choice, category: event.target.value })}
                      >
                        {EXERCISE_CATEGORIES.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span className="text-sm text-chalk/60">Gekoppeld</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {workbook.months.map((month) => (
        <MonthPreview
          key={month.tab}
          month={month}
          include={choices.tabs[month.tab]?.include ?? false}
          week1={choices.tabs[month.tab]?.week1 ?? ""}
          names={choices.names}
          onChange={(tab) => onChange({ ...choices, tabs: { ...choices.tabs, [month.tab]: tab } })}
        />
      ))}
    </div>
  );
}

function MonthPreview({
  month,
  include,
  week1,
  names,
  onChange,
}: {
  month: ParsedMonth;
  include: boolean;
  week1: string;
  names: ImportChoices["names"];
  onChange: (tab: { include: boolean; week1: string }) => void;
}) {
  return (
    <section aria-labelledby={`month-${month.tab}`} className={cn("border border-chalk/15", !include && "opacity-60")}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-chalk/15 p-4">
        <div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-lime" checked={include} onChange={(event) => onChange({ include: event.target.checked, week1 })} />
            <h2 id={`month-${month.tab}`} className="text-xl font-bold">
              {month.tab}
            </h2>
            <span className="text-sm text-chalk/60">
              {MONTH_NAMES[month.month]} {month.year} · {month.weeks.length} weken
            </span>
          </label>
          {month.description && <p className="mt-2 max-w-prose text-sm whitespace-pre-line text-chalk/70">{month.description}</p>}
        </div>
        <div>
          <label htmlFor={`week1-${month.tab}`} className="label">
            Week 1 start op
          </label>
          <input
            id={`week1-${month.tab}`}
            type="date"
            className="field min-h-11"
            value={week1}
            disabled={!include}
            onChange={(event) => onChange({ include, week1: event.target.value })}
          />
        </div>
      </div>

      <div className="divide-y divide-chalk/10">
        {month.weeks.map((week) => (
          <details key={week.number} className="group">
            <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 hover:bg-chalk/5">
              <span className="font-semibold">Week {week.number}</span>
              <span className="text-sm text-chalk/60">
                {week.sessions.length} sessies
                {week1 && week.sessions.length > 0 &&
                  ` · ${formatDate(sessionDate(week1, week.number, week.sessions[0].dayOffset), { weekday: "short", day: "numeric", month: "short" })} – ${formatDate(sessionDate(week1, week.number, week.sessions.at(-1)!.dayOffset), { weekday: "short", day: "numeric", month: "short" })}`}
              </span>
              {week.checkin && <Badge>Recap</Badge>}
              <span aria-hidden="true" className="ml-auto text-chalk/50 group-open:rotate-90">
                ›
              </span>
            </summary>
            <div className="flex flex-col gap-4 px-4 pb-4">
              {week.sessions.map((session) => (
                <div key={session.number}>
                  <p className="mb-1 text-sm font-semibold">
                    Sessie {session.number}
                    {week1 && (
                      <span className="font-normal text-chalk/60">
                        {" "}
                        · {formatDate(sessionDate(week1, week.number, session.dayOffset), { weekday: "long", day: "numeric", month: "short" })}
                      </span>
                    )}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-lg text-left text-sm tabular-nums">
                      <caption className="sr-only">
                        Week {week.number}, sessie {session.number}
                      </caption>
                      <thead className="text-chalk/60">
                        <tr>
                          <th scope="col" className="py-1 font-medium">Oefening</th>
                          <th scope="col" className="font-medium">Doel</th>
                          <th scope="col" className="font-medium">Gedaan</th>
                          <th scope="col" className="font-medium">Echte RPE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.exercises.map((exercise) => (
                          <ExerciseRow key={exercise.cell} exercise={exercise} isNew={names[nameKey(exercise.name)]?.kind === "new"} />
                        ))}
                        {session.cardio.map((cardio, index) => (
                          <tr key={`cardio-${index}`} className="border-t border-chalk/10">
                            <th scope="row" className="py-1 font-normal">
                              Cardio: {cardio.type}
                            </th>
                            <td colSpan={3}>{cardio.durationMinutes ? `${cardio.durationMinutes} min` : "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {week.checkin && (
                <p className="text-sm text-chalk/80">
                  <span className="font-semibold">Recap:</span> training {week.checkin.training ?? "–"} · motivatie {week.checkin.motivation ?? "–"} · pijn{" "}
                  {week.checkin.pain ?? "–"}
                  {week.checkin.sessionsDone !== null && ` · ${week.checkin.sessionsDone} sessies`}
                  {week.checkin.feedback && ` · “${week.checkin.feedback}”`}
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function ExerciseRow({ exercise, isNew }: { exercise: ParsedExercise; isNew: boolean }) {
  const first = exercise.sets[0];
  return (
    <tr className={cn("border-t border-chalk/10", !exercise.performed && "text-chalk/50")}>
      <th scope="row" className="py-1 pr-2 font-normal">
        {exercise.name}
        {exercise.optional && <span className="ml-1 text-chalk/60">(opt.)</span>}
        {isNew && <span className="ml-1 text-xs font-semibold">NIEUW</span>}
        <span className="ml-1 font-mono text-xs text-chalk/40">{exercise.cell}</span>
      </th>
      <td className="pr-2">
        {exercise.targetSets ?? "?"} × {exercise.targetReps ?? "?"}
        {exercise.targetIntensity ? ` · ${exercise.targetIntensity}` : ""}
      </td>
      <td className="pr-2">
        {exercise.performed
          ? `${exercise.sets.length} × ${first?.reps ?? "?"}${first?.repsEstimated ? "*" : ""} @ ${first?.weight !== null && first?.weight !== undefined ? `${formatNumber(first.weight, 2)} kg` : "?"}`
          : "gepland"}
      </td>
      <td>{exercise.actualRpe !== null ? formatNumber(exercise.actualRpe, 2) : "–"}</td>
    </tr>
  );
}
