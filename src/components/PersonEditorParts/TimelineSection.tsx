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
			<div className={`${sectionHeader} items-center`}>
				<span className={sectionTitle}>Timeline</span>
				<span
					className={`${countBadge} border border-white/10 bg-white/5 text-[color:var(--text-h)]`}>
					{events.length}
				</span>
			</div>

			<div className={`${sectionHint} mt-1 text-[color:var(--text)]/80`}>
				Capture meaningful moments to make relationships easier to review.
			</div>

			{events.length === 0 ? (
				<div
					className={`${softCard} mt-3 rounded-xl border border-dashed border-white/12 px-4 py-4 text-sm text-[color:var(--text)]/70`}>
					No events recorded yet.
				</div>
			) : (
				<div className="relative mt-3 mb-4 flex flex-col">
					{/* Vertical spine */}
					<div className="absolute left-3 top-3 bottom-3 w-px bg-[color:var(--accent)]/30" />

					{events.map((event) => {
						const label =
							event.kind === "range"
								? `${event.startDate ?? ""} → ${event.endDate ?? ""}`
								: `${event.date ?? ""}`;

						return (
							<div
								key={event.id}
								className={[
									softCard,
									"group relative ml-9 mb-3 rounded-xl border border-white/10",
									"bg-[color:var(--bg)]/80 px-4 py-3",
									"transition duration-150",
									"hover:border-[color:var(--accent)]/45 hover:shadow-md",
								].join(" ")}>
								{/* Spine dot */}
								<div className="absolute -left-8 top-4 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[color:var(--accent)] bg-[color:var(--bg)] shadow-sm">
									<div className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
								</div>

								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										<div className="mb-2 flex items-center gap-2">
											<span className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/12 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[color:var(--accent)]">
												{label}
											</span>
										</div>

										<div className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--text-h)]">
											{event.note}
										</div>
									</div>

									<button
										type="button"
										className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-base leading-none text-[color:var(--text)]/55 transition hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/30"
										onClick={() => onDeleteEvent(event.id)}
										aria-label="Delete event">
										×
									</button>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{savedEvents.length > 0 && (
				<div className="mb-4 flex items-stretch gap-2">
					<select
						className={[
							fieldBase,
							"min-h-11 flex-1 rounded-xl border border-white/12 bg-[color:var(--bg)] px-3 pr-10 text-sm text-[color:var(--text-h)] shadow-sm",
							"focus:border-[color:var(--accent)]/50 focus:ring-2 focus:ring-[color:var(--accent)]/20",
							"appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%226%22%20viewBox=%220%200%2010%206%22%3E%3Cpath%20d=%22M1%201l4%204%204-4%22%20stroke=%22%239ca3af%22%20stroke-width=%221.5%22%20fill=%22none%22%20stroke-linecap=%22round%22/%3E%3C/svg%3E')] bg-[position:right_12px_center] bg-no-repeat",
						].join(" ")}
						value={selectedSavedEventId}
						onChange={(e) => setSelectedSavedEventId(e.target.value)}>
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
						className={[
							ghostButton,
							"min-h-11 shrink-0 rounded-xl border border-white/12 px-4 font-medium",
							"hover:border-[color:var(--accent)]/35 hover:bg-[color:var(--accent)]/10",
							"disabled:cursor-not-allowed disabled:opacity-40",
						].join(" ")}
						aria-label="Add selected saved event"
						disabled={!selectedSavedEventId}
						onClick={() => {
							onAddSavedEvent(selectedSavedEventId);
							setSelectedSavedEventId("");
						}}>
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
