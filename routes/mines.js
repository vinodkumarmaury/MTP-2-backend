const router = require('express').Router();
const Mine = require('../models/Mine');

// GET all mines (list view)
router.get('/', async (req, res) => {
  try {
    const mines = await Mine.find({}, 'mine_id mine_name subsidiary location_state data_year split mine_type lifecycle_stage actual_scores');
    res.json(mines);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET validate mines only (for testing)
router.get('/validate', async (req, res) => {
  try {
    const mines = await Mine.find({ split: 'Validate' });
    res.json(mines);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single mine by ID
router.get('/:id', async (req, res) => {
  try {
    const mine = await Mine.findOne({ mine_id: req.params.id });
    if (!mine) return res.status(404).json({ error: 'Mine not found' });
    res.json(mine);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
