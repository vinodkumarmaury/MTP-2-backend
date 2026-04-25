const router = require('express').Router();
const Mine = require('../models/Mine');
const Prediction = require('../models/Prediction');
const { computeMCI } = require('../utils/scoring');

// POST /api/predict — run prediction on provided params
router.post('/', async (req, res) => {
  try {
    const { params, mine_name, mine_ref, input_mode, session_label } = req.body;
    if (!params) return res.status(400).json({ error: 'params required' });

    const results = computeMCI(params);

    // Check if this mine has actual scores for comparison
    let comparison = { has_actual: false };
    if (mine_ref && mine_ref.trim() !== '') {
      const mineDoc = await Mine.findOne({ mine_id: mine_ref });
      if (mineDoc?.actual_scores?.mci) {
        const act = mineDoc.actual_scores;
        const pred = results.dimension_scores;
        const mci_err = Math.abs(results.mci - act.mci);
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
            mci:           { predicted: results.mci, actual: act.mci, diff: +(results.mci - act.mci).toFixed(2), pct: +((mci_err/act.mci)*100).toFixed(1) },
            technical:     { predicted: pred.technical,     actual: act.technical,     diff: +(pred.technical     - act.technical).toFixed(1),     pct: act.technical     ? +((Math.abs(pred.technical     - act.technical)     / act.technical)     * 100).toFixed(1) : null },
            economic:      { predicted: pred.economic,      actual: act.economic,      diff: +(pred.economic      - act.economic).toFixed(1),      pct: act.economic      ? +((Math.abs(pred.economic      - act.economic)      / act.economic)      * 100).toFixed(1) : null },
            environmental: { predicted: pred.environmental, actual: act.environmental, diff: +(pred.environmental - act.environmental).toFixed(1), pct: act.environmental ? +((Math.abs(pred.environmental - act.environmental) / act.environmental) * 100).toFixed(1) : null },
            social:        { predicted: pred.social,        actual: act.social,        diff: +(pred.social        - act.social).toFixed(1),        pct: act.social        ? +((Math.abs(pred.social        - act.social)        / act.social)        * 100).toFixed(1) : null },
            geographical:  { predicted: pred.geographical,  actual: act.geographical,  diff: +(pred.geographical  - act.geographical).toFixed(1),  pct: act.geographical  ? +((Math.abs(pred.geographical  - act.geographical)  / act.geographical)  * 100).toFixed(1) : null },
            governance:    { predicted: pred.governance,    actual: act.governance,    diff: +(pred.governance     - act.governance).toFixed(1),    pct: act.governance    ? +((Math.abs(pred.governance    - act.governance)    / act.governance)    * 100).toFixed(1) : null },
            risk:          { predicted: pred.risk,          actual: act.risk,          diff: +(pred.risk          - act.risk).toFixed(1),          pct: act.risk          ? +((Math.abs(pred.risk          - act.risk)          / act.risk)          * 100).toFixed(1) : null },
          },
          predicted_subtopic_scores: results.subtopic_scores ?? null,
        };
      }
    }

    // Save to history (non-blocking — return results even if DB save fails)
    let prediction_id = null;
    try {
      const record = await Prediction.create({
        session_label: session_label || '',
        mine_ref: mine_ref || '',
        mine_name: mine_name || params.mine_name || 'Unnamed Mine',
        input_mode: input_mode || 'core',
        inputs: params,
        results,
        comparison,
        notes: ''
      });
      prediction_id = record._id;
    } catch (saveErr) {
      console.warn('[predict] History save failed (MongoDB may be down):', saveErr.message);
    }

    res.json({ prediction_id, results, comparison });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/predict/from-db/:mine_id — predict using all params from DB mine
router.get('/from-db/:mine_id', async (req, res) => {
  try {
    const mine = await Mine.findOne({ mine_id: req.params.mine_id });
    if (!mine) return res.status(404).json({ error: 'Mine not found' });

    const params = mine.toObject();
    const results = computeMCI(params);

    let comparison = { has_actual: false };
    if (mine.actual_scores?.mci) {
      const act = mine.actual_scores;
      const pred = results.dimension_scores;
      const mci_err = Math.abs(results.mci - act.mci);
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
          mci:           { predicted: results.mci,       actual: act.mci,           diff: +(results.mci - act.mci).toFixed(2),                            pct: +((mci_err/act.mci)*100).toFixed(1) },
          technical:     { predicted: pred.technical,    actual: act.technical,     diff: +(pred.technical     - act.technical).toFixed(1),     pct: act.technical     ? +((Math.abs(pred.technical     - act.technical)     / act.technical)     * 100).toFixed(1) : null },
          economic:      { predicted: pred.economic,     actual: act.economic,      diff: +(pred.economic      - act.economic).toFixed(1),      pct: act.economic      ? +((Math.abs(pred.economic      - act.economic)      / act.economic)      * 100).toFixed(1) : null },
          environmental: { predicted: pred.environmental,actual: act.environmental, diff: +(pred.environmental - act.environmental).toFixed(1), pct: act.environmental ? +((Math.abs(pred.environmental - act.environmental) / act.environmental) * 100).toFixed(1) : null },
          social:        { predicted: pred.social,       actual: act.social,        diff: +(pred.social        - act.social).toFixed(1),        pct: act.social        ? +((Math.abs(pred.social        - act.social)        / act.social)        * 100).toFixed(1) : null },
          geographical:  { predicted: pred.geographical, actual: act.geographical,  diff: +(pred.geographical  - act.geographical).toFixed(1),  pct: act.geographical  ? +((Math.abs(pred.geographical  - act.geographical)  / act.geographical)  * 100).toFixed(1) : null },
          governance:    { predicted: pred.governance,   actual: act.governance,    diff: +(pred.governance    - act.governance).toFixed(1),    pct: act.governance    ? +((Math.abs(pred.governance    - act.governance)    / act.governance)    * 100).toFixed(1) : null },
          risk:          { predicted: pred.risk,         actual: act.risk,          diff: +(pred.risk          - act.risk).toFixed(1),          pct: act.risk          ? +((Math.abs(pred.risk          - act.risk)          / act.risk)          * 100).toFixed(1) : null },
        },
        predicted_subtopic_scores: results.subtopic_scores ?? null,
      };
    }

    let pid = null;
    try {
      const record = await Prediction.create({
        mine_ref: mine.mine_id,
        mine_name: mine.mine_name,
        input_mode: 'database',
        inputs: params,
        results,
        comparison,
      });
      pid = record._id;
    } catch (saveErr) {
      console.warn('[predict/from-db] History save failed:', saveErr.message);
    }

    res.json({ prediction_id: pid, mine: mine.mine_name, results, comparison });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
