import { z } from 'zod';
import { DiscoveryError } from '../providers/provider.js';

const callSchema = z.object({ id: z.string().min(1).max(200), type: z.literal('function'),
  function: z.object({ name: z.string().max(80), arguments: z.string().max(12000) }) });
export type ToolCall = z.infer<typeof callSchema>;
export type ModelMessage = { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: null; tool_calls: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export interface AgentModel {
  configured: boolean;
  next(messages: ModelMessage[], tools: unknown[], signal: AbortSignal): Promise<ToolCall>;
}
export function createOpenAIModel(options: { apiKey?: string; model?: string; fetch?: typeof fetch; timeoutMs?: number } = {}): AgentModel {
  const key = options.apiKey?.trim();
  const request = options.fetch ?? fetch;
  return {
    configured: Boolean(key),
    async next(messages, tools, parentSignal) {
      if (!key) throw new DiscoveryError('AGENT_NOT_CONFIGURED', 503, 'Agent discovery is not connected yet. Qloo discovery is available separately.');
      parentSignal.throwIfAborted();
      const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(options.timeoutMs ?? 20000)]);
      try {
        const response = await request('https://api.openai.com/v1/chat/completions', {
          method: 'POST', redirect: 'error', signal,
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: options.model || 'gpt-6-luna', messages, tools,
            tool_choice: 'required', parallel_tool_calls: false, reasoning_effort: 'none', max_completion_tokens: 2000, store: false }),
        });
        if (response.status === 401 || response.status === 403) throw new DiscoveryError('AGENT_AUTH', 503, 'The discovery agent’s model access needs attention.');
        if (response.status === 429) throw new DiscoveryError('AGENT_RATE_LIMITED', 429, 'The discovery agent has reached its model allowance. Please try again later.');
        if (!response.ok) throw new DiscoveryError('AGENT_UNAVAILABLE', 503, 'The discovery agent is unavailable. Please try again later.');
        const parsed = z.object({ choices: z.array(z.object({ finish_reason: z.literal('tool_calls'),
          message: z.object({ tool_calls: z.array(callSchema).length(1) }) })).min(1) }).safeParse(await response.json());
        if (!parsed.success) throw new DiscoveryError('AGENT_RESPONSE', 502, 'The agent could not finish its decision. Please try again.');
        return parsed.data.choices[0].message.tool_calls[0];
      } catch (error) {
        if (error instanceof DiscoveryError) throw error;
        throw new DiscoveryError(signal.aborted ? 'AGENT_TIMEOUT' : 'AGENT_UNAVAILABLE', 503,
          signal.aborted ? 'The agent took too long. Please try again.' : 'The discovery agent could not be reached. Please try again later.');
      }
    },
  };
}
