import { useState } from "react";
import { nanoid } from "nanoid";
import { db } from "../../db/db";

export default function AddEventForm({
	onAdd,
}: {
	onAdd: (
		note: string,
		kind: "date" | "range",
		date?: string,
		start?: string,
		end?: string,
	) => void;
}) {
	const [kind, setKind] = useState<"date" | "range">("date");
	const [date, setDate] = useState("");
	const [start, setStart] = useState("");
	const [end, setEnd] = useState("");
	const [note, setNote] = useState("");
	const [saveToLibrary, setSaveToLibrary] = useState(false);

	const handleAdd = () => {
		if (!note.trim()) return;
		onAdd(note, kind, date, start, end);
		if (saveToLibrary) {
			const ev = {
				id: nanoid(),
				title: note || (kind === "date" ? date : `${start} → ${end}`),
				kind,
				date: kind === "date" ? date : undefined,
				startDate: kind === "range" ? start : undefined,
				endDate: kind === "range" ? end : undefined,
				note: note || undefined,
			};
			void db.events.add(ev).catch(console.error);
		}
		setNote("");
		setDate("");
		setStart("");
		setEnd("");
		setSaveToLibrary(false);
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
			<div className="pp-radio-group">
				<label className="pp-radio-label">
					<input
						type="radio"
						checked={kind === "date"}
						onChange={() => setKind("date")}
					/>{" "}
					Single day
				</label>
				<label className="pp-radio-label">
					<input
						type="radio"
						checked={kind === "range"}
						onChange={() => setKind("range")}
					/>{" "}
					Date range
				</label>
			</div>
			{kind === "date" ? (
				<input
					type="date"
					className="pp-input"
					value={date}
					aria-label="Event date"
					onChange={(e) => setDate(e.target.value)}
				/>
			) : (
				<div className="pp-grid-2">
					<input
						type="date"
						className="pp-input"
						value={start}
						aria-label="Event start date"
						onChange={(e) => setStart(e.target.value)}
					/>
					<input
						type="date"
						className="pp-input"
						value={end}
						aria-label="Event end date"
						onChange={(e) => setEnd(e.target.value)}
					/>
				</div>
			)}
			<textarea
				className="pp-textarea"
				rows={2}
				placeholder="Event note… (Ctrl+Enter to add)"
				value={note}
				onChange={(e) => setNote(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
						e.preventDefault();
						handleAdd();
					}
				}}
			/>
			<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
				<label className="pp-checkbox-label">
					<input
						type="checkbox"
						checked={saveToLibrary}
						onChange={(e) => setSaveToLibrary(e.target.checked)}
					/>
					Save to library
				</label>
				<button
					type="button"
					className="pp-btn-primary"
					style={{ flex: 1 }}
					onClick={handleAdd}
					disabled={!note.trim()}>
					Add event
				</button>
			</div>
		</div>
	);
}
