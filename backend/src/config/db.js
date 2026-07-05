import mongoose from 'mongoose';
import { config } from './env.js';

export default async function connectDB() {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ MongoDB connecté');
  } catch (error) {
    // On n'affiche que le message, jamais l'URI (qui contient le mot de passe Atlas).
    console.error('❌ Connexion MongoDB impossible :', error.message);
    process.exit(1);
  }
}
