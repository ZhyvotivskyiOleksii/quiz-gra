// src/ai/flows/analyze-audit-logs-for-threats.ts
'use server';

/**
 * @fileOverview An AI-powered tool for analyzing audit logs to identify potential security threats.
 *
 * - analyzeAuditLogs - A function that analyzes audit logs and provides actionable insights.
 * - AnalyzeAuditLogsInput - The input type for the analyzeAuditLogs function.
 * - AnalyzeAuditLogsOutput - The return type for the analyzeAuditLogs function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeAuditLogsInputSchema = z.object({
  auditLogs: z.string().describe('The audit logs to analyze.'),
});
export type AnalyzeAuditLogsInput = z.infer<typeof AnalyzeAuditLogsInputSchema>;

const AnalyzeAuditLogsOutputSchema = z.object({
  threatsIdentified: z.array(z.string()).describe('A list of identified security threats.'),
  insights: z.string().describe('Actionable insights for addressing the identified threats.'),
});
export type AnalyzeAuditLogsOutput = z.infer<typeof AnalyzeAuditLogsOutputSchema>;

export async function analyzeAuditLogs(input: AnalyzeAuditLogsInput): Promise<AnalyzeAuditLogsOutput> {
  return analyzeAuditLogsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeAuditLogsPrompt',
  input: {schema: AnalyzeAuditLogsInputSchema},
  output: {schema: AnalyzeAuditLogsOutputSchema},
  prompt: `You are an expert security analyst specializing in identifying security threats from audit logs.

You will analyze the provided audit logs and identify any unusual activities or potential security threats. You will provide actionable insights for addressing the identified threats.

Audit Logs:
{{{auditLogs}}}`,
});

const analyzeAuditLogsFlow = ai.defineFlow(
  {
    name: 'analyzeAuditLogsFlow',
    inputSchema: AnalyzeAuditLogsInputSchema,
    outputSchema: AnalyzeAuditLogsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
