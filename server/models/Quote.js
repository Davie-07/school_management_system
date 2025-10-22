const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['motivational', 'educational', 'success', 'leadership', 'wisdom', 'general'],
    default: 'general'
  },
  dayOfWeek: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'All'],
    default: 'All'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayCount: {
    type: Number,
    default: 0
  },
  lastDisplayed: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

quoteSchema.index({ dayOfWeek: 1, isActive: 1 });
quoteSchema.index({ category: 1 });

// Get random quote for a specific day
quoteSchema.statics.getDailyQuote = async function(dayOfWeek) {
  const quotes = await this.find({
    $or: [
      { dayOfWeek: dayOfWeek },
      { dayOfWeek: 'All' }
    ],
    isActive: true
  });
  
  if (quotes.length === 0) {
    return {
      text: "Education is the most powerful weapon which you can use to change the world.",
      author: "Nelson Mandela"
    };
  }
  
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const selectedQuote = quotes[randomIndex];
  
  // Update display count and last displayed
  await this.findByIdAndUpdate(selectedQuote._id, {
    $inc: { displayCount: 1 },
    lastDisplayed: new Date()
  });
  
  return selectedQuote;
};

module.exports = mongoose.model('Quote', quoteSchema);
