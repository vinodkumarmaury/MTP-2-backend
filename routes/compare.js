const router = require('express').Router();
const Prediction = require('../models/Prediction');
const Mine = require('../models/Mine');
const { computeMCI } = require('../utils/scoring');

// GET /api/compare — returns predictions list + validate mine comparisons
// Formula MCI = analytical score (y_pred); Actual expert score = y_true
router.get('/', async (req, res) => {
  try {
    // All history predictions
    const predictions = await Prediction.find(
      {},
      'mine_name mine_ref session_label results.mci results.grade results.dimension_scores comparison status createdAt'
    ).sort({ createdAt: -1 }).limit(200);

    // Validate mines with actual scores (ground truth)
    const validateMines = await Mine.find(
      { split: 'Validate', 'actual_scores.mci': { $exists: true } },
      'mine_id mine_name subsidiary location_state actual_scores'
    );

    // Compute formula MCI for each validate mine for scatter plot
    const validateComparisons = await Promise.all(
      validateMines.map(async (mine) => {
        const mineParams = await Mine.findOne({ mine_id: mine.mine_id });
        const computed = computeMCI(mineParams.toObject());
        return {
          mine_id: mine.mine_id,
          mine_name: mine.mine_name,
          subsidiary: mine.subsidiary,
          formula_mci: computed.mci,        // y_pred (analytical)
          actual_mci: mine.actual_scores.mci, // y_true (expert assessment)
          formula_grade: computed.grade,
          actual_grade: mine.actual_scores.grade,
          diff: +(computed.mci - mine.actual_scores.mci).toFixed(2),
          abs_diff: +Math.abs(computed.mci - mine.actual_scores.mci).toFixed(2),
          pct_error: +((Math.abs(computed.mci - mine.actual_scores.mci) / mine.actual_scores.mci) * 100).toFixed(1),
          dimension_scores: computed.dimension_scores,
          subtopic_scores: computed.subtopic_scores,
          actual_scores: mine.actual_scores,
          source: mine.actual_scores.source
        };
      })
    );

    // Compute MAE and R² over validate mines
    let mae = 0, r2 = null;
    if (validateComparisons.length > 0) {
      const n = validateComparisons.length;
      mae = +(validateComparisons.reduce((s, v) => s + v.abs_diff, 0) / n).toFixed(2);
      const actualMean = validateComparisons.reduce((s, v) => s + v.actual_mci, 0) / n;
      const ssTot = validateComparisons.reduce((s, v) => s + Math.pow(v.actual_mci - actualMean, 2), 0);
      const ssRes = validateComparisons.reduce((s, v) => s + Math.pow(v.actual_mci - v.formula_mci, 2), 0);
      r2 = ssTot > 0 ? +(1 - ssRes / ssTot).toFixed(3) : null;
    }

    res.json({
      validate_comparisons: validateComparisons,
      predictions: predictions.map(p => ({
        _id: p._id,
        mine_name: p.mine_name,
        mine_ref: p.mine_ref,
        session_label: p.session_label,
        formula_mci: p.results?.mci,
        grade: p.results?.grade,
        dimension_scores: p.results?.dimension_scores,
        has_actual: p.comparison?.has_actual,
        actual_mci: p.comparison?.actual_mci,
        actual_grade: p.comparison?.actual_grade,
        abs_diff: p.comparison?.errors?.mci?.pct ? +Math.abs(p.comparison.errors.mci.diff).toFixed(2) : null,
        status: p.status,
        createdAt: p.createdAt
      })),
      metrics: {
        mae,
        r2,
        n_validate: validateComparisons.length,
        n_predictions: predictions.length,
        mae_target: 5,    // acceptable MAE threshold (pts)
        r2_target: 0.90   // acceptable R² threshold
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
