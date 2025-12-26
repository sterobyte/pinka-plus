import mongoose from "mongoose";

const { Schema } = mongoose;

const CollectionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    nameNorm: { type: String, required: true, trim: true, minlength: 1, maxlength: 80, index: true, unique: true },
  },
  { timestamps: true }
);

CollectionSchema.pre("validate", function (next) {
  if (typeof this.name === "string") {
    const n = this.name.trim();
    this.name = n;
    this.nameNorm = n.toLowerCase();
  }
  next();
});

export default mongoose.models.Collection || mongoose.model("Collection", CollectionSchema);
