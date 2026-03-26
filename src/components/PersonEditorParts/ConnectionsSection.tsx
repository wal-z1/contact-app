import {
  countBadge,
  dangerGhostButton,
  ghostButton,
  sectionHeader,
  sectionHint,
  sectionTitle,
  softCard,
} from "./constants";

type Connection = {
  id: string;
  otherId: string;
  otherName: string;
  type: string;
};

type Props = {
  connections: Connection[];
  onViewPerson: (personId: string | null) => void;
  onMakeBidirectional: (otherId: string, type: string) => void | Promise<void>;
  onRemoveRelationship: (relationshipId: string) => void;
};

export default function ConnectionsSection({
  connections,
  onViewPerson,
  onMakeBidirectional,
  onRemoveRelationship,
}: Props) {
  return (
    <>
      <div className={sectionHeader}>
        <span className={sectionTitle}>Connections</span>
        <span className={countBadge}>{connections.length}</span>
      </div>

      <div className={sectionHint}>
        View linked people and remove stale relationships safely.
      </div>

      {connections.length === 0 ? (
        <p className="py-2 text-xs italic text-[#6b7280]">
          No connections yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className={`${softCard} group flex items-center gap-3 px-3 py-2.5 transition-all duration-150 hover:border-[#1e3a5f]/60 hover:shadow-sm`}
            >
              {/* Avatar */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#3b0764] text-[10px] font-bold tracking-wide text-blue-200 shadow-inner">
                {connection.otherName.charAt(0).toUpperCase()}
              </div>

              {/* Name + type */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium leading-tight text-[color:var(--text-h)]">
                  {connection.otherName}
                </div>
                <div className="mt-0.5 truncate text-[10px] uppercase tracking-widest text-[#4b5563]">
                  {connection.type}
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={`${ghostButton} opacity-60 transition-opacity duration-100 group-hover:opacity-100`}
                  title={`View ${connection.otherName}`}
                  onClick={() => onViewPerson(connection.otherId)}
                >
                  View
                </button>

                <button
                  type="button"
                  className={`${ghostButton} opacity-60 transition-opacity duration-100 group-hover:opacity-100`}
                  onClick={() =>
                    void onMakeBidirectional(connection.otherId, connection.type)
                  }
                >
                  ↔ Bidirectional
                </button>

                <button
                  type="button"
                  className={`${dangerGhostButton} opacity-40 transition-opacity duration-100 group-hover:opacity-80 hover:!opacity-100`}
                  onClick={() => onRemoveRelationship(connection.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}