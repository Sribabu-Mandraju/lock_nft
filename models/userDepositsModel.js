import mongoose from 'mongoose';

const userDepositsSchema = new mongoose.Schema({
  // Smart contract fields
  address: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  depositToken: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  amount: {
    type: String, // Using String for uint256 to handle large numbers
    required: true
  },
  startTimestamp: {
    type: String, // Using String for uint256 to handle large numbers
    required: true
  },
  periodMonths: {
    type: Number, // uint8 maps to Number
    required: true,
    min: 1,
    max: 255
  },
  unlockTimestamp: {
    type: String, // Using String for uint256 to handle large numbers
    required: true
  },
  originalMinter: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  
  // Additional fields
  isClaimed: {
    type: Boolean,
    default: false
  },
  transactionHash: {
    type: String,
    required: true,
    trim: true
  },
  
  // Additional useful fields
  tokenId: {
    type: String,
    required: true,
    unique: true
  },

}, {
  collection: 'userDeposits'
});

// Indexes for better query performance
userDepositsSchema.index({ address: 1 });
userDepositsSchema.index({ originalMinter: 1 });
userDepositsSchema.index({ depositToken: 1 });
userDepositsSchema.index({ isClaimed: 1 });
userDepositsSchema.index({ unlockTimestamp: 1 });
userDepositsSchema.index({ transactionHash: 1 }, { unique: true });

// Virtual for formatted dates
userDepositsSchema.virtual('startDate').get(function() {
  return new Date(parseInt(this.startTimestamp) * 1000);
});

userDepositsSchema.virtual('unlockDate').get(function() {
  return new Date(parseInt(this.unlockTimestamp) * 1000);
});

// Method to check if deposit is unlocked
userDepositsSchema.methods.isUnlocked = function() {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return parseInt(this.unlockTimestamp) <= currentTimestamp;
};

// Method to get remaining lock time in seconds
userDepositsSchema.methods.getRemainingLockTime = function() {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const remaining = parseInt(this.unlockTimestamp) - currentTimestamp;
  return remaining > 0 ? remaining : 0;
};

// Static method to find deposits by user address
userDepositsSchema.statics.findByUserAddress = function(address) {
  return this.find({ originalMinter: address.toLowerCase() });
};

// Static method to find unclaimed deposits
userDepositsSchema.statics.findUnclaimed = function() {
  return this.find({ isClaimed: false });
};

// Static method to find unlocked deposits
userDepositsSchema.statics.findUnlocked = function() {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return this.find({
    unlockTimestamp: { $lte: currentTimestamp.toString() },
    isClaimed: false
  });
};

const UserDeposits = mongoose.model('UserDeposits', userDepositsSchema);

export default UserDeposits;
