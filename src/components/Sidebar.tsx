import { useState, useMemo, memo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import type { Person } from "../models/types";

// Import the new, decomposed components
import { PeopleList } from "./PeopleList";
import { DataManagement } from "./DataManagement";
import { AddPersonModal } from "./AddPersonModal";

const SidebarHeader = memo(function SidebarHeader({
	peopleCount,
	visibleCount,
}: {
	peopleCount: number;
	visibleCount: number;
}) {
	return (
		<>
			<div className="rm-shell-title">
				<div className="rm-shell-kicker">Workspace</div>
				<div className="rm-shell-heading">People manager</div>
				<div className="rm-shell-sub">
					Add contacts, filter by year, and import/export your local data.
				</div>
			</div>
			<div className="rm-stats" aria-label="Data summary">
				<div className="rm-stat">
					<div className="rm-stat-label">People</div>
					<div className="rm-stat-value">{peopleCount}</div>
				</div>
				<div className="rm-stat">
					<div className="rm-stat-label">Visible list</div>
					<div className="rm-stat-value">{visibleCount}</div>
				</div>
			</div>
		</>
	);
});

export default function Sidebar() {
	const people = useLiveQuery<Person[]>(() => db.people.toArray(), []) ?? [];
	const activeYear = useAppStore((s) => s.activeYear);
	const setActiveYear = useAppStore((s) => s.setActiveYear);

	const [isModalOpen, setIsModalOpen] = useState(false);

	const yearOptions = useMemo(() => {
		const yrs = new Set(people.map((p) => p.year).filter(Boolean));
		return [...yrs].sort((a, b) => b - a);
	}, [people]);

	const visibleCount = useMemo(
		() =>
			people.filter((p) =>
				activeYear === "all" ? true : p.year === activeYear,
			).length,
		[people, activeYear],
	);

	return (
		<>
			<style>{`
				/* All original CSS styles remain here */
				.rm-shell-title { display: flex; flex-direction: column; gap: 3px; }
				.rm-shell-kicker { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; color: var(--text); }
				.rm-shell-heading { font-size: 15px; font-weight: 700; color: var(--text-h); }
				.rm-shell-sub { font-size: 11px; line-height: 1.4; color: var(--text); }
				.rm-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
				.rm-stat { border: 1px solid var(--border); background: rgba(255,255,255,0.03); border-radius: 8px; padding: 8px; }
				.rm-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text); font-weight: 700; }
				.rm-stat-value { margin-top: 2px; font-size: 16px; font-weight: 700; color: var(--text-h); }
				.rm-toolbar { position: sticky; top: 0; z-index: 3; display: flex; flex-direction: column; gap: 10px; padding-bottom: 10px; background: linear-gradient(180deg, rgba(15, 18, 33, 0.98) 0%, rgba(15, 18, 33, 0.94) 78%, rgba(15, 18, 33, 0) 100%); }
				.rm-action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
				.rm-action-grid > button:first-child { grid-column: 1 / -1; }
				@media (max-width: 520px) { .rm-action-grid { grid-template-columns: 1fr; } .rm-action-grid > button:first-child { grid-column: auto; } }
				.rm-filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
				.rm-filter-label { font-size: 11px; font-weight: 700; color: var(--text); letter-spacing: 0.06em; text-transform: uppercase; }
				.rm-sidebar-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-width: 0; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: 1px solid var(--accent-border); background: var(--accent-bg); color: var(--accent); letter-spacing: 0.01em; }
				.rm-sidebar-btn.primary { font-size: 14px; padding: 9px 14px; }
				.rm-sidebar-btn:hover { background: rgba(var(--accent-rgb), 0.25); }
				.rm-sidebar-btn:disabled { opacity: 0.55; cursor: not-allowed; }
				.rm-upload-note { font-size: 11px; line-height: 1.45; color: var(--text); }
				.rm-upload-msg { font-size: 11px; line-height: 1.4; }
				.rm-upload-msg.ok { color: #86efac; }
				.rm-upload-msg.err { color: #fca5a5; }
				.rm-upload-card { border: 1px solid var(--border); background: rgba(255,255,255,0.03); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
				.rm-upload-steps { font-size: 11px; line-height: 1.45; color: var(--text); display: grid; gap: 4px; padding: 8px 0; }
				.rm-upload-example { margin: 0; border: 1px solid rgba(255,255,255,0.08); background: rgba(15, 23, 42, 0.45); border-radius: 8px; padding: 10px; font-size: 11px; line-height: 1.45; color: #d1d5db; overflow-x: auto; white-space: pre; }
				.rm-upload-details { display: flex; flex-direction: column; gap: 8px; }
				.rm-people-panel { border: 1px solid var(--border); background: rgba(255,255,255,0.03); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
				.rm-people-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
				.rm-people-toggle { background: transparent; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 11px; color: var(--text); cursor: pointer; }
				.rm-people-toggle:hover { color: var(--text-h); border-color: var(--accent-border); }
				.rm-people-title { font-size: 12px; font-weight: 700; color: var(--text-h); }
				.rm-people-count { font-size: 11px; color: var(--text); }
				.rm-people-search { background: rgba(255,255,255,0.035); border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; font-size: 12px; color: var(--text-h); }
				.rm-people-search:focus { outline: none; border-color: var(--accent); }
				.rm-people-list { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 2px; }
				.rm-people-item { display: grid; grid-template-columns: 1fr auto; gap: 6px; text-align: left; padding: 8px; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.02); cursor: pointer; transition: background 0.15s, border-color 0.15s; }
				.rm-people-item:hover { background: rgba(255,255,255,0.05); }
				.rm-people-item.active { border-color: var(--accent-border); background: var(--accent-bg); }
				.rm-people-name { font-size: 12px; font-weight: 700; color: var(--text-h); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
				.rm-people-meta { font-size: 11px; color: var(--text); white-space: nowrap; }
				.rm-people-empty { font-size: 12px; color: var(--text); padding: 6px 2px; }
				.rm-upload-summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--text-h); list-style: none; user-select: none; }
				.rm-upload-summary::-webkit-details-marker { display: none; }
				.rm-upload-summary-icon { font-size: 12px; color: var(--text); transition: transform 0.15s ease; }
				details[open] .rm-upload-summary-icon { transform: rotate(180deg); }
				.rm-year-select { appearance: none; background: transparent; border: 1px solid var(--border); border-radius: 8px; padding: 6px 28px 6px 10px; font-size: 13px; color: var(--text-h); cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 9px center; background-color: rgba(255,255,255,0.03); transition: border-color 0.15s; }
				.rm-year-select:focus { outline: none; border-color: var(--accent); }
				.rm-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.72); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); padding: 16px; animation: rmFadeIn 0.15s ease-out; }
				.rm-modal { background: #0f1221; border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04); }
				.rm-modal-header { padding: 20px 24px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
				.rm-modal-title { font-size: 15px; font-weight: 700; color: var(--text-h); letter-spacing: -0.01em; }
				.rm-modal-sub { font-size: 12px; color: var(--text); margin-top: 2px; }
				.rm-steps { display: flex; gap: 6px; margin-top: 14px; }
				.rm-step { height: 3px; border-radius: 2px; flex: 1; background: var(--border); transition: background 0.2s; }
				.rm-step.active { background: var(--accent); }
				.rm-modal-body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
				.rm-modal-body::-webkit-scrollbar { width: 4px; }
				.rm-modal-body::-webkit-scrollbar-track { background: transparent; }
				.rm-modal-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
				.rm-modal-footer { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 8px; }
				.rm-field { display: flex; flex-direction: column; gap: 5px; }
				.rm-label { font-size: 11px; font-weight: 600; color: var(--text); letter-spacing: 0.06em; text-transform: uppercase; }
				.rm-input { background: rgba(255,255,255,0.035); border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text-h); width: 100%; box-sizing: border-box; resize: vertical; transition: border-color 0.15s, background 0.15s; font-family: inherit; }
				.rm-input::placeholder { color: rgba(255,255,255,0.2); }
				.rm-input:focus { outline: none; border-color: var(--accent); background: rgba(var(--accent-rgb), 0.06); }
				.rm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
				.rm-section-label { font-size: 11px; font-weight: 600; color: var(--text); letter-spacing: 0.08em; text-transform: uppercase; padding-bottom: 10px; border-bottom: 1px solid var(--border); margin-bottom: 2px; }
				.rm-socials-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
				.rm-social-item { display: flex; flex-direction: column; gap: 4px; }
				.rm-social-label { font-size: 11px; color: var(--text); display: flex; align-items: center; gap: 5px; }
				.rm-btn-ghost { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--text); transition: all 0.15s; }
				.rm-btn-ghost:hover { background: rgba(255,255,255,0.05); color: var(--text-h); }
				.rm-btn-primary { padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: var(--accent); color: #fff; transition: all 0.15s; letter-spacing: 0.01em; }
				.rm-btn-primary:hover { filter: brightness(1.1); }
				.rm-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }
				.rm-btn-next { padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid var(--accent-border); background: var(--accent-bg); color: var(--accent); transition: all 0.15s; margin-left: auto; }
				.rm-btn-next:hover { background: rgba(var(--accent-rgb), 0.25); }
				.rm-btn-next:disabled { opacity: 0.4; cursor: not-allowed; }
				@keyframes rmFadeIn { from { opacity: 0; } to { opacity: 1; } }
			`}</style>

			<div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-4">
				<SidebarHeader peopleCount={people.length} visibleCount={visibleCount} />

				<div className="rm-toolbar">
					<div className="rm-action-grid">
						<button
							type="button"
							onClick={() => setIsModalOpen(true)}
							className="rm-sidebar-btn primary"
							aria-label="Open add person dialog"
						>
							<span style={{ fontSize: 15 }}>＋</span> Add person
						</button>
					</div>

					<DataManagement />

					<div className="rm-filter-row">
						<label className="rm-filter-label" htmlFor="rm-active-year">
							Year filter
						</label>
						<select
							id="rm-active-year"
							value={activeYear === "all" ? "all" : String(activeYear)}
							onChange={(e) =>
								setActiveYear(
									e.target.value === "all" ? "all" : Number(e.target.value),
								)
							}
							className="rm-year-select"
						>
							<option value="all">All years</option>
							{yearOptions.map((y) => (
								<option key={y} value={y}>
									{y}
								</option>
							))}
						</select>
					</div>
				</div>

				<PeopleList people={people} activeYear={activeYear} />
			</div>

			<AddPersonModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
			/>
		</>
	);
}