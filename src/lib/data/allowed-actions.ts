// src/lib/data/allowed-actions.ts
// Closed whitelist of every database operation the AI can trigger.
// Adding a new operation requires explicit code here — no dynamic SQL ever.

import type { Action } from "@/types/chat";

export interface ActionDefinition {
  action: Action;
  description: string;
  requiredEntities: string[];
}

export const ALLOWED_ACTIONS: ActionDefinition[] = [
  {
    action: "none",
    description: "No database query needed",
    requiredEntities: [],
  },
  {
    action: "get_candidate_by_name",
    description: "Search candidate by full or partial name",
    requiredEntities: ["candidateName"],
  },
  {
    action: "get_candidate_status",
    description: "Get current status of a specific candidate",
    requiredEntities: ["candidateName"],
  },
  {
    action: "get_candidate_documents",
    description: "Get document checklist for a candidate",
    requiredEntities: ["candidateName"],
  },
  {
    action: "get_employer_by_name",
    description: "Search employer by name",
    requiredEntities: ["employerName"],
  },
  {
    action: "get_matches_by_candidate",
    description: "Get employer matches for a candidate",
    requiredEntities: ["candidateName"],
  },
  {
    action: "get_matches_by_employer",
    description: "Get candidate matches for an employer",
    requiredEntities: ["employerName"],
  },
];

export function isActionAllowed(action: string): action is Action {
  return ALLOWED_ACTIONS.some((a) => a.action === action);
}
