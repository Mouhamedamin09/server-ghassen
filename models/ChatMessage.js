const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true }, // Unique ID for each chat
  messages: [
    {
      role: { type: String, enum: ['user', 'system', 'assistant'], required: true }, // user, system (initial instructions), assistant
      content: { type: String, required: true }, //The actual message content
      timestamp: { type: Date, default: Date.now } //Optional: Add a timestamp
    }
  ],
  characterName: { type: String, required: true }, //Name of the character being used.
  biography: { type: String, required: true }, //Character's biography.
});

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

module.exports = ChatHistory; //Export the model for use in other parts of your application.