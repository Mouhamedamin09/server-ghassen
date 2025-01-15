const mongoose = require('mongoose');

// Define the schema for user preferences
const UserPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User collection
    required: true,
  },
  selectedGenres: {
    type: [String], // Array of genres
    required: true,
  },
  favoriteAnimes: {
    type: [String], // Array of anime titles
    required: true,
  },
  recommendedFeatures: {
    type: [String], // Array of additional features
    default: [], // Optional
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create the model from the schema
const UserPreference = mongoose.model('UserPreference', UserPreferenceSchema);

module.exports = UserPreference;
