// src/types/knowledge.ts

export interface KnowledgeBlock {
  slug: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  keywords: string[];
  priority: number; // 1 = highest
  version: string;
  isActive: boolean;
}

export type KnowledgeCategory =
  | "company_overview"
  | "process_rules"
  | "faq_documents"
  | "faq_language_course"
  | "faq_application_status"
  | "compliance_rules"
  | "matching_logic"
  | "employer_process_notes";

export interface KnowledgeResolutionResult {
  blocks: KnowledgeBlock[];
  totalSelected: number;
  categories: KnowledgeCategory[];
}
