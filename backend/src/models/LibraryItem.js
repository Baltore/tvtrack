import mongoose from 'mongoose';

// Une saison = une entrée AniList (les suites/saisons sont des médias séparés
// chez AniList, on les regroupe ici dans un seul document par franchise).
const seasonSchema = new mongoose.Schema({
  anilistId: { type: String, required: true },
  number: { type: Number, default: 1 },
  title: { type: String, default: '' },
  episodes: { type: Number, default: 0, min: 0 },   // total annoncé (0 = inconnu)
  aired: { type: Number, default: 0, min: 0 },      // épisodes déjà diffusés
  watched: { type: Number, default: 0, min: 0 },    // progression de l'utilisateur
  duration: { type: Number, default: 0, min: 0 },   // minutes par épisode
  airingStatus: { type: String, default: '' },
  releaseDate: { type: String, default: '' },
  nextAiringAt: { type: Number, default: null },
  nextEpisode: { type: Number, default: null }
}, { _id: false });

const libraryItemSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  source: {
    type: String,
    enum: ['anilist', 'manual'],
    required: true
  },
  // Id AniList de la première saison de la franchise.
  externalId: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['anime'],
    default: 'anime'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  originalTitle: {
    type: String,
    default: ''
  },
  poster: {
    type: String,
    default: ''
  },
  banner: {
    type: String,
    default: ''
  },
  overview: {
    type: String,
    default: ''
  },
  releaseDate: {
    type: String,
    default: ''
  },
  genres: {
    type: [String],
    default: []
  },
  voteAverage: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  episodeDuration: {
    type: Number,
    default: 24,
    min: 0
  },
  seasons: {
    type: [seasonSchema],
    default: []
  },
  // Champs dérivés des saisons, conservés pour le tri, les stats et les cartes.
  totalEpisodes: {
    type: Number,
    default: 0,
    min: 0
  },
  currentEpisode: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['planning', 'watching', 'completed', 'paused', 'dropped'],
    default: 'planning'
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  favorite: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    default: '',
    maxlength: 2000
  },
  nextAiringAt: {
    type: Number,
    default: null
  },
  nextEpisode: {
    type: Number,
    default: null
  }
}, { timestamps: true });

libraryItemSchema.index({ user: 1, source: 1, externalId: 1 }, { unique: true });

export default mongoose.model('LibraryItem', libraryItemSchema);
