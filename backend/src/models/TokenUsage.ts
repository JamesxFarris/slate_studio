import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { AgentIdEnum } from '@slate/shared';

// COST_CONTROLS Rule 4: every Claude call writes one row here.

const TokenUsageSchema = new Schema(
  {
    runId: { type: Schema.Types.ObjectId, ref: 'ApplicationRun', required: true, index: true },
    // Stored as string; the union of valid values lives in @slate/shared.
    agentId: { type: String, required: true, enum: AgentIdEnum.options },
    // The resolved Anthropic model id ('claude-haiku-4-5-20251001' etc.), not the
    // short key — so dashboards can group by exact pricing surface.
    model: { type: String, required: true },
    inputTokens: { type: Number, required: true, default: 0 },
    outputTokens: { type: Number, required: true, default: 0 },
    cachedInputTokens: { type: Number, required: true, default: 0 },
    costCents: { type: Number, required: true, default: 0 },
    timestamp: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { collection: 'tokenUsage', versionKey: false },
);

export type TokenUsageDoc = InferSchemaType<typeof TokenUsageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const TokenUsage: Model<TokenUsageDoc> =
  (mongoose.models.TokenUsage as Model<TokenUsageDoc> | undefined) ??
  mongoose.model<TokenUsageDoc>('TokenUsage', TokenUsageSchema);
