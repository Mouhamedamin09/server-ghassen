const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    animeId: {
      type: String,
      ref: 'Anime',
      required: true,
    },
    userId: {
      type: String,
      ref: 'User',
      required: true,
    },
    commentText: {
      type: String,
      required: true,
    },
    spoiler: { // New field for spoiler
      type: Boolean,
      default: false,
    },
    likes: [
      {
        userId: {
          type: String,
          ref: 'User',
          required: true,
        },
      },
    ],
    replies: [
      {
        userId: {
          type: String,
          ref: 'User',
          required: true,
        },
        replyText: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Comment', commentSchema);
