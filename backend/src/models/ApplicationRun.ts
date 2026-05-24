import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

// Minimal Week-1 subset of SPECIFICATION.md's ApplicationRun. Future waves
// extend agentOutputs with jdAnalysis, resumeTailoring, etc. — keep this
// model focused on what Week 1 actually persists so we don't ship dead fields.

const TokenCountSchema = new Schema(
  {
    input: { type: Number, required: true, default: 0 },
    output: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const AgentOutputsSchema = new Schema(
  {
    // Mixed because the shape is defined by the agent's output schema in
    // @slate/shared. Validation happens at the agent boundary, not Mongoose.
    companyDossier: { type: Schema.Types.Mixed, required: false },
  },
  { _id: false },
);

const ApplicationRunSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jdUrl: { type: String, required: false },
    jdText: { type: String, required: true },
    mode: { type: String, enum: ['standard', 'deep'], required: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'complete', 'error'],
      required: true,
      default: 'pending',
      index: true,
    },
    startedAt: { type: Date, required: true, default: () => new Date() },
    completedAt: { type: Date, required: false },
    agentOutputs: { type: AgentOutputsSchema, required: true, default: () => ({}) },
    totalCostCents: { type: Number, required: true, default: 0 },
    totalTokens: { type: TokenCountSchema, required: true, default: () => ({ input: 0, output: 0 }) },
    // Unused in Week 1, populated when synthesis lands.
    packetId: { type: Schema.Types.ObjectId, ref: 'Packet', required: false },
  },
  { collection: 'applicationRuns', versionKey: false, timestamps: false },
);

export type ApplicationRunDoc = InferSchemaType<typeof ApplicationRunSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ApplicationRun: Model<ApplicationRunDoc> =
  (mongoose.models.ApplicationRun as Model<ApplicationRunDoc> | undefined) ??
  mongoose.model<ApplicationRunDoc>('ApplicationRun', ApplicationRunSchema);
