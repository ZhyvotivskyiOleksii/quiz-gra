'use server';

/**
 * @fileOverview AI tool to generate quiz questions based on a specific topic and difficulty level.
 *
 * - generateQuizQuestions - A function that handles the quiz question generation process.
 * - GenerateQuizQuestionsInput - The input type for the generateQuizQuestions function.
 * - GenerateQuizQuestionsOutput - The return type for the generateQuizQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuizQuestionsInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate quiz questions.'),
  difficulty: z
    .string()
    .describe(
      'The desired difficulty level for the quiz questions (e.g., easy, medium, hard).'
    ),
  numberOfQuestions: z
    .number()
    .default(5)
    .describe('The number of questions to generate.'),
});
export type GenerateQuizQuestionsInput = z.infer<typeof GenerateQuizQuestionsInputSchema>;

const QuizQuestionSchema = z.object({
  question: z.string().describe('The text of the quiz question.'),
  answers: z
    .array(z.string())
    .length(4)
    .describe('An array of four possible answers for the question.'),
  correctAnswer: z
    .enum(['A', 'B', 'C', 'D'])
    .describe('The correct answer for the question, indicated by A, B, C, or D.'),
});

const GenerateQuizQuestionsOutputSchema = z.object({
  questions: z.array(QuizQuestionSchema).describe('An array of generated quiz questions.'),
});

export type GenerateQuizQuestionsOutput = z.infer<typeof GenerateQuizQuestionsOutputSchema>;

export async function generateQuizQuestions(
  input: GenerateQuizQuestionsInput
): Promise<GenerateQuizQuestionsOutput> {
  return generateQuizQuestionsFlow(input);
}

const generateQuizQuestionsPrompt = ai.definePrompt({
  name: 'generateQuizQuestionsPrompt',
  input: {schema: GenerateQuizQuestionsInputSchema},
  output: {schema: GenerateQuizQuestionsOutputSchema},
  prompt: `You are an expert quiz question generator. You will generate quiz questions based on the given topic and difficulty level.

Topic: {{{topic}}}
Difficulty: {{{difficulty}}}
Number of Questions: {{{numberOfQuestions}}}

Each question should have four possible answers (A, B, C, D), with one correct answer.

Output the questions in the following JSON format:

{{$schema questions}}

Ensure that the questions are diverse and cover different aspects of the topic.
`,
});

const generateQuizQuestionsFlow = ai.defineFlow(
  {
    name: 'generateQuizQuestionsFlow',
    inputSchema: GenerateQuizQuestionsInputSchema,
    outputSchema: GenerateQuizQuestionsOutputSchema,
  },
  async input => {
    const {output} = await generateQuizQuestionsPrompt(input);
    return output!;
  }
);
