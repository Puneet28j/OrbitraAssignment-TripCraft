import mongoose, { type Document, type Model, type Types } from "mongoose";

export interface IRefreshToken {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
}

export interface IRefreshTokenDocument extends IRefreshToken, Document {}

export interface IRefreshTokenModel extends Model<IRefreshTokenDocument> {}

const refreshTokenSchema = new mongoose.Schema<IRefreshTokenDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ userId: 1, tokenHash: 1 });

const RefreshToken = mongoose.model<
  IRefreshTokenDocument,
  IRefreshTokenModel
>("RefreshToken", refreshTokenSchema);

export default RefreshToken;
