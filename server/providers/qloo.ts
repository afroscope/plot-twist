import { ProviderUnavailableError, type RecommendationProvider } from './provider.js';

// Deliberately disabled: no harness, credential, model, or live request is configured.
// Future implementation: Node 22.19+ VM/container -> stdio `qloo mcp`.
// Resolve and confirm entity IDs; map all six Qloo statuses; never fall back silently.
export const qlooProvider: RecommendationProvider = {
  async createJourney() {
    throw new ProviderUnavailableError('Qloo integration is not configured.');
  },
};
