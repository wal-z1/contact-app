import type { Person } from "../../models/types";
import SelectTarget from "../PersonPanel/SelectTarget";
import { sectionHeader, sectionHint, sectionTitle } from "./constants";

type Props = {
	people: Person[];
	currentId: string;
	relationshipTypes: string[];
	addRelationshipType?: (type: string) => void;
	onCreate: (toId: string, type: string) => Promise<void>;
};

export default function AddConnectionSection({
	people,
	currentId,
	relationshipTypes,
	addRelationshipType,
	onCreate,
}: Props) {
	return (
		<>
			<div className={sectionHeader}>
				<span className={sectionTitle}>Add connection</span>
			</div>

			<div className={sectionHint}>
				Create a new relationship from this person to another contact.
			</div>

			<SelectTarget
				people={people}
				currentId={currentId}
				relationshipTypes={relationshipTypes}
				addRelationshipType={addRelationshipType}
				onCreate={onCreate}
			/>
		</>
	);
}
