import { useEffect, useMemo, useState } from "react";
import type { Person, RelationshipType } from "../../models/types";

export default function SelectTarget({
	people,
	currentId,
	onCreate,
	relationshipTypes,
	addRelationshipType,
}: {
	people: Person[];
	currentId: string;
	onCreate: (toId: string, type: RelationshipType) => Promise<void> | void;
	relationshipTypes: RelationshipType[];
	addRelationshipType?: (t: RelationshipType) => void;
}) {
	const targets = useMemo(
		() => people.filter((p) => p.id !== currentId),
		[people, currentId],
	);

	const [targetId, setTargetId] = useState<string>(() => targets[0]?.id ?? "");
	const [type, setType] = useState<RelationshipType>(
		() => relationshipTypes?.[0] || ("" as RelationshipType),
	);
	const [newType, setNewType] = useState("");
	const [creating, setCreating] = useState(false);

	useEffect(() => {
		if (!targets.length) {
			setTargetId("");
			return;
		}
		if (!targets.some((t) => t.id === targetId)) {
			setTargetId(targets[0].id);
		}
	}, [targets, targetId]);

	useEffect(() => {
		if (relationshipTypes?.length && !relationshipTypes.includes(type as any)) {
			setType(relationshipTypes[0]);
		}
	}, [relationshipTypes, type]);

	const addType = () => {
		const t = newType.trim();
		if (!t) return;
		try {
			addRelationshipType?.(t as RelationshipType);
			setType(t as RelationshipType);
			setNewType("");
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
			<div className="pp-field">
				<label className="pp-field-label">Person</label>
				<select
					className="pp-select"
					value={targetId}
					onChange={(e) => setTargetId(e.target.value)}>
					<option value="">Select person…</option>
					{targets.map((p) => (
						<option key={p.id} value={p.id}>
							{p.name} ({p.year})
						</option>
					))}
				</select>
			</div>

			<div className="pp-field">
				<label className="pp-field-label">Relationship type</label>
				<select
					className="pp-select"
					value={type}
					onChange={(e) => setType(e.target.value as RelationshipType)}>
					{(relationshipTypes ?? []).map((t) => (
						<option key={t} value={t}>
							{t}
						</option>
					))}
				</select>
				<div className="pp-new-type-row">
					<input
						className="pp-input"
						placeholder="Custom type (e.g. mentor)"
						value={newType}
						onChange={(e) => setNewType(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addType();
							}
						}}
					/>
					<button
						type="button"
						className="pp-add-type-btn"
						disabled={!newType.trim()}
						onClick={addType}>
						+ Add
					</button>
				</div>
			</div>

			<button
				type="button"
				className="pp-btn-primary"
				disabled={!targetId || creating}
				onClick={async () => {
					if (!targetId) return;
					try {
						setCreating(true);
						await onCreate(targetId, type);
					} finally {
						setCreating(false);
					}
				}}>
				{creating ? "Creating…" : "Create relationship"}
			</button>
		</div>
	);
}
