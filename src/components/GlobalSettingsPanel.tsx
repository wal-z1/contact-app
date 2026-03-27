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

	// New state for tag searching
	const [tagSearchQuery, setTagSearchQuery] = useState("");

	// Pagination state for tags
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	// Filter tags based on the search query
	const filteredTags = (tags ?? []).filter((t) =>
		(t.name || "").toLowerCase().includes(tagSearchQuery.toLowerCase()),
	);

	// Paginated tags
	const totalPages = Math.ceil(filteredTags.length / itemsPerPage);
	const paginatedTags = filteredTags.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage,
	);

	// Reset to first page when search query changes
	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTagSearchQuery(e.target.value);
		setCurrentPage(1);
	};

	return (
		<div className="h-full w-full flex flex-col overflow-hidden text-[14px] text-(--text)">
			<div className="flex-1 overflow-y-auto pb-8 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-(--border) [&::-webkit-scrollbar-thumb]:rounded-sm">
				<div className="px-5 mt-5">
					<div className="flex items-center justify-between pb-2 border-b border-(--border) mb-3">
						<span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text)]">
							Saved events
						</span>
						<span className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px]">
							{(savedEvents ?? []).length}
						</span>
					</div>
					<p className="text-[11px] leading-[1.45] text-[color:var(--text)] mb-2.5">
						Manage event templates stored in the database.
					</p>
					{(savedEvents ?? []).length === 0 ? (
						<p className="text-xs text-[#4b5563] italic py-1">
							No saved events yet.
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{(savedEvents ?? []).map((ev: any) => (
								<div key={ev.id} className="flex items-center gap-2">
									<div className="flex-1">
										<strong>{ev.title}</strong>
										<div className="text-xs text-[#9ca3af]">
											{ev.kind === "date"
												? ev.date
												: `${ev.startDate ?? ""} → ${ev.endDate ?? ""}`}
										</div>
									</div>
									<button
										className="bg-[rgba(255,255,255,0.04)] border border-[color:var(--border)] rounded-[7px] py-2 px-[14px] text-xs font-semibold text-[color:var(--text)] cursor-pointer transition-all duration-150 hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-h)] disabled:opacity-40 disabled:cursor-not-allowed"
										onClick={() => {
											setEditingEventId(ev.id);
											setEditingEventDraft(ev);
										}}>
										Edit
									</button>
									<button
										className="bg-[rgba(255,255,255,0.04)] border border-[color:var(--border)] rounded-[7px] py-2 px-[14px] text-xs font-semibold text-[color:var(--text)] cursor-pointer transition-all duration-150 hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-h)] disabled:opacity-40 disabled:cursor-not-allowed"
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

					<div className="mt-3">
						<div className="flex gap-2 mb-2">
							<input
								className="bg-white/5 border border-[color:var(--border)] rounded-[7px] py-2 px-2.5 text-[13px] text-[color:var(--text-h)] w-full box-border transition-colors duration-150 placeholder:text-white/20 focus:outline-none focus:border-[color:var(--accent)] focus:bg-[rgba(var(--accent-rgb),0.05)]"
								placeholder="Title"
								value={newSavedTitle}
								onChange={(e) => setNewSavedTitle(e.target.value)}
							/>
							<select
								className="appearance-none bg-[rgba(255,255,255,0.03)] border border-[color:var(--border)] rounded-[7px] py-2 pl-2.5 pr-[30px] text-[13px] text-[color:var(--text-h)] w-full cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%226%22%20viewBox=%220%200%2010%206%22%3E%3Cpath%20d=%22M1%201l4%204%204-4%22%20stroke=%22%239ca3af%22%20stroke-width=%221.5%22%20fill=%22none%22%20stroke-linecap=%22round%22/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_10px_center] transition-colors duration-150 focus:outline-none focus:border-[color:var(--accent)]"
								value={newSavedKind}
								onChange={(e) => setNewSavedKind(e.target.value as any)}>
								<option value="date">date</option>
								<option value="range">range</option>
							</select>
						</div>
						{newSavedKind === "date" ? (
							<input
								type="date"
								className="bg-white/5 border border-[color:var(--border)] rounded-[7px] py-2 px-2.5 text-[13px] text-[color:var(--text-h)] w-full box-border transition-colors duration-150 placeholder:text-white/20 focus:outline-none focus:border-[color:var(--accent)] focus:bg-[rgba(var(--accent-rgb),0.05)]"
								value={newSavedDate}
								onChange={(e) => setNewSavedDate(e.target.value)}
							/>
						) : (
							<div className="grid grid-cols-2 gap-2.5">
								<input
									type="date"
									className="bg-white/5 border border-[color:var(--border)] rounded-[7px] py-2 px-2.5 text-[13px] text-[color:var(--text-h)] w-full box-border transition-colors duration-150 placeholder:text-white/20 focus:outline-none focus:border-[color:var(--accent)] focus:bg-[rgba(var(--accent-rgb),0.05)]"
									value={newSavedStart}
									onChange={(e) => setNewSavedStart(e.target.value)}
								/>
								<input
									type="date"
									className="bg-white/5 border border-[color:var(--border)] rounded-[7px] py-2 px-2.5 text-[13px] text-[color:var(--text-h)] w-full box-border transition-colors duration-150 placeholder:text-white/20 focus:outline-none focus:border-[color:var(--accent)] focus:bg-[rgba(var(--accent-rgb),0.05)]"
									value={newSavedEnd}
									onChange={(e) => setNewSavedEnd(e.target.value)}
								/>
							</div>
						)}
						<textarea
							className="resize-y bg-white/5 border border-[color:var(--border)] rounded-[7px] py-2 px-2.5 text-[13px] text-[color:var(--text-h)] w-full box-border transition-colors duration-150 placeholder:text-white/20 focus:outline-none focus:border-[color:var(--accent)] focus:bg-[rgba(var(--accent-rgb),0.05)]"
							rows={2}
							placeholder="Note"
							value={newSavedNote}
							onChange={(e) => setNewSavedNote(e.target.value)}
						/>
						<div className="flex gap-2">
							<button
								className="bg-[color:var(--accent)] border-none rounded-[7px] py-[9px] px-4 text-xs font-bold text-white cursor-pointer w-full transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:filter-none"
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
								className="bg-[rgba(255,255,255,0.04)] border border-[color:var(--border)] rounded-[7px] py-2 px-[14px] text-xs font-semibold text-[color:var(--text)] cursor-pointer transition-all duration-150 hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-h)] disabled:opacity-40 disabled:cursor-not-allowed"
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

				<div className="px-5 mt-[18px]">
					<div className="flex items-center justify-between pb-2 border-b border-[color:var(--border)] mb-3">
						<span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text)]">
							Tags
						</span>
						<span className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px]">
							{(tags ?? []).length}
						</span>
					</div>
					<p className="text-[11px] leading-[1.45] text-[color:var(--text)] mb-2.5">
						Manage global tags and their names. Deleting a tag will remove it
						from all people.
					</p>

					{/* Search Feature */}
					{((tags ?? []).length > 0 || tagSearchQuery) && (
						<div className="mb-3">
							<input
								className="bg-white/5 border border-[color:var(--border)] rounded-[7px] py-2 px-2.5 text-[13px] text-[color:var(--text-h)] w-full box-border transition-colors duration-150 placeholder:text-white/20 focus:outline-none focus:border-[color:var(--accent)] focus:bg-[rgba(var(--accent-rgb),0.05)]"
								placeholder="Search tags..."
								value={tagSearchQuery}
								onChange={handleSearchChange}
							/>
						</div>
					)}

					{filteredTags.length === 0 ? (
						<p className="text-xs text-[#4b5563] italic py-1">
							{tagSearchQuery ? "No tags match your search." : "No tags yet."}
						</p>
					) : (
						<>
							<div className="flex flex-col gap-2">
								{paginatedTags.map((t) => (
									<div key={t.id} className="flex gap-2 items-center">
										{editingTagId === t.id ? (
											<>
												<input
													className="bg-white/5 border border-[color:var(--border)] rounded-[7px] py-2 px-2.5 text-[13px] text-[color:var(--text-h)] w-full box-border transition-colors duration-150 placeholder:text-white/20 focus:outline-none focus:border-[color:var(--accent)] focus:bg-[rgba(var(--accent-rgb),0.05)]"
													value={editingTagName}
													onChange={(e) => setEditingTagName(e.target.value)}
												/>
												<button
													className="bg-[color:var(--accent)] border-none rounded-[7px] py-[9px] px-4 text-xs font-bold text-white cursor-pointer w-full transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:filter-none"
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
													className="bg-[rgba(255,255,255,0.04)] border border-[color:var(--border)] rounded-[7px] py-2 px-[14px] text-xs font-semibold text-[color:var(--text)] cursor-pointer transition-all duration-150 hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-h)] disabled:opacity-40 disabled:cursor-not-allowed"
													onClick={() => {
														setEditingTagId(null);
														setEditingTagName("");
													}}>
													Cancel
												</button>
											</>
										) : (
											<>
												<div className="flex-1">{t.name}</div>
												<button
													className="bg-[rgba(255,255,255,0.04)] border border-[color:var(--border)] rounded-[7px] py-2 px-[14px] text-xs font-semibold text-[color:var(--text)] cursor-pointer transition-all duration-150 hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-h)] disabled:opacity-40 disabled:cursor-not-allowed"
													onClick={() => {
														setEditingTagId(t.id);
														setEditingTagName(t.name);
													}}>
													Rename
												</button>
												<button
													className="bg-[rgba(255,255,255,0.04)] border border-[color:var(--border)] rounded-[7px] py-2 px-[14px] text-xs font-semibold text-[color:var(--text)] cursor-pointer transition-all duration-150 hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-h)] disabled:opacity-40 disabled:cursor-not-allowed"
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

							{/* Pagination Controls */}
							{totalPages > 1 && (
								<div className="flex justify-between items-center mt-3 pt-2 border-t border-[#2e303a]">
									<button
										className="bg-[rgba(255,255,255,0.04)] border border-[color:var(--border)] rounded-[7px] py-1.5 px-3 text-xs font-semibold text-[color:var(--text)] cursor-pointer transition-all duration-150 hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-h)] disabled:opacity-40 disabled:cursor-not-allowed"
										onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
										disabled={currentPage === 1}>
										Previous
									</button>
									<span className="text-xs text-[#9ca3af]">
										Page {currentPage} of {totalPages}
									</span>
									<button
										className="bg-[rgba(255,255,255,0.04)] border border-[color:var(--border)] rounded-[7px] py-1.5 px-3 text-xs font-semibold text-[color:var(--text)] cursor-pointer transition-all duration-150 hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-h)] disabled:opacity-40 disabled:cursor-not-allowed"
										onClick={() =>
											setCurrentPage((p) => Math.min(totalPages, p + 1))
										}
										disabled={currentPage === totalPages}>
										Next
									</button>
								</div>
							)}
						</>
					)}

					<div className="mt-3 pt-3 border-t border-[#e5e7eb] flex gap-2">
						<input
							className="bg-white/5 border border-[color:var(--border)] rounded-[7px] py-2 px-2.5 text-[13px] text-[color:var(--text-h)] w-full box-border transition-colors duration-150 placeholder:text-white/20 focus:outline-none focus:border-[color:var(--accent)] focus:bg-[rgba(var(--accent-rgb),0.05)]"
							placeholder="New tag name"
							value={newTagName}
							onChange={(e) => setNewTagName(e.target.value)}
						/>
						<button
							className="bg-[color:var(--accent)] border-none rounded-[7px] py-[9px] px-4 text-xs font-bold text-white cursor-pointer w-full transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:filter-none"
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
									// If the new tag would be visible in the current search, reset to first page
									if (
										name.toLowerCase().includes(tagSearchQuery.toLowerCase())
									) {
										setCurrentPage(1);
									} else {
										// If it doesn't match the search, clear search to show it
										setTagSearchQuery("");
										setCurrentPage(1);
									}
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
