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
        activeYear === "all" ? true : person.year === activeYear
      )
      .sort((a, b) =>
        String(a.name ?? "")
          .toLowerCase()
          .localeCompare(String(b.name ?? "").toLowerCase())
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
    <div className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/30 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-300">People List</div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
            {sortedPeople.length}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700"
          >
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          <label
            htmlFor="rm-people-search"
            className="mt-2 text-xs font-medium text-gray-400"
          >
            Search
          </label>
          <input
            id="rm-people-search"
            value={peopleSearch}
            onChange={(e) => setPeopleSearch(e.target.value)}
            placeholder="Search name, year, notes"
            aria-label="Search people list"
            autoComplete="off"
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <div className="flex max-h-[calc(100vh-300px)] flex-col gap-1 overflow-y-auto">
            {sortedPeople.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">
                No people found.
              </div>
            ) : (
              sortedPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setSelectedPersonId(person.id)}
                  className={`flex items-center justify-between rounded-md p-2 text-left transition-colors hover:bg-gray-800 ${
                    selectedPersonId === person.id
                      ? "border border-purple-500/30 bg-purple-900/20"
                      : ""
                  }`}
                  title={`Open ${person.name || "Unknown"}`}
                >
                  <span className="truncate text-sm text-gray-300">
                    {person.name || "Unknown"}
                  </span>
                  <span className="ml-2 shrink-0 text-xs text-gray-500">
                    {person.year || "-"}
                  </span>
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