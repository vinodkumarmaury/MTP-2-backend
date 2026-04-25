const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema({
  session_label:  { type: String, default: '' },
  mine_ref:       { type: String, default: '' }, // mine_id if from DB
  mine_name:      { type: String, required: true },
  input_mode:     { type: String, enum: ['core', 'subtopic', 'combined', 'database', 'manual'], default: 'core' },
  inputs:         { type: mongoose.Schema.Types.Mixed, required: true },
  results: {
    mci:           Number,
    grade:         String,
    recommendation:String,
    dimension_scores: mongoose.Schema.Types.Mixed,
    weights:       mongoose.Schema.Types.Mixed,
    breakdowns:    mongoose.Schema.Types.Mixed,
    valuation_method: mongoose.Schema.Types.Mixed
  },
  comparison: {
    has_actual:    Boolean,
    actual_mci:    Number,
    actual_scores: mongoose.Schema.Types.Mixed,
    actual_grade:  String,
    actual_source: String,
    errors:        mongoose.Schema.Types.Mixed
  },
  notes:  { type: String, default: '' },
  status: { type: String, enum: ['predicted', 'edited', 'reevaluated'], default: 'predicted' }
}, { timestamps: true });

module.exports = mongoose.model('Prediction', PredictionSchema);
