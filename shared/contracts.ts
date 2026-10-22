import { z } from 'zod';
import type { CulturalItem } from './catalog.js';

export const journeyInputSchema = z.object({
  favouriteIds: z.array(z.string().max(60)).min(1).max(5).refine(ids => new Set(ids).size === ids.length),
  adventure: z.enum(['gentle', 'curious', 'wild']),
  revision: z.number().int().min(0).max(100).default(0),
  feedback: z.record(z.string().max(60), z.enum(['love', 'skip'])).default({})
    .refine(value => Object.keys(value).length <= 30),
}).strict();
export type JourneyInput = z.infer<typeof journeyInputSchema>;
export interface JourneyStop extends CulturalItem {
  description: string;
  connection: string;
  invitation: string;
}
export interface Journey {
  source: 'demo';
  status: 'ok' | 'empty';
  title: string;
  summary: string;
  stops: JourneyStop[];
}
export interface ApiError { error: { code: string; message: string } }
