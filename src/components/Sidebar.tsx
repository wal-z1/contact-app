// Sidebar.tsx
import { useState, useMemo, memo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import type { Person } from "../models/types";

import { PeopleList } from "./PeopleList";
import { DataManagement } from "./DataManagement";
import AddPersonModal from "./AddPersonModal";
import AIAgentPanel from "./AIAgentPanel";

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
        /* ----------------------------------------------
           Base theme variables (matching store defaults)
        ---------------------------------------------- */
        :root {
          --rm-accent: #c084fc;
          --rm-bg: #0b1020;
          --rm-panel-bg: rgba(11, 16, 32, 0.7);
          --rm-border: #2e303a;
          --rm-text: #f3f4f6;
          --rm-text-muted: #9ca3af;
          --rm-radius-md: 0.5rem;
          --rm-radius-lg: 0.75rem;
          --rm-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          --rm-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          --rm-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
          --rm-transition: all 0.2s ease;
        }

        /* Sidebar container (adds panel background & inner spacing) */
        .rm-sidebar {
          background: var(--rm-panel-bg);
          backdrop-filter: blur(8px);
          border-right: 1px solid var(--rm-border);
          box-shadow: var(--rm-shadow-md);
        }

        /* Title area */
        .rm-shell-title {
          margin-bottom: 1.25rem;
          padding: 0 0.25rem;
        }
        .rm-shell-kicker {
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--rm-accent);
          margin-bottom: 0.5rem;
        }
        .rm-shell-heading {
          font-size: 1.5rem;
          font-weight: 600;
          line-height: 1.2;
          color: var(--rm-text);
          margin-bottom: 0.5rem;
        }
        .rm-shell-sub {
          font-size: 0.875rem;
          color: var(--rm-text-muted);
          line-height: 1.4;
        }

        /* Stats cards */
        .rm-stats {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .rm-stat {
          flex: 1;
          background: rgba(0, 0, 0, 0.2);
          border-radius: var(--rm-radius-md);
          padding: 0.75rem 1rem;
          border: 1px solid var(--rm-border);
          transition: var(--rm-transition);
        }
        .rm-stat-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--rm-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }
        .rm-stat-value {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--rm-text);
          line-height: 1;
        }

        /* Toolbar and button group */
        .rm-toolbar {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .rm-action-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .rm-sidebar-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--rm-border);
          border-radius: var(--rm-radius-md);
          color: var(--rm-text);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: var(--rm-transition);
          backdrop-filter: blur(4px);
        }
        .rm-sidebar-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--rm-accent);
          transform: translateY(-1px);
          box-shadow: var(--rm-shadow-sm);
        }
        .rm-sidebar-btn.primary {
          background: var(--rm-accent);
          border-color: var(--rm-accent);
          color: #0b1020;
        }
        .rm-sidebar-btn.primary:hover {
          background: color-mix(in srgb, var(--rm-accent) 80%, black);
          border-color: color-mix(in srgb, var(--rm-accent) 80%, black);
          transform: translateY(-1px);
          box-shadow: var(--rm-shadow-md);
        }
        .rm-sidebar-btn:active {
          transform: translateY(0);
        }
        .rm-sidebar-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        /* Filter row */
        .rm-filter-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .rm-filter-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--rm-text-muted);
        }
        .rm-year-select {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--rm-border);
          border-radius: var(--rm-radius-md);
          padding: 0.5rem 2rem 0.5rem 1rem;
          color: var(--rm-text);
          font-size: 0.875rem;
          cursor: pointer;
          transition: var(--rm-transition);
        }
        .rm-year-select:hover {
          border-color: var(--rm-accent);
        }
        .rm-year-select:focus {
          outline: none;
          border-color: var(--rm-accent);
          box-shadow: 0 0 0 2px rgba(192, 132, 252, 0.2);
        }

        /* Upload notes & card */
        .rm-upload-note {
          font-size: 0.75rem;
          color: var(--rm-text-muted);
          margin-top: 0.5rem;
          margin-bottom: 0.75rem;
          padding: 0.5rem 0;
          border-top: 1px dashed var(--rm-border);
        }
        .rm-upload-card {
          margin-top: 0.75rem;
          border-radius: var(--rm-radius-md);
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--rm-border);
          overflow: hidden;
        }
        .rm-upload-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          cursor: pointer;
          font-weight: 500;
          color: var(--rm-text);
          background: rgba(255, 255, 255, 0.02);
          transition: var(--rm-transition);
        }
        .rm-upload-summary:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .rm-upload-summary-icon {
          transition: transform 0.2s;
        }
        details[open] .rm-upload-summary-icon {
          transform: rotate(180deg);
        }
        .rm-upload-steps {
          padding: 1rem;
          font-size: 0.875rem;
          color: var(--rm-text-muted);
          border-top: 1px solid var(--rm-border);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .rm-upload-example {
          background: rgba(0, 0, 0, 0.4);
          padding: 0.75rem;
          border-radius: var(--rm-radius-md);
          font-size: 0.75rem;
          font-family: monospace;
          overflow-x: auto;
          margin-top: 0.5rem;
          color: var(--rm-text-muted);
        }

        /* Message banners */
        .rm-upload-msg {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          border-radius: var(--rm-radius-md);
          font-size: 0.875rem;
          border-left: 4px solid;
        }
        .rm-upload-msg.ok {
          background: rgba(0, 200, 0, 0.1);
          border-left-color: #4ade80;
          color: #d1fae5;
        }
        .rm-upload-msg.err {
          background: rgba(200, 0, 0, 0.1);
          border-left-color: #f87171;
          color: #fecaca;
        }

        /* Responsive adjustments */
        @media (max-width: 640px) {
          .rm-action-grid {
            flex-direction: column;
          }
          .rm-sidebar-btn {
            justify-content: center;
          }
          .rm-stats {
            flex-direction: column;
            gap: 0.5rem;
          }
          .rm-stat {
            text-align: center;
          }
        }
      `}</style>

			<div className="rm-sidebar flex h-full w-full flex-col gap-4 overflow-y-auto p-4">
				<SidebarHeader
					peopleCount={people.length}
					visibleCount={visibleCount}
				/>

				<div className="rm-toolbar">
					<button
						type="button"
						onClick={() => setIsModalOpen(true)}
						className="rm-sidebar-btn primary"
						aria-label="Open add person dialog">
						<span style={{ fontSize: 15 }}>＋</span> Add person
					</button>

					<DataManagement />

					<AIAgentPanel />

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
							className="rm-year-select">
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
