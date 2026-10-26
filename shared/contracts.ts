import { z } from 'zod';
import type { CulturalItem } from './catalog.js';

export const feedbackSchema = z.enum(['love', 'skip', 'known', 'dislike', 'farther']);
export type Feedback = z.infer<typeof feedbackSchema>;
const ids = (max: number) => z.array(z.string().min(1).max(60)).max(max).refine(values => new Set(values).size === values.length);
export const journeyInputSchema = z.object({
  mode: z.enum(['demo', 'qloo', 'agent']).optional(),
  favouriteIds: z.array(z.string().max(60)).min(1).max(5).refine(ids => new Set(ids).size === ids.length),
  adventure: z.enum(['gentle', 'curious', 'wild']),
  revision: z.number().int().min(0).max(100).default(0),
  dislikedIds: ids(10).optional(),
  knownIds: ids(15).optional(),
  context: z.string().trim().max(1000).optional(),
  feedback: z.record(z.string().max(60), feedbackSchema).default({})
    .refine(value => Object.keys(value).length <= 30),
}).strict().refine(input => {
  const all = [...input.favouriteIds, ...(input.dislikedIds ?? []), ...(input.knownIds ?? [])];
  return new Set(all).size === all.length;
}, 'A starting point can belong to only one taste group.');
export type JourneyInput = z.infer<typeof journeyInputSchema>;
export interface JourneyStop extends CulturalItem {
  description: string;
  connection: string;
  invitation: string;
  interpretation?: string;
}
export interface Journey {
  source: 'demo' | 'qloo';
  method?: 'agent' | 'ranked';
  status: 'ok' | 'empty' | 'needs_input' | 'partial' | 'degraded';
  notices?: string[];
  title: string;
  summary: string;
  stops: JourneyStop[];
}
export interface ApiError { error: { code: string; message: string } }
