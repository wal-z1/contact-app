import { useEffect, useState } from "react";
import type { Event as EventType } from "../models/types";

const MODAL_STYLES = `
.ev-modal-backdrop{
  position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:1200;
}
.ev-modal{background:var(--bg);color:var(--text);border-radius:10px;max-width:720px;width:100%;padding:18px;box-shadow:0 8px 30px rgba(2,6,23,0.6);}
.ev-modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.ev-modal-title{font-weight:700}
.ev-modal-body{display:flex;gap:12px}
.ev-form{flex:1;display:flex;flex-direction:column;gap:10px}
.ev-input,.ev-textarea,.ev-select{background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);}
.ev-raw{width:320px;max-height:360px;overflow:auto}
.ev-actions{display:flex;gap:8px;margin-top:10px;}
`;

export default function EventModal({
	event,
	onClose,
	onSave,
}: {
	event: EventType;
	onClose: () => void;
	onSave: (updated: EventType) => Promise<void> | void;
}) {
	const [draft, setDraft] = useState<EventType>(event);
	const [raw, setRaw] = useState<string>(JSON.stringify(event, null, 2));
	const [useRaw, setUseRaw] = useState(false);

	useEffect(() => {
		setDraft(event);
		setRaw(JSON.stringify(event, null, 2));
	}, [event]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const save = async () => {
		try {
			const final = useRaw ? (JSON.parse(raw) as EventType) : draft;
			await onSave(final);
		} catch (e) {
			console.error("Failed to save event", e);
			alert("Invalid JSON or save failed");
			return;
		}
		onClose();
	};

	return (
		<div className="ev-modal-backdrop" onClick={onClose}>
			<style>{MODAL_STYLES}</style>
			<div
				className="ev-modal"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true">
				<div className="ev-modal-header">
					<div className="ev-modal-title">Edit saved event</div>
					<div style={{ display: "flex", gap: 8 }}>
						<button className="ev-btn" onClick={onClose} aria-label="Close">
							✕
						</button>
					</div>
				</div>

				<div className="ev-modal-body">
					<div className="ev-form">
						<label className="ev-field">
							<div style={{ fontSize: 12, color: "var(--text)" }}>Title</div>
							<input
								className="ev-input"
								value={draft.title ?? ""}
								onChange={(e) => setDraft({ ...draft, title: e.target.value })}
							/>
						</label>

						<div style={{ display: "flex", gap: 8 }}>
							<select
								className="ev-select"
								value={(draft as any).kind ?? "date"}
								onChange={(e) =>
									setDraft({ ...(draft as any), kind: e.target.value })
								}>
								<option value="date">date</option>
								<option value="range">range</option>
							</select>
							{((draft as any).kind ?? "date") === "date" ? (
								<input
									type="date"
									className="ev-input"
									value={(draft as any).date ?? ""}
									onChange={(e) =>
										setDraft({ ...(draft as any), date: e.target.value })
									}
								/>
							) : (
								<>
									<input
										type="date"
										className="ev-input"
										value={(draft as any).startDate ?? ""}
										onChange={(e) =>
											setDraft({ ...(draft as any), startDate: e.target.value })
										}
									/>
									<input
										type="date"
										className="ev-input"
										value={(draft as any).endDate ?? ""}
										onChange={(e) =>
											setDraft({ ...(draft as any), endDate: e.target.value })
										}
									/>
								</>
							)}
						</div>

						<label>
							<div style={{ fontSize: 12, color: "var(--text)" }}>Note</div>
							<textarea
								className="ev-textarea"
								rows={4}
								value={(draft as any).note ?? ""}
								onChange={(e) =>
									setDraft({ ...(draft as any), note: e.target.value })
								}
							/>
						</label>

						<label style={{ display: "flex", alignItems: "center", gap: 8 }}>
							<input
								type="checkbox"
								checked={useRaw}
								onChange={(e) => setUseRaw(e.target.checked)}
							/>
							<div style={{ fontSize: 12 }}>Edit raw JSON</div>
						</label>

						<div className="ev-actions">
							<button className="ev-btn ev-save" onClick={save}>
								Save
							</button>
							<button className="ev-btn ev-cancel" onClick={onClose}>
								Cancel
							</button>
						</div>
					</div>

					<div className="ev-raw">
						<textarea
							className="ev-textarea"
							style={{ width: "100%", height: 360 }}
							value={raw}
							onChange={(e) => setRaw(e.target.value)}
							disabled={!useRaw}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
