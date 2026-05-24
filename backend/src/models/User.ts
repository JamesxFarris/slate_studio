import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: 'users', versionKey: false },
);

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc> | undefined) ??
  mongoose.model<UserDoc>('User', UserSchema);
