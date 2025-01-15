const mongoose = require('mongoose');

const animeListSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  animeId: { type: String, required: true },
  status: {
    type: String,
    enum: ['want_to_watch', 'watching_now', 'done_watching', 'complete_later', 'dont_want'],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

const AnimeList = mongoose.model('AnimeList', animeListSchema);

module.exports = AnimeList;