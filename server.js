require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Routes
app.use('/api/mines',     require('./routes/mines'));
app.use('/api/predict',   require('./routes/predict'));
app.use('/api/history',   require('./routes/history'));
app.use('/api/compare',     require('./routes/compare'));
app.use('/api/sensitivity', require('./routes/sensitivity'));

app.get('/', (_, res) => res.json({ status: 'ok', version: '3.0.0', service: 'CMEM API' }));

app.get('/api/health', async (_, res) => {
  const state = mongoose.connection.readyState;
  res.json({
    status: state === 1 ? 'connected' : 'disconnected',
    db: state === 1 ? 'connected' : 'disconnected',
    state,
    model_loaded: false,       // no sklearn ML model — analytical formula only
    model_type: 'Analytical CMEM (AHP+EWM+CRITIC ensemble)',
    accuracy: null             // accuracy shown on /api/compare from validate mines
  });
});

// GET /api/stats — summary statistics
app.get('/api/stats', async (_, res) => {
  try {
    const Prediction = require('./models/Prediction');
    const Mine = require('./models/Mine');

    const [total, gradeBreakdown, mciAgg, mineCount] = await Promise.all([
      Prediction.countDocuments(),
      Prediction.aggregate([{ $group: { _id: '$results.grade', count: { $sum: 1 } } }]),
      Prediction.aggregate([
        { $group: { _id: null, avg_mci: { $avg: '$results.mci' }, max_mci: { $max: '$results.mci' }, min_mci: { $min: '$results.mci' } } }
      ]),
      Mine.countDocuments()
    ]);

    const gradeMap = {};
    gradeBreakdown.forEach(g => { if (g._id) gradeMap[g._id] = g.count; });
    const viable_count = (gradeMap['A'] || 0) + (gradeMap['B'] || 0);

    const agg = mciAgg[0] || {};
    res.json({
      total_predictions: total,
      viable_count,
      grade_breakdown: gradeMap,
      avg_mci: agg.avg_mci ? +agg.avg_mci.toFixed(1) : null,
      max_mci: agg.max_mci,
      min_mci: agg.min_mci,
      reference_mine_count: mineCount,
      model_loaded: false,
      model_type: 'Analytical CMEM (AHP+EWM+CRITIC ensemble)'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Connect & start
const PORT = process.env.PORT || 8000;
const MONGO_URI = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/cmem';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✓ MongoDB connected:', MONGO_URI);
    app.listen(PORT, () => console.log(`✓ CMEM API running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
