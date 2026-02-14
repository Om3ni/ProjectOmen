import { useState } from 'react';
import type { AiCharacter } from '../types';
import { loadAiCharacters, deleteAiCharacter } from '../storage/AiCharacterStorage';

export interface AiCharactersTabProps {
  /** Schema data for displaying character details */
  schemaData?: Record<string, unknown[]>;
  /** Callback to spawn AI character as training dummy */
  onSpawnAsDummy?: (character: AiCharacter) => void;
  /** Callback to trigger character creation command */
  onCreateNew?: () => void;
}

export function AiCharactersTab({ schemaData, onSpawnAsDummy, onCreateNew }: AiCharactersTabProps) {
  const [characters, setCharacters] = useState<AiCharacter[]>(() => loadAiCharacters());
  const [inspecting, setInspecting] = useState<AiCharacter | null>(null);

  const handleDelete = (characterId: string) => {
    if (confirm('Delete this AI character? This cannot be undone.')) {
      deleteAiCharacter(characterId);
      setCharacters(loadAiCharacters());
    }
  };

  const handleRefresh = () => {
    setCharacters(loadAiCharacters());
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (inspecting) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{inspecting.name}</h2>
          <button
            onClick={() => setInspecting(null)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Back to List
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-sm text-gray-400">Level:</span> <span className="font-semibold">{inspecting.level}</span>
          </div>
          <div>
            <span className="text-sm text-gray-400">Role:</span> <span className="font-semibold capitalize">{inspecting.role}</span>
          </div>
          <div>
            <span className="text-sm text-gray-400">Created:</span> <span>{formatDate(inspecting.createdAt)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-400">Last Used:</span> <span>{formatDate(inspecting.lastUsed)}</span>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Stat Allocations</h3>
            <div className="bg-gray-800 rounded p-3 space-y-1">
              {inspecting.allocations && inspecting.allocations.length > 0 ? (
                inspecting.allocations.map(([statId, amount], idx) => {
                  // Try to find stat name from schema
                  const stat = schemaData?.Attributes?.find((s: any) => s.ID === statId || s['Node ID'] === statId);
                  const statName = (stat as any)?.Name || `Stat ${statId}`;
                  return (
                    <div key={idx} className="text-sm">
                      <span className="text-blue-400">{statName}:</span> <span>{amount}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-gray-500">No allocations</div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Perks</h3>
            <div className="bg-gray-800 rounded p-3 space-y-1">
              {inspecting.chosenPerks && inspecting.chosenPerks.length > 0 ? (
                inspecting.chosenPerks.map((perkId, idx) => {
                  const perk = schemaData?.PerkDef?.find((p: any) => p.ID === perkId);
                  const perkName = (perk as any)?.Name || `Perk ${perkId}`;
                  return (
                    <div key={idx} className="text-sm">
                      {perkName}
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-gray-500">No perks selected</div>
              )}
            </div>
          </div>

          {inspecting.activeStatuses && inspecting.activeStatuses.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Active Statuses</h3>
              <div className="bg-gray-800 rounded p-3 space-y-1">
                {inspecting.activeStatuses.map((statusId, idx) => {
                  const status = schemaData?.Status?.find((s: any) => s.ID === statusId);
                  const statusName = (status as any)?.Name || `Status ${statusId}`;
                  return (
                    <div key={idx} className="text-sm">
                      {statusName}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">AI Characters</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            title="Refresh list"
          >
            Refresh
          </button>
          <button
            onClick={onCreateNew}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold"
          >
            Create New
          </button>
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-4">No AI characters yet</p>
          <p className="text-sm">Use <code className="bg-gray-800 px-2 py-1 rounded">/create-opponent [level] [role]</code> in chat</p>
        </div>
      ) : (
        <div className="space-y-3">
          {characters.map((char) => (
            <div
              key={char.id}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold">{char.name}</h3>
                  <div className="text-sm text-gray-400 space-x-3">
                    <span>Level {char.level}</span>
                    <span className="capitalize">{char.role}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setInspecting(char)}
                  className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Inspect
                </button>
                {onSpawnAsDummy && (
                  <button
                    onClick={() => onSpawnAsDummy(char)}
                    className="flex-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-sm"
                  >
                    Use in Combat
                  </button>
                )}
                <button
                  onClick={() => handleDelete(char.id)}
                  className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
