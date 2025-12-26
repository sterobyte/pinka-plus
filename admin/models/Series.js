import mongoose from "mongoose";

const { Schema } = mongoose;

const SeriesSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    nameNorm: { type: String, required: true, trim: true, minlength: 1, maxlength: 80, index: true, unique: true },
  },
  { timestamps: true }
);

SeriesSchema.pre("validate", function (next) {
  if (typeof this.name === "string") {
    const n = this.name.trim();
    this.name = n;
    this.nameNorm = n.toLowerCase();
  }
  next();
});

export default mongoose.models.Series || mongoose.model("Series", SeriesSchema);
