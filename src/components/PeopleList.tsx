import { useState, useMemo, memo } from "react";
import type { Person } from "../models/types";
import { useAppStore } from "../store/useAppStore";

type PeopleListProps = {
	people: Person[];
	activeYear: number | "all";
};

function PeopleListComponent({ people, activeYear }: PeopleListProps) {
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);
	const setSelectedPersonId = useAppStore((s) => s.setSelectedPersonId);

	const [peopleSearch, setPeopleSearch] = useState("");
	const [isExpanded, setIsExpanded] = useState(true);

	const sortedPeople = useMemo(() => {
		const query = peopleSearch.trim().toLowerCase();
		return [...people]
			.filter((person) =>
				activeYear === "all" ? true : person.year === activeYear,
			)
			.sort((a, b) =>
				String(a.name ?? "")
					.toLowerCase()
					.localeCompare(String(b.name ?? "").toLowerCase()),
			)
			.filter((person) => {
				if (!query) return true;
				const name = String(person.name ?? "").toLowerCase();
				const description = String(person.description ?? "").toLowerCase();
				const year = String(person.year ?? "");
				return (
					name.includes(query) ||
					description.includes(query) ||
					year.includes(query)
				);
			});
	}, [people, peopleSearch, activeYear]);

	return (
		<div className="rm-people-panel">
			<div className="rm-people-head">
				<div className="rm-people-title">People List</div>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<div className="rm-people-count">{sortedPeople.length}</div>
					<button
						type="button"
						className="rm-people-toggle"
						onClick={() => setIsExpanded((v) => !v)}>
						{isExpanded ? "Collapse" : "Expand"}
					</button>
				</div>
			</div>

			{isExpanded && (
				<>
					<label className="rm-filter-label" htmlFor="rm-people-search">
						Search
					</label>
					<input
						id="rm-people-search"
						className="rm-people-search"
						value={peopleSearch}
						onChange={(e) => setPeopleSearch(e.target.value)}
						placeholder="Search name, year, notes"
						aria-label="Search people list"
						autoComplete="off"
					/>
					<div className="rm-people-list">
						{sortedPeople.length === 0 ? (
							<div className="rm-people-empty">No people found.</div>
						) : (
							sortedPeople.map((person) => (
								<button
									key={person.id}
									type="button"
									className={`rm-people-item ${
										selectedPersonId === person.id ? "active" : ""
									}`}
									title={`Open ${person.name || "Unknown"}`}
									onClick={() => setSelectedPersonId(person.id)}>
									<div className="rm-people-name">
										{person.name || "Unknown"}
									</div>
									<div className="rm-people-meta">{person.year || "-"}</div>
								</button>
							))
						)}
					</div>
				</>
			)}
		</div>
	);
}

export const PeopleList = memo(PeopleListComponent);
