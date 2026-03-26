import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import type { Person } from "../models/types";
import GlobalSettingsPanel from "./GlobalSettingsPanel";
import PersonEditor from "./PersonEditor";

export default function PersonPanel() {
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);
	const person = useLiveQuery<Person | undefined>(
		() => (selectedPersonId ? db.people.get(selectedPersonId) : undefined),
		[selectedPersonId],
	);

	return (
		<>
			{!selectedPersonId || !person ? (
				<GlobalSettingsPanel />
			) : (
				<PersonEditor person={person} />
			)}
		</>
	);
}