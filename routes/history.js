const router = require('express').Router();
const Prediction = require('../models/Prediction');
const { computeMCI } = require('../utils/scoring');
const Mine = require('../models/Mine');

// GET all history (summary)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const history = await Prediction.find(
      {},
      'mine_name mine_ref input_mode results.mci results.grade results.reliability_index_beta comparison.has_actual comparison.errors.mci notes session_label status createdAt'
    ).sort({ createdAt: -1 }).limit(limit);
    res.json(history);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single record
router.get('/:id', async (req, res) => {
  try {
    const rec = await Prediction.findById(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    res.json(rec);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT — update stored fields only (notes, session_label, key inputs)
// Does NOT recompute MCI — use POST /:id/reevaluate for that
router.put('/:id', async (req, res) => {
  try {
    const rec = await Prediction.findById(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });

    const { inputs, notes, session_label } = req.body;

    if (inputs !== undefined) {
      // Merge updated inputs with existing (partial update supported)
      rec.inputs = { ...rec.inputs, ...inputs };
      rec.status = 'edited';
    }
    if (notes !== undefined) rec.notes = notes;
    if (session_label !== undefined) rec.session_label = session_label;

    rec.updatedAt = new Date();
    await rec.save();

    res.json({ _id: rec._id, status: rec.status, message: 'Saved. Use POST /reevaluate to recompute scores.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/reevaluate — re-run computeMCI on stored inputs, update scores
router.post('/:id/reevaluate', async (req, res) => {
  try {
    const rec = await Prediction.findById(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });

    const newResults = computeMCI(rec.inputs);

    // Re-check actual scores if this is a validate mine
    let comparison = rec.comparison;
    if (rec.mine_ref) {
      const mine = await Mine.findOne({ mine_id: rec.mine_ref });
      if (mine?.actual_scores?.mci) {
        const act = mine.actual_scores;
        const pred = newResults.dimension_scores;
        const mci_err = Math.abs(newResults.mci - act.mci);
        comparison = {
          has_actual: true,
          actual_mci: act.mci,
          actual_scores: {
            technical: act.technical, economic: act.economic,
            environmental: act.environmental, social: act.social,
            geographical: act.geographical, risk: act.risk
          },
          actual_grade: act.grade,
          actual_source: act.source,
          errors: {
            mci: { predicted: newResults.mci, actual: act.mci, diff: +(newResults.mci - act.mci).toFixed(2), pct: +((mci_err / act.mci) * 100).toFixed(1) },
            technical:     { predicted: pred.technical,     actual: act.technical,     diff: +(pred.technical - act.technical).toFixed(1) },
            economic:      { predicted: pred.economic,      actual: act.economic,      diff: +(pred.economic - act.economic).toFixed(1) },
            environmental: { predicted: pred.environmental, actual: act.environmental, diff: +(pred.environmental - act.environmental).toFixed(1) },
            social:        { predicted: pred.social,        actual: act.social,        diff: +(pred.social - act.social).toFixed(1) },
            geographical:  { predicted: pred.geographical,  actual: act.geographical,  diff: +(pred.geographical - act.geographical).toFixed(1) },
            risk:          { predicted: pred.risk,          actual: act.risk,          diff: +(pred.risk - act.risk).toFixed(1) }
          }
        };
      }
    }

    rec.results = newResults;
    rec.comparison = comparison;
    rec.status = 'reevaluated';
    rec.updatedAt = new Date();
    await rec.save();

    res.json({
      _id: rec._id,
      status: rec.status,
      mci: newResults.mci,
      grade: newResults.grade,
      reliability_index_beta: newResults.reliability_index_beta,
      dimension_scores: newResults.dimension_scores,
      comparison
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE single record
router.delete('/:id', async (req, res) => {
  try {
    await Prediction.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
