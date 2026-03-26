import type { TimelineEvent } from "../../models/types";
import AddEventForm from "../PersonPanel/AddEventForm";
import {
  countBadge,
  fieldBase,
  ghostButton,
  sectionHeader,
  sectionHint,
  sectionTitle,
  softCard,
} from "./constants";

type SavedEvent = {
  id: string;
  title?: string;
  note?: string;
  kind: "date" | "range";
  date?: string;
  startDate?: string;
  endDate?: string;
};

type Props = {
  events: TimelineEvent[];
  savedEvents: SavedEvent[];
  selectedSavedEventId: string;
  setSelectedSavedEventId: (value: string) => void;
  onDeleteEvent: (id: string) => void;
  onAddSavedEvent: (eventId: string) => void;
  onAddEvent: (
    note: string,
    kind?: string,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) => void;
};

export default function TimelineSection({
  events,
  savedEvents,
  selectedSavedEventId,
  setSelectedSavedEventId,
  onDeleteEvent,
  onAddSavedEvent,
  onAddEvent,
}: Props) {
  return (
    <>
      <div className={sectionHeader}>
        <span className={sectionTitle}>Timeline</span>
        <span className={countBadge}>{events.length}</span>
      </div>

      <div className={sectionHint}>
        Capture meaningful moments to make relationships easier to review.
      </div>

      {events.length === 0 ? (
        <p className="py-2 text-xs italic text-[#6b7280]">
          No events recorded yet.
        </p>
      ) : (
        <div className="relative mb-3 flex flex-col">
          {/* Vertical spine */}
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-[color:var(--accent)]/20" />

          {events.map((event) => {
            const label =
              event.kind === "range"
                ? `${event.startDate ?? ""} → ${event.endDate ?? ""}`
                : (event.date ?? "");

            return (
              <div
                key={event.id}
                className={`${softCard} group relative mb-1.5 ml-5 flex items-start gap-3 border-l-2 border-l-[color:var(--accent)]/40 pl-3 pr-2 py-2.5 transition-all duration-150 hover:border-l-[color:var(--accent)] hover:shadow-sm`}
              >
                {/* Spine dot */}
                <div className="absolute -left-[1.45rem] top-[13px] h-2 w-2 rounded-full border-2 border-[color:var(--accent)] bg-[color:var(--bg)] transition-colors duration-150 group-hover:bg-[color:var(--accent)]" />

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-sm bg-[color:var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--accent)]">
                      {label}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap text-xs leading-relaxed text-[color:var(--text-h)]">
                    {event.note}
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-0.5 shrink-0 rounded p-0.5 text-[15px] leading-none text-[#6b7280] opacity-0 transition-all duration-100 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                  onClick={() => onDeleteEvent(event.id)}
                  aria-label="Delete event"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {savedEvents.length > 0 && (
        <div className="mb-3 flex gap-2">
          <select
            className={`${fieldBase} flex-1 appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%226%22%20viewBox=%220%200%2010%206%22%3E%3Cpath%20d=%22M1%201l4%204%204-4%22%20stroke=%22%239ca3af%22%20stroke-width=%221.5%22%20fill=%22none%22%20stroke-linecap=%22round%22/%3E%3C/svg%3E')] bg-[position:right_10px_center] bg-no-repeat pr-8`}
            value={selectedSavedEventId}
            onChange={(e) => setSelectedSavedEventId(e.target.value)}
          >
            <option value="">Add from saved event library…</option>
            {savedEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}{" "}
                {event.date
                  ? `(${event.date})`
                  : event.startDate
                    ? `(${event.startDate})`
                    : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`${ghostButton} shrink-0 px-3 disabled:cursor-not-allowed disabled:opacity-40`}
            aria-label="Add selected saved event"
            disabled={!selectedSavedEventId}
            onClick={() => {
              onAddSavedEvent(selectedSavedEventId);
              setSelectedSavedEventId("");
            }}
          >
            Add
          </button>
        </div>
      )}

      <AddEventForm
        onAdd={(note, kind, date, start, end) =>
          onAddEvent(note, kind, date, start, end)
        }
      />
    </>
  );
}