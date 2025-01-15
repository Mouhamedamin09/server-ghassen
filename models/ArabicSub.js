const mongoose = require("mongoose");

const ArabicSubSchema = new mongoose.Schema({
  episodeId: { // Changed from malId to episodeId
    type: String, // Assuming episodeId is a string; change to Number if it's numeric
    required: true,
    unique: true, 
  },
  url: {
    type: String,
    required: true,
  },
});

const ArabicSub = mongoose.model("ArabicSub", ArabicSubSchema);

module.exports = ArabicSub;
