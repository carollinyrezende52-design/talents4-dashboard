// src/types/domain.ts
// Domain types reflecting the real Supabase tables

export type CandidateStatus =
  | "Novo"
  | "Em triagem"
  | "Entrevista agendada"
  | "Documentação pendente"
  | "Aprovado"
  | "Reprovado"
  | "Contratado"
  | "Inativo";

export interface Candidate {
  id: string;
  nome_completo: string;
  email?: string | null;
  telefone?: string | null;
  status: CandidateStatus;
  substatus?: string | null;
  profissao?: string | null;
  area_profissional?: string | null;
  nivel_alemao?: string | null;
  pais_origem?: string | null;
  empregador_vinculado?: string | null;
  proxima_etapa?: string | null;
  ultima_atualizacao?: string | null;
}

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  nome_documento: string;
  status: "pendente" | "enviado" | "aprovado" | "rejeitado";
  observacao?: string | null;
}

export interface Employer {
  id: string;
  nome: string;
  pais?: string | null;
  cidade?: string | null;
  setor?: string | null;
  status_parceria?: string | null;
}

export interface Match {
  id: string;
  candidate_id: string;
  employer_id: string;
  status: string;
  data_match?: string | null;
  candidate_name?: string;
  employer_name?: string;
}

// ─── Structured data returned by data-resolver ────────────────────────────────

export interface ResolvedCandidate {
  found: true;
  ambiguous: false;
  candidate: {
    id: string;
    name: string;
    status: string;
    substatus?: string | null;
    nextStep?: string | null;
    missingDocuments: string[];
    employerName?: string | null;
    lastUpdate?: string | null;
    germanLevel?: string | null;
  };
}

export interface ResolvedCandidateAmbiguous {
  found: true;
  ambiguous: true;
  candidates: Array<{ id: string; name: string; status: string }>;
}

export interface ResolvedCandidateNotFound {
  found: false;
  ambiguous: false;
}

export type CandidateResolution =
  | ResolvedCandidate
  | ResolvedCandidateAmbiguous
  | ResolvedCandidateNotFound;

export interface ResolvedEmployer {
  found: boolean;
  ambiguous: boolean;
  employer?: {
    id: string;
    name: string;
    country?: string | null;
    sector?: string | null;
    partnerStatus?: string | null;
  };
  employers?: Array<{ id: string; name: string }>;
}

export interface ResolvedMatches {
  found: boolean;
  matches: Array<{
    id: string;
    candidateName?: string;
    employerName?: string;
    status: string;
    date?: string | null;
  }>;
}

export type DataResolution =
  | CandidateResolution
  | ResolvedEmployer
  | ResolvedMatches
  | { found: false; error: string };
