const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String
  },
  country: {
    type: String
  },
  birthDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  coins: {
    type: Number,
    default: 50 // Default coins value
  },
  watchedEpisodes: [
    {
      animeId: {
        type: String,
        required: true
      },
      episodes: {
        type: [Number],
        default: []
      }
    }
  ]
});

const User = mongoose.model('User', userSchema);
module.exports = User;
