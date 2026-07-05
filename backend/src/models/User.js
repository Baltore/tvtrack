import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { LIMITS, EMAIL_REGEX } from '../constants.js';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: LIMITS.USERNAME_MIN,
    maxlength: LIMITS.USERNAME_MAX
  },
  email: {
    type: String,
    required: true,
    unique: true,          // index unique : un seul compte par email
    lowercase: true,
    trim: true,
    match: [EMAIL_REGEX, 'Email invalide']
  },
  password: {
    type: String,
    required: true,
    minlength: LIMITS.PASSWORD_MIN,
    select: false          // jamais renvoyé par défaut dans les requêtes
  }
}, { timestamps: true });

// Hash bcrypt avant sauvegarde, uniquement si le mot de passe a changé.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
