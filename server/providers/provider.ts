import type { Journey, JourneyInput } from '../../shared/contracts.js';
export interface RecommendationProvider { createJourney(input: JourneyInput, signal?: AbortSignal): Promise<Journey> }
export class ProviderUnavailableError extends Error {}
export class DiscoveryError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
