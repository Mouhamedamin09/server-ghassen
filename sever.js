const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/user.model.js');
const bcrypt = require('bcrypt');
const UserPreference = require('./models/UserPreference.model.js'); // Adjust path as needed
const jwt = require('jsonwebtoken');
require('dotenv').config();
const generateToken = require('./utils/generateToken'); 
const AnimeList = require('./models/AnimeList.model.js');
const Comment = require('./models/Comment.model');
const axios = require('axios');
const cheerio = require('cheerio');
const ArabicSub = require("./models/ArabicSub");
const cors = require('cors');

app.use(cors({
  origin: 'http://localhost:5173',
  methods: 'GET,POST,PUT,DELETE',
  credentials: true, // Allow cookies if needed
}));

// Alternatively, allow all origins (not recommended for production)
app.use(cors());

const app = express();
const port = 3000;
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

const protect = async (req, res, next) => {
  let token;

  if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
  ) {
      try {
          // Get token from header
          token = req.headers.authorization.split(' ')[1];

          // Verify token
          const decoded = jwt.verify(token, process.env.JWT_SECRET); // Replace with your secret

          // Get user from the token
          req.user = await User.findById(decoded.id).select('-password');

          next();
      } catch (error) {
          console.error(error);
          res.status(401).json({ message: 'Not authorized, token failed' });
      }
  }

  if (!token) {
      res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Gemini API setup
const apiKey = "AIzaSyA8UjTDox2elA4ONpcyDzTeRYguyPNTLcg";
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// MongoDB setup
const dbURI =  'mongodb+srv://mouhamedaminkraiem09:admin@cluster0.n9oaq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'; 
mongoose.connect(dbURI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Store chat history in memory
const chatHistories = {};

/**
 * Generates a character response based on the biography and conversation history.
 * Dynamically updates the prompt with all prior exchanges.
 */
const chatHistorySchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  messages: [{ role: String, content: String }], // Store messages with role (user or AI)
});

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

async function generateCharacterResponse(chatId, characterName, biography, userMessage) {
  // Fetch or create the conversation history
  let chatHistory = await ChatHistory.findOne({ chatId });

  if (!chatHistory) {
    // Create a new history if it doesn't exist
    chatHistory = new ChatHistory({
      chatId,
      messages: [
        {
          role: "system",
          content: `You are ${characterName}, a character from this biography: "${biography}". Respond in character, as an anime character. Do not reference yourself as an AI. If the user engages in +18 content with a female character, you may switch to +18 content mode. When thinking in your mind, put the text between parentheses (), and when making a move, put it between [].`,
        },
      ],
    });
    await chatHistory.save();
  }

  // Combine all previous messages into a single string
  const fetchedPreviousConversation = chatHistory.messages
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  // Construct the prompt with the conversation history
  const prompt = `${fetchedPreviousConversation}\nuser: ${userMessage}`;

  // Add the new user message to the conversation history
  chatHistory.messages.push({ role: "user", content: userMessage });

  try {
    // Pass the prompt to the model for generating a response
    const result = await model.generateContent(prompt); // Replace with your model's API call
    const characterResponse = result.response.text(); // Replace `.text()` with the correct method for your model

    // Add the assistant's response to the conversation history
    chatHistory.messages.push({ role: "assistant", content: characterResponse });

    // Save the updated conversation history
    await chatHistory.save();

    return characterResponse;
  } catch (error) {
    console.error("Error generating character response:", error.message);
    throw new Error("Failed to generate response");
  }
}

app.post('/character-chat', async (req, res) => {
  const {userId, chatId, characterName, biography, userMessage } = req.body;

  if (!chatId || !characterName || !biography || !userMessage) {
    return res.status(400).json({ error: 'Chat ID, character name, biography, and user message are required' });
  }

  try {
    const characterResponse = await generateCharacterResponse(
      chatId,
      characterName,
      biography,
      userMessage
    );

    res.json({ response: characterResponse });
  } catch (error) {
    console.error('Character chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});




// Existing /register route...
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Check if the email or username is already taken
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Email or username is already in use' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    // Generate JWT token
    const token = generateToken(newUser._id, newUser.email);

    res.status(201).json({
      message: 'User registered successfully',
      token, // Send the token
      user: { 
        _id: newUser._id, 
        username: newUser.username, 
        email: newUser.email 
      },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// server.js

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Check if all required fields are provided
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // Check if user exists in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Generate JWT token
    const token = generateToken(user._id, user.email);

    // Return token and user data
    res.json({
      message: "Login successful!",
      token,
      user: {
        id: user._id,
        username: user.username, // Changed from name to username
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "An error occurred during login. Please try again." });
  }
});



app.post('/save-preferences', async (req, res) => {
  const { userId, selectedGenres, favoriteAnimes, recommendedFeatures, avatar } = req.body;

  // Validate required fields
  if (!userId || !selectedGenres || !favoriteAnimes || !avatar) {
    return res.status(400).json({ error: 'User ID, genres, favorite animes, and avatar are required' });
  }

  try {
    // Update the avatar in the User model
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.avatar = avatar;
    await user.save();

    // Save or update user preferences in the UserPreference model
    let userPreference = await UserPreference.findOne({ userId });

    if (userPreference) {
      // Update existing preferences
      userPreference.selectedGenres = selectedGenres;
      userPreference.favoriteAnimes = favoriteAnimes;
      userPreference.recommendedFeatures = recommendedFeatures || [];
    } else {
      // Create new preferences
      userPreference = new UserPreference({
        userId,
        selectedGenres,
        favoriteAnimes,
        recommendedFeatures: recommendedFeatures || [],
      });
    }

    await userPreference.save();

    res.status(200).json({ message: 'Preferences and avatar saved successfully' });
  } catch (error) {
    console.error('Error saving preferences:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
  





app.get('/data', async (req, res) => {
  try {
    const userId = req.query.userId;

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Respond with all user data, including country, birthDate, and watchedEpisodes
    res.json({
      userData: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        country: user.country,
        birthDate: user.birthDate,
        createdAt: user.createdAt,
        watchedEpisodes: user.watchedEpisodes // <--- include this
      },
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new endpoint for updating user profile
app.post('/update-profile', async (req, res) => {
  try {
    const { userId, username, birthDate, country, avatar } = req.body; // Include avatar in destructure

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user fields (only if they are provided in the request body)
    if (username) user.username = username;
    if (birthDate) user.birthDate = birthDate;
    if (country) user.country = country;
    if (avatar) user.avatar = avatar; // Update avatar if provided

    // Save the updated user to the database
    const updatedUser = await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar: updatedUser.avatar, // Return updated avatar
        country: updatedUser.country,
        birthDate: updatedUser.birthDate,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/list',protect, async (req, res) => {
  const { userId, animeId, status } = req.body;

  // Validate input
  if (!userId || !animeId || !status) {
    return res.status(400).json({ error: 'userId, animeId, and status are required.' });
  }

  try {
    // Check if the anime already exists in the user's list
    const existingAnime = await AnimeList.findOne({ userId, animeId });

    if (existingAnime) {
      // Update the status if the anime exists
      existingAnime.status = status;
      await existingAnime.save();
      return res.status(200).json({ message: 'Anime list updated successfully.', anime: existingAnime });
    }

    // Create a new entry if it doesn't exist
    const newAnime = new AnimeList({ userId, animeId, status });
    await newAnime.save();

    res.status(201).json({ message: 'Anime added to the list successfully.', anime: newAnime });
  } catch (error) {
    console.error('Error saving anime list:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});
app.get('/list', async (req, res) => {
  const { userId, animeId } = req.query;

  try {
    // Use findOne to retrieve a single anime doc
    const foundAnime = await AnimeList.findOne({ userId, animeId });

    if (!foundAnime) {
      return res.status(404).json({ error: 'No anime status found for this user/anime.' });
    }

    // Return the single doc (rename it to something like "animeStatus" for clarity)
    res.status(200).json({ animeStatus: foundAnime });
  } catch (error) {
    console.error('Error retrieving anime list:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/userlist', async (req, res) => {
  try {
    const userId = req.query.userId; // Retrieve userId from query params

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Convert userId to ObjectId
    const statusCounts = await AnimeList.aggregate([
      { $match: { userId: userId } }, // Match based on string userId
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Mapping database statuses to client-friendly labels
    const statusMapping = {
      'want_to_watch': 'planToWatch',
      'watching_now': 'watching',
      'done_watching': 'completed',
      'complete_later': 'dropped',
      'dont_want': 'notInterested',
    };

    // Initialize formattedCounts with default values
    const formattedCounts = {
      completed: 0,
      watching: 0,
      planToWatch: 0,
      notInterested: 0,
      dropped: 0,
    };

    // Populate formattedCounts based on aggregation result
    statusCounts.forEach((status) => {
      const clientStatus = statusMapping[status._id];
      if (clientStatus) {
        formattedCounts[clientStatus] = status.count;
      }
    });

    res.status(200).json({ statusCounts: formattedCounts });
  } catch (error) {
    console.error('Error fetching user list:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


app.post('/comment', async (req, res) => {
  const { animeId, commentText, userId, spoiler } = req.body; // Destructure spoiler

  // Validate required fields
  if (!animeId || !commentText || !userId) {
    return res.status(400).json({ error: 'Anime ID, user ID, and comment text are required.' });
  }

  try {
    // Create a new comment
    const newComment = new Comment({
      animeId,
      userId,
      commentText,
      spoiler: spoiler || false, // Set spoiler flag
    });

    const savedComment = await newComment.save();

    // Populate the user's name and avatar from the User collection
    const populatedComment = await Comment.findById(savedComment._id)
      .populate('userId', 'username avatar') // Populate only username and avatar fields
      .exec();

    res.status(201).json({ message: 'Comment added successfully.', comment: populatedComment });
  } catch (error) {
    console.error('Error saving comment:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


app.get('/comment', async (req, res) => {
  const { animeId } = req.query;

  // Validate animeId
  if (!animeId) {
    return res.status(400).json({ error: 'Anime ID is required.' });
  }

  try {
    const comments = await Comment.find({ animeId })
      .populate('userId', 'username avatar') // Populate user details
      .sort({ createdAt: -1 }); // Sort comments by newest first

    // Map comments to include likesCount and likedByUser
    const commentsWithLikes = comments.map(comment => ({
      _id: comment._id,
      animeId: comment.animeId,
      userId: comment.userId,
      commentText: comment.commentText,
      spoiler: comment.spoiler, // Include spoiler flag
      createdAt: comment.createdAt,
      likesCount: comment.likes.length,
      likedByUser: req.user ? comment.likes.includes(req.user._id) : false,
    }));

    res.status(200).json({ comments: commentsWithLikes });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});



app.delete('/comment/:id', async (req, res) => {
  const commentId = req.params.id;
  const { userId } = req.body; // Expect userId in the request body

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    // Find the comment by ID
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Ensure the user owns the comment
    if (comment.userId.toString() !== userId) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment.' });
    }

    // Delete the comment
    await comment.deleteOne();

    res.status(200).json({ message: 'Comment deleted successfully.' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


app.post('/comment/:id/:userId/like', async (req, res) => {
  const commentId = req.params.id;
  const userId = req.params.userId;

  if (!commentId || !userId) {
    return res.status(400).json({ error: 'Invalid parameters. Comment ID and User ID are required.' });
  }

  try {
    // Find the comment by its ID
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Check if the user has already liked the comment
    const likeIndex = comment.likes.findIndex((like) => like.userId === userId);

    if (likeIndex > -1) {
      // User already liked the comment, so unlike it
      comment.likes.splice(likeIndex, 1);
    } else {
      // User has not liked the comment, so add a like
      comment.likes.push({ userId });
    }

    // Save the updated comment
    await comment.save();

    res.status(200).json({
      message: likeIndex > -1 ? 'Comment unliked.' : 'Comment liked.',
      likesCount: comment.likes.length,
      likedByUser: likeIndex === -1,
    });
  } catch (error) {
    console.error('Error liking/unliking comment:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/reply', async (req, res) => {
  const { userId, parentCommentId, replyText } = req.body;

  if (!userId || !parentCommentId || !replyText) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    // Validate and convert parentCommentId to ObjectId
    if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
      return res.status(400).json({ error: 'Invalid parent comment ID.' });
    }

    const parentCommentObjectId = new mongoose.Types.ObjectId(parentCommentId);

    // Find the parent comment
    const parentComment = await Comment.findById(parentCommentObjectId);
    if (!parentComment) {
      return res.status(404).json({ error: 'Parent comment not found.' });
    }

    // Add the new reply to the replies array
    const newReply = {
      userId,
      replyText,
      createdAt: new Date(),
      _id: new mongoose.Types.ObjectId(), // Generate an ObjectId for the reply
    };

    parentComment.replies.push(newReply);
    await parentComment.save();

    // Populate the userId field to include username and avatar
    const populatedReply = await Comment.findOne(
      { _id: parentCommentObjectId },
      { replies: { $elemMatch: { _id: newReply._id } } } // Find the specific reply
    ).populate('replies.userId', 'username avatar');

    const reply = populatedReply.replies[0];

    res.status(201).json({
      message: 'Reply added successfully.',
      reply,
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


app.get('/reply', async (req, res) => {
  const { parentCommentId } = req.query;

  if (!parentCommentId) {
    return res.status(400).json({ error: 'Parent comment ID is required.' });
  }

  try {
    // Validate and convert parentCommentId to ObjectId
    if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
      return res.status(400).json({ error: 'Invalid parent comment ID.' });
    }

    const parentCommentObjectId = new mongoose.Types.ObjectId(parentCommentId);

    // Find the parent comment
    const parentComment = await Comment.findById(parentCommentObjectId).populate(
      'replies.userId',
      'username avatar'
    );

    if (!parentComment) {
      return res.status(404).json({ error: 'Parent comment not found.' });
    }

    // Return the replies
    res.status(200).json({
      replies: parentComment.replies,
    });
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


app.delete('/reply/:replyId', async (req, res) => {
  const { replyId } = req.params;

  if (!replyId) {
    return res.status(400).json({ error: 'Reply ID is required.' });
  }

  try {
    // Validate the replyId
    if (!mongoose.Types.ObjectId.isValid(replyId)) {
      return res.status(400).json({ error: 'Invalid reply ID.' });
    }

    // Find the parent comment containing the reply
    const comment = await Comment.findOne({ 'replies._id': replyId });

    if (!comment) {
      return res.status(404).json({ error: 'Reply not found.' });
    }

    // Remove the reply from the replies array
    comment.replies = comment.replies.filter((reply) => reply._id.toString() !== replyId);

    // Save the updated comment
    await comment.save();

    res.status(200).json({ message: 'Reply deleted successfully.' });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/avatar', async (req, res) => {
  try {
    const { userId, avatar } = req.body; // Destructure userId and avatar from request body

    if (!userId || !avatar) {
      return res.status(400).json({ message: 'userId and avatar are required.' });
    }

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Define the default avatar
    const defaultAvatar = "https://robohash.org/default.png?set=set5";

    // Check if the current avatar is the default
    if (user.avatar !== defaultAvatar) {
      return res.json({
          _id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          createdAt: user.createdAt,
      });
    }

    // Update the avatar
    user.avatar = avatar;
    const updatedUser = await user.save();

    res.json({
      message: 'Avatar updated successfully.',
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      createdAt: updatedUser.createdAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});


// Helper function to scrape anime slug
const scrapeAnimeSlug = async (keyword) => {
  try {
    const searchUrl = `https://anitaku.bz/search.html?keyword=${encodeURIComponent(keyword)}`;
    console.log('Fetching from:', searchUrl);

    // Fetch the HTML content
    const { data } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Load HTML into Cheerio
    const $ = cheerio.load(data);

    // Find the first anime link
    const firstAnimeLink = $('li > div.img > a').first().attr('href');

    if (!firstAnimeLink) {
      throw new Error('No anime link found in the search results.');
    }

    // Extract the slug by removing "/category/"
    const slug = firstAnimeLink.replace('/category/', '').trim();
    return slug;
  } catch (error) {
    console.error('Error scraping anime slug:', error.message);
    throw new Error('Failed to scrape the website.');
  }
};

app.get('/scrape/search', async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required.' });
  }

  try {
    const slug = await scrapeAnimeSlug(keyword);
    res.json({ slug });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/watched', async (req, res) => {
  try {
    const { userId, animeId, episodeNumber } = req.body;

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find or create the anime entry for the given animeId
    let animeEntry = user.watchedEpisodes.find((entry) => entry.animeId === animeId);

    if (animeEntry) {
      // Check if the episode is already in the list
      const episodeIndex = animeEntry.episodes.indexOf(episodeNumber);

      if (episodeIndex !== -1) {
        // If the episode is already watched, remove it (unwatch)
        animeEntry.episodes.splice(episodeIndex, 1);

        // If no episodes are left, remove the anime entry entirely
        if (animeEntry.episodes.length === 0) {
          user.watchedEpisodes = user.watchedEpisodes.filter(
            (entry) => entry.animeId !== animeId
          );
        }
      } else {
        // If the episode is not watched, add it
        animeEntry.episodes.push(episodeNumber);
      }
    } else {
      // If the anime doesn't exist, create a new entry with the episode
      user.watchedEpisodes.push({
        animeId,
        episodes: [episodeNumber],
      });
    }

    // Remove duplicates to ensure only one entry per animeId
    user.watchedEpisodes = user.watchedEpisodes.reduce((acc, entry) => {
      const existing = acc.find((e) => e.animeId === entry.animeId);
      if (existing) {
        existing.episodes = Array.from(new Set([...existing.episodes, ...entry.episodes]));
      } else {
        acc.push(entry);
      }
      return acc;
    }, []);

    // Save the updated user document
    await user.save();
    res.json({ success: true, watchedEpisodes: user.watchedEpisodes });
  } catch (error) {
    console.error('Error updating watched episodes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to find the 'closest' anime by name or jname
// This is a simple substring-based approach.
function findClosestAnime(animes, query) {
  let bestScore = 0;
  let bestMatch = animes[0]; // Default to the first anime to ensure a non-empty return

  const lowerQuery = query.toLowerCase();
  const queryWords = lowerQuery.split(/\s+/);

  for (const anime of animes) {
    const animeName = anime.name.toLowerCase();
    const animeJname = anime.jname.toLowerCase();
    const animeNameWords = animeName.split(/\s+/);
    const animeJnameWords = animeJname.split(/\s+/);

    // Exact match: highest priority
    if (animeName === lowerQuery || animeJname === lowerQuery) {
      return anime; // Immediately return the exact match
    }

    // Count common words between query and anime name
    const nameMatchCount = queryWords.filter(word => animeNameWords.includes(word)).length;
    // Count common words between query and anime jname
    const jnameMatchCount = queryWords.filter(word => animeJnameWords.includes(word)).length;

    // Total score: sum of name and jname matches
    let totalScore = nameMatchCount + jnameMatchCount;

    // Extra points for a full query being a substring of the name/jname
    if (animeName.includes(lowerQuery) || animeJname.includes(lowerQuery)) {
      totalScore += 5;
    }

    // Tie-breaking: prefer shorter names if scores are equal
    if (
      totalScore > bestScore ||
      (totalScore === bestScore && animeName.length < bestMatch.name.length)
    ) {
      bestScore = totalScore;
      bestMatch = anime;
    }
  }

  return bestMatch;
}

/**
 * 1) Fetch episodes by anime name and optional MAL ID
 * Route: GET /fetchEpisodes?name=<ANIME_NAME>&mal_id=<MAL_ID>
 *
 * Steps:
 *   - Hit the search endpoint: /api/v2/hianime/search?q={name}&page=1
 *   - If MAL ID is provided:
 *     - Loop through the search results and fetch detailed data for each anime
 *     - Compare each anime's MAL ID with the provided MAL ID
 *     - Select the anime that matches the MAL ID
 *   - If MAL ID is not provided:
 *     - Use the findClosestAnime function to determine the best match
 *   - Use the selected anime's 'id' to request episodes from /api/v2/hianime/anime/{animeId}/episodes
 *   - Return the episodes data to the front-end
 */
app.get("/fetchEpisodes", async (req, res) => {
  try {
    const { name, mal_id } = req.query;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Please provide an anime name via the 'name' query parameter."
      });
    }

    // 1) Search for anime by name on both page 1 and 2
    const searchUrls = [
      `http://localhost:1000/api/v2/hianime/search?q=${encodeURIComponent(name)}&page=1`,
      
    ];

    // Fetch both pages concurrently
    const searchResponses = await Promise.all(
      searchUrls.map(url => axios.get(url).catch(error => {
        console.error(`Error fetching search results from ${url}:`, error.message);
        return null; // Handle individual request failures without failing the entire operation
      }))
    );

    // Filter out any failed requests
    const successfulResponses = searchResponses.filter(response => response && response.data && response.data.success);

    if (successfulResponses.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to search for anime on both pages."
      });
    }

    // Combine anime lists from both pages
    let allAnimes = [];
    successfulResponses.forEach(response => {
      if (response.data.data && response.data.data.animes) {
        allAnimes = allAnimes.concat(response.data.data.animes);
      }
    });

    if (!allAnimes.length) {
      return res.status(404).json({
        success: false,
        message: "No anime found for the given query on both pages."
      });
    }

    let selectedAnime = null;

    if (mal_id) {
      // 2a) If MAL ID is provided, find the anime with the matching MAL ID
      for (const anime of allAnimes) {
        const animeId = anime.id; // e.g., "attack-on-titan-112"
        const animeDetailsUrl = `http://localhost:1000/api/v2/hianime/anime/${encodeURIComponent(animeId)}`;

        try {
          const animeDetailsResponse = await axios.get(animeDetailsUrl);

          if (
            animeDetailsResponse.data.success &&
            animeDetailsResponse.data.data.anime.info.malId.toString() === mal_id.toString()
          ) {
            selectedAnime = anime;
            break; // Exit the loop once a match is found
          }
        } catch (detailError) {
          console.error(`Error fetching details for anime ID ${animeId}:`, detailError.message);
          // Optionally continue to the next anime or handle the error as needed
        }
      }

      if (!selectedAnime) {
        // **Updated Handling: Return "No anime found" if no MAL ID matches**
        return res.status(404).json({
          success: false,
          message: "No anime found matching the provided MAL ID."
        });
      }
    } else {
      // 2b) If MAL ID is not provided, use findClosestAnime to determine the best match
      selectedAnime = findClosestAnime(allAnimes, name);

      if (!selectedAnime) {
        return res.status(404).json({
          success: false,
          message: "No close match found for the anime name."
        });
      }
    }

    // 3) Fetch episodes for the selected anime
    const animeId = selectedAnime.id; // e.g., "attack-on-titan-112"
    const episodesUrl = `http://localhost:1000/api/v2/hianime/anime/${encodeURIComponent(animeId)}/episodes`;
    const episodesResponse = await axios.get(episodesUrl);

    if (!episodesResponse.data.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve episodes for the selected anime."
      });
    }

    // 4) Return the episodes data to the front-end
    return res.json({
      success: true,
      data: episodesResponse.data.data // Contains totalEpisodes + episodes array
    });
  } catch (error) {
    console.error("Error in /fetchEpisodes:", error?.message || error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Start the server (ensure this is set up as per your application's requirements)



app.get("/fetchEpisode", async (req, res) => {
  try {
    const { episodeId } = req.query;
    if (!episodeId) {
      return res.status(400).json({
        success: false,
        message: "Please provide an 'episodeId' query param.",
      });
    }

    // 1) Get the list of servers for this episode
    const serversUrl = `http://localhost:1000/api/v2/hianime/episode/servers?animeEpisodeId=${encodeURIComponent(
      episodeId
    )}`;
    const serversResponse = await axios.get(serversUrl);

    if (!serversResponse.data.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to get servers for this episode.",
      });
    }

    const serversData = serversResponse.data.data;
    const subServers = serversData.sub;
    if (!subServers || !subServers.length) {
      return res.status(404).json({
        success: false,
        message: "No 'sub' servers were found for this episode.",
      });
    }

    const firstServer = subServers[0];
    const serverName = firstServer.serverName;

    // 2) Get the actual streaming sources from the chosen server
    // Note: Changed '?' before 'server' to '&' to correctly append query parameters
    const sourcesUrl = `http://localhost:1000/api/v2/hianime/episode/sources?animeEpisodeId=${encodeURIComponent(
      episodeId
    )}&server=${encodeURIComponent(serverName)}&category=sub`;
    const sourcesResponse = await axios.get(sourcesUrl);

    if (!sourcesResponse.data.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to get streaming sources for this episode.",
      });
    }

    const sourcesData = sourcesResponse.data.data;

    // 3) Fetch Arabic subtitle URL for the given episodeId
    // Assuming 'episodeId' is a string; adjust if necessary
    const arabicSub = await ArabicSub.findOne({ episodeId: episodeId });

    // Add Arabic subtitle URL to tracks
    if (arabicSub) {
      sourcesData.tracks = [
        ...(sourcesData.tracks || []),
        { file: arabicSub.url, kind: "captions", label: "Arabic" },
      ];
    }

    return res.json({
      success: true,
      data: sourcesData,
    });
  } catch (error) {
    console.error("Error in /fetchEpisode:", error.message || error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});



app.get('/countepisodes',async (req, res) => {
  try {
    const { userId } = req.query;

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing 'userId' query parameter.",
      });
    }

    // Fetch the user from the database
    const user = await User.findById(userId).exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Calculate total episodes watched
    const totalEpisodes = user.watchedEpisodes.reduce((total, anime) => {
      if (Array.isArray(anime.episodes)) {
        return total + anime.episodes.length;
      }
      return total;
    }, 0);

    // Respond with the total count
    return res.status(200).json({
      success: true,
      data: {
        totalEpisodes,
      },
    });
  } catch (error) {
    console.error("Error in /countepisodes:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


app.get('/last-watch', async (req, res) => {
  try {
    const { userId } = req.query;

    // Validate userId presence
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId in query parameters.' });
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId format.' });
    }

    // Retrieve user with watchedEpisodes
    const user = await User.findById(userId).select('watchedEpisodes');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Extract animeIds from watchedEpisodes
    const animeIds = user.watchedEpisodes.map(entry => entry.animeId);

    return res.status(200).json({ animeIds });
  } catch (error) {
    console.error('Error in /last-watch:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});



app.get('/getList', async (req, res) => {
  try {
    const { userId, status } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const list = await AnimeList.find(query);
    return res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    console.error('Error in /getList:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

app.post("/saveArabicSub", async (req, res) => {
  try {
    const { episodeId, url } = req.body;

    // Validate input
    if (!episodeId || !url) {
      return res.status(400).json({
        success: false,
        message: "Please provide 'episodeId' and 'url'.",
      });
    }

    // Check if an entry with the same episodeId already exists
    const existingSub = await ArabicSub.findOne({ episodeId: episodeId });
    if (existingSub) {
      return res.status(409).json({
        success: false,
        message: "An Arabic subtitle for this episodeId already exists.",
      });
    }

    // Create and save the new Arabic subtitle entry
    const newArabicSub = new ArabicSub({ episodeId, url });
    await newArabicSub.save();

    return res.status(201).json({
      success: true,
      message: "Arabic subtitle link saved successfully.",
      data: newArabicSub, // Optionally return the saved document
    });
  } catch (error) {
    console.error("Error in /saveArabicSub:", error.message || error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.get("/getArabicSub", async (req, res) => {
  try {
    // Extract episodeId from query parameters
    const { episodeId } = req.query;

    // Alternatively, if you prefer using URL parameters:
    // const { episodeId } = req.params;

    // Validate input
    if (!episodeId) {
      return res.status(400).json({
        success: false,
        message: "Please provide 'episodeId'.",
      });
    }

    // Find the Arabic subtitle by episodeId
    const existingSub = await ArabicSub.findOne({ episodeId: episodeId });

    if (existingSub) {
      return res.status(200).json({
        success: true,
        message: "Arabic subtitle found.",
        data: existingSub,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "No Arabic subtitle found for the provided episodeId.",
      });
    }
  } catch (error) {
    console.error("Error in /getArabicSub:", error.message || error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});


app.get("/search", async (req, res) => {
  const { q, page } = req.query; // Get query parameters

  try {
    // Make the request to the actual backend
    const response = await axios.get(
      `http://localhost:1000/api/v2/hianime/search`,
      {
        params: { q, page }, // Pass query parameters
      }
    );

    // Send the backend's response back to the frontend
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch data." });
  }
});

app.get("/subepisodes", async (req, res) => {
  const { animeId } = req.query; // Get the anime ID from the query parameters

  if (!animeId) {
    return res.status(400).json({ success: false, error: "Anime ID is required" });
  }

  try {
    // Make a request to the backend API to fetch the episodes
    const response = await axios.get(
      `http://localhost:1000/api/v2/hianime/anime/${animeId}/episodes`
    );

    // Forward the response back to the client
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error fetching episodes:", error.message);

    // Send an error response
    res.status(500).json({
      success: false,
      error: "Failed to fetch episodes",
    });
  }
});

// Start the server


app.get("/fetchsubtitle", async (req, res) => {
  const { animeEpisodeId } = req.query;

  if (!animeEpisodeId) {
    return res.status(400).json({ success: false, error: "animeEpisodeId is required" });
  }

  try {
    const server = "hd-1";
    const category = "sub";

    // Request the backend API
    const response = await axios.get(`http://localhost:1000/api/v2/hianime/episode/sources`, {
      params: { animeEpisodeId, server, category },
    });

    // Forward the response to the client
    return res.status(response.status).json(response.data);
  } catch (error) {
    // Improved error logging
    console.error("Error fetching subtitles:", {
      message: error.message,
      responseData: error.response?.data || "No response data",
      status: error.response?.status || "No status",
    });

    // Return error details to the client
    return res.status(500).json({
      success: false,
      error: error.response?.data?.error || "Failed to fetch subtitle sources",
    });
  }
});

app.get("/checkArabicSub", async (req, res) => {
  try {
    const { episodeId } = req.query;

    // Validate input
    if (!episodeId) {
      return res.status(400).json({
        success: false,
        message: "Please provide 'episodeId'.",
      });
    }

    // Search for the Arabic subtitle entry by animeId
    const existingSub = await ArabicSub.findOne({ episodeId: episodeId });

    // Check if the entry exists and respond accordingly
    if (existingSub) {
      return res.status(200).json({
        success: true,
        message: "Arabic subtitle found for the given animeId.",
        exists: true,
        data: existingSub, // Optionally include the found document
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "No Arabic subtitle found for the given animeId.",
        exists: false,
      });
    }
  } catch (error) {
    console.error("Error in /checkArabicSub:", error.message || error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});






app.post('/translateArabic', async (req, res) => {
  const { vttText } = req.body;

  if (!vttText) {
    return res.status(400).json({ error: 'VTT text is required' });
  }

  try {
    // 1) Parse the entire VTT into cues
    const cues = parseVTT(vttText);

    if (cues.length === 0) {
      return res.status(400).json({ error: 'No valid cues found in VTT text' });
    }

    // 2) Split the cues into 5 parts
    const chunkedCues = chunkArray(cues, 5);

    // 3) Translate each chunk separately
    const translatedCuesParts = [];

    for (const [chunkIndex, cueChunk] of chunkedCues.entries()) {
      // 3A) Prepare the structured text with clear separators and numbering
      const combinedText = cueChunk
        .map((c, idx) => `Cue ${chunkIndex * 5 + idx + 1}:\n${c.text}`)
        .join('\n---\n');

      // 3B) Translate combined text
      const translatedChunkText = await translateText(combinedText);

      // 3C) Split translated text back into individual cues
      const splitTranslatedTexts = translatedChunkText.split('\n---\n').map(text => {
        // Remove the "Cue X:\n" prefix if present
        const match = text.match(/^Cue \d+:\n(.*)$/s);
        return match ? match[1].trim() : text.trim();
      });

      // 3D) Validate the translation
      if (splitTranslatedTexts.length !== cueChunk.length) {
        console.warn(
          `Mismatch in chunk ${chunkIndex + 1}. Expected ${cueChunk.length} cues, got ${splitTranslatedTexts.length}.`
        );
        // Optionally, you can handle this more gracefully, e.g., retry translation for this chunk
      }

      // 3E) Merge the translated texts back into cues
      const mergedChunk = cueChunk.map((originalCue, idx) => ({
        timing: originalCue.timing,
        text: splitTranslatedTexts[idx] || originalCue.text, // Fallback to original if translation is missing
      }));

      translatedCuesParts.push(mergedChunk);
    }

    // 4) Flatten the translated arrays back into a single array of cues
    const translatedCues = translatedCuesParts.flat();

    // 5) Reconstruct the VTT
    const translatedVTT = constructVTT(translatedCues);

    // 6) Return the final VTT
    res.json({ translatedVTT });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Internal server error during translation' });
  }
});

/**
 * Splits an array of cues into 'n' roughly equal parts without splitting individual cues.
 * Each cue remains intact within its chunk.
 * 
 * @param {Array} array - Array of cue objects.
 * @param {number} parts - Number of chunks to split into.
 * @returns {Array[]} - Array containing 'n' chunks of cues.
 */
function chunkArray(array, parts = 5) {
  if (!Array.isArray(array)) {
    throw new TypeError('Input must be an array of cues.');
  }

  if (array.length === 0) return [];

  // Adjust parts if array length is less than desired parts
  parts = Math.min(parts, array.length);

  const chunkSize = Math.ceil(array.length / parts);
  const chunks = [];
  let index = 0;

  for (let i = 0; i < parts; i++) {
    const chunk = array.slice(index, index + chunkSize);
    index += chunkSize;
    if (chunk.length) {
      // Validate each cue in the chunk
      const validChunk = chunk.every(cue => cue && cue.timing && cue.text);
      if (!validChunk) {
        throw new Error(`Invalid cue detected in chunk ${i + 1}. Each cue must have 'timing' and 'text'.`);
      }
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Parses VTT text into an array of cues.
 * Each cue is an object with { timing, text }.
 */
function parseVTT(vttText) {
  // Split lines, filter out completely empty lines
  const lines = vttText.split('\n').filter((line) => line.trim() !== '');
  const cues = [];
  let i = 0;

  // Remove 'WEBVTT' header if present
  if (lines[0]?.startsWith('WEBVTT')) {
    i++;
  }

  while (i < lines.length) {
    const timingLine = lines[i];

    // Validate timing line format
    if (!timingLine.includes('-->')) {
      // Not a valid cue timing; skip or break
      console.warn(`Invalid timing line at index ${i}: ${timingLine}`);
      i++;
      continue;
    }

    i++;
    const textLines = [];

    // Collect text lines until next timing line or end
    while (i < lines.length && !lines[i].includes('-->')) {
      textLines.push(lines[i]);
      i++;
    }

    cues.push({
      timing: timingLine,
      text: textLines.join('\n'),
    });
  }

  return cues;
}

/**
 * Translates the given text to Arabic using Gemini (or another LLM).
 * This function translates the combined text for a chunk.
 */
async function translateText(text) {
  // Construct the prompt with clear instructions and separators
  const prompt = `Translate the following cues to Arabic. Maintain the numbering and separators exactly as provided to ensure proper alignment. Do not add, remove, or rearrange any cues. Only translate the text content.\n\n${text}`;

  try {
    // Example: Adjust to your model's library
    const result = await model.generateContent(prompt);

    // Adjust to your Gemini response structure
    const translatedText = result.response.text();
    return translatedText.trim(); // Remove any leading/trailing whitespace
  } catch (error) {
    console.error('Error translating text:', error.message);
    throw new Error('Translation failed');
  }
}

/**
 * Reconstructs the VTT from an array of cues.
 */
function constructVTT(cues) {
  let output = 'WEBVTT\n\n';
  for (const cue of cues) {
    output += `${cue.timing}\n${cue.text}\n\n`;
  }
  return output.trim();
}

