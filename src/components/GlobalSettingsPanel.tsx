import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { nanoid } from "nanoid";
import type { Tag } from "../models/types";
import EventModal from "./EventModal";

export default function GlobalSettingsPanel() {
	const tags = useLiveQuery<Tag[]>(
		() => ((db as any).tags ? (db as any).tags.toArray() : []),
		[],
	);
	const savedEvents = useLiveQuery(() => db.events.toArray(), []);

	const [newSavedTitle, setNewSavedTitle] = useState("");
	const [newSavedKind, setNewSavedKind] = useState<"date" | "range">("date");
	const [newSavedDate, setNewSavedDate] = useState("");
	const [newSavedStart, setNewSavedStart] = useState("");
	const [newSavedEnd, setNewSavedEnd] = useState("");
	const [newSavedNote, setNewSavedNote] = useState("");

	const [editingEventId, setEditingEventId] = useState<string | null>(null);
	const [editingEventDraft, setEditingEventDraft] = useState<any>(null);

	const [newTagName, setNewTagName] = useState("");
	const [editingTagId, setEditingTagId] = useState<string | null>(null);
	const [editingTagName, setEditingTagName] = useState("");

	return (
		<div className="pp-root">
			<div className="pp-scroll">
				<div className="pp-section">
					<div className="pp-section-header">
						<span className="pp-section-title">Saved events</span>
						<span className="pp-section-count">
							{(savedEvents ?? []).length}
						</span>
					</div>
					<p className="pp-section-note">
						Manage event templates stored in the database.
					</p>
					{(savedEvents ?? []).length === 0 ? (
						<p className="pp-empty">No saved events yet.</p>
					) : (
						<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
							{(savedEvents ?? []).map((ev: any) => (
								<div
									key={ev.id}
									style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<div style={{ flex: 1 }}>
										<strong>{ev.title}</strong>
										<div style={{ fontSize: 12, color: "#9ca3af" }}>
											{ev.kind === "date"
												? ev.date
												: `${ev.startDate ?? ""} → ${ev.endDate ?? ""}`}
										</div>
									</div>
									<button
										className="pp-btn-secondary"
										onClick={() => {
											setEditingEventId(ev.id);
											setEditingEventDraft(ev);
										}}>
										Edit
									</button>
									<button
										className="pp-btn-secondary"
										onClick={() => {
											if (confirm("Delete saved event?"))
												void db.events.delete(ev.id);
										}}>
										Delete
									</button>
								</div>
							))}
						</div>
					)}

					{editingEventId && editingEventDraft && (
						<EventModal
							event={editingEventDraft}
							onClose={() => {
								setEditingEventId(null);
								setEditingEventDraft(null);
							}}
							onSave={async (updated) => {
								try {
									await db.events.update(editingEventId, updated as any);
								} catch (e) {
									console.error(e);
								}
							}}
						/>
					)}

					<div style={{ marginTop: 12 }}>
						<div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
							<input
								className="pp-input"
								placeholder="Title"
								value={newSavedTitle}
								onChange={(e) => setNewSavedTitle(e.target.value)}
							/>
							<select
								className="pp-select"
								value={newSavedKind}
								onChange={(e) => setNewSavedKind(e.target.value as any)}>
								<option value="date">date</option>
								<option value="range">range</option>
							</select>
						</div>
						{newSavedKind === "date" ? (
							<input
								type="date"
								className="pp-input"
								value={newSavedDate}
								onChange={(e) => setNewSavedDate(e.target.value)}
							/>
						) : (
							<div className="pp-grid-2">
								<input
									type="date"
									className="pp-input"
									value={newSavedStart}
									onChange={(e) => setNewSavedStart(e.target.value)}
								/>
								<input
									type="date"
									className="pp-input"
									value={newSavedEnd}
									onChange={(e) => setNewSavedEnd(e.target.value)}
								/>
							</div>
						)}
						<textarea
							className="pp-textarea"
							rows={2}
							placeholder="Note"
							value={newSavedNote}
							onChange={(e) => setNewSavedNote(e.target.value)}
						/>
						<div style={{ display: "flex", gap: 8 }}>
							<button
								className="pp-btn-primary"
								onClick={async () => {
									const ev: any = {
										id: nanoid(),
										title:
											newSavedTitle ||
											(newSavedKind === "date"
												? newSavedDate
												: `${newSavedStart} → ${newSavedEnd}`),
										kind: newSavedKind,
										date: newSavedKind === "date" ? newSavedDate : undefined,
										startDate:
											newSavedKind === "range" ? newSavedStart : undefined,
										endDate: newSavedKind === "range" ? newSavedEnd : undefined,
										note: newSavedNote || undefined,
									};
									try {
										await db.events.add(ev);
										setNewSavedTitle("");
										setNewSavedDate("");
										setNewSavedStart("");
										setNewSavedEnd("");
										setNewSavedNote("");
									} catch (e) {
										console.error(e);
									}
								}}>
								Add saved event
							</button>
							<button
								className="pp-btn-secondary"
								onClick={() => {
									setNewSavedTitle("");
									setNewSavedDate("");
									setNewSavedStart("");
									setNewSavedEnd("");
									setNewSavedNote("");
								}}>
								Clear
							</button>
						</div>
					</div>
				</div>

				<div className="pp-section" style={{ marginTop: 18 }}>
					<div className="pp-section-header">
						<span className="pp-section-title">Tags</span>
						<span className="pp-section-count">{(tags ?? []).length}</span>
					</div>
					<p className="pp-section-note">
						Manage global tags and their names. Deleting a tag will remove it
						from all people.
					</p>
					{(tags ?? []).length === 0 ? (
						<p className="pp-empty">No tags yet.</p>
					) : (
						<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
							{(tags ?? []).map((t) => (
								<div
									key={t.id}
									style={{ display: "flex", gap: 8, alignItems: "center" }}>
									{editingTagId === t.id ? (
										<>
											<input
												className="pp-input"
												value={editingTagName}
												onChange={(e) => setEditingTagName(e.target.value)}
											/>
											<button
												className="pp-btn-primary"
												onClick={async () => {
													try {
														await db.tags.update(t.id, {
															name: editingTagName,
															normalized: String(editingTagName)
																.trim()
																.toLowerCase()
																.replace(/\s+/g, "_"),
														});
													} catch (e) {
														console.error(e);
													}
													setEditingTagId(null);
													setEditingTagName("");
												}}>
												Save
											</button>
											<button
												className="pp-btn-secondary"
												onClick={() => {
													setEditingTagId(null);
													setEditingTagName("");
												}}>
												Cancel
											</button>
										</>
									) : (
										<>
											<div style={{ flex: 1 }}>{t.name}</div>
											<button
												className="pp-btn-secondary"
												onClick={() => {
													setEditingTagId(t.id);
													setEditingTagName(t.name);
												}}>
												Rename
											</button>
											<button
												className="pp-btn-secondary"
												onClick={async () => {
													if (
														!confirm(
															"Delete this tag and remove it from all people?",
														)
													)
														return;
													try {
														await db.transaction(
															"rw",
															db.tags,
															db.people,
															async () => {
																await db.people
																	.toArray()
																	.then(async (peopleList) => {
																		for (const p of peopleList) {
																			const inrete = Array.isArray(
																				(p as any).inrete,
																			)
																				? (p as any).inrete.filter(
																						(id: string) => id !== t.id,
																					)
																				: [];
																			if (
																				inrete.length !==
																				((p as any).inrete ?? []).length
																			) {
																				await db.people.update(p.id, {
																					inrete,
																				});
																			}
																		}
																	});
																await db.tags.delete(t.id);
															},
														);
													} catch (e) {
														console.error(e);
													}
												}}>
												Delete
											</button>
										</>
									)}
								</div>
							))}
						</div>
					)}

					<div style={{ marginTop: 8, display: "flex", gap: 8 }}>
						<input
							className="pp-input"
							placeholder="New tag name"
							value={newTagName}
							onChange={(e) => setNewTagName(e.target.value)}
						/>
						<button
							className="pp-btn-primary"
							onClick={async () => {
								const name = String(newTagName ?? "").trim();
								if (!name) return;
								try {
									await (db as any).tags.add({
										id: nanoid(),
										name,
										normalized: name.toLowerCase().replace(/\s+/g, "_"),
									});
									setNewTagName("");
								} catch (e) {
									console.error(e);
								}
							}}>
							Add tag
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
