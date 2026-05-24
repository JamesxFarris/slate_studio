import { z } from 'zod';
import { CitationSchema } from './events';

// Mode the user picks when submitting a JD. Standard uses the per-agent
// model assignments; Deep upgrades Cover Letter Writer (and possibly others
// in the future) to Opus. See SPECIFICATION.md.
export const RunModeEnum = z.enum(['standard', 'deep']);
export type RunMode = z.infer<typeof RunModeEnum>;

// ---------- Company Researcher ----------
// Schemas match ARCHITECTURE.md → Company Researcher section.

export const CompanyResearcherInputSchema = z.object({
  company: z.string().min(1),
  role: z.string().optional(),
});
export type CompanyResearcherInput = z.infer<typeof CompanyResearcherInputSchema>;

export const DossierSectionHeading = z.enum([
  'Company Overview',
  'Recent News',
  'Funding & Growth',
  'Tech & Culture Signals',
  'Risk Factors',
]);
export type DossierSectionHeading = z.infer<typeof DossierSectionHeading>;

export const DossierSectionSchema = z.object({
  heading: DossierSectionHeading,
  content: z.string(),
  citations: z.array(CitationSchema),
});
export type DossierSection = z.infer<typeof DossierSectionSchema>;

export const CompanyResearcherOutputSchema = z.object({
  sections: z.array(DossierSectionSchema),
  oneLineSummary: z.string(),
});
export type CompanyResearcherOutput = z.infer<typeof CompanyResearcherOutputSchema>;
