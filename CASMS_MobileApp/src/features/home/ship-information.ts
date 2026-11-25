import { z } from 'zod';
import { ApiError } from '../../lib/api/api-client';
const asset = z.string().min(1).max(500).refine(value => /^[a-zA-Z0-9_./-]+\.glb$/.test(value)
  && !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..'));
const deck = z.object({ id: z.string().min(1), number: z.number().int(), name: z.string(), asset });
const model = z.object({ shipId: z.guid(), modelId: z.guid(),
  manifest: z.object({ modelId: z.string().min(1), name: z.string().min(1), revision: z.string().min(1), units: z.string(),
    assets: z.record(z.string(), asset), decks: z.array(deck), serviceDecks: z.array(deck).optional() }),
  cabinMappings: z.array(z.object({ modelId: z.string().min(1), cabinId: z.guid() })),
});
export function readPublicModel(value: unknown, shipId: string) {
  const parsed = model.safeParse(value);
  if (!parsed.success || parsed.data.shipId !== shipId) throw new ApiError('Sơ đồ không khớp tàu hoặc metadata chưa hợp lệ.', 502, 'SHIP_MODEL_INVALID');
  return parsed.data;
}
