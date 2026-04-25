const router = require('express').Router();
const Prediction = require('../models/Prediction');
const Mine = require('../models/Mine');
const { computeMCI } = require('../utils/scoring');

// Key parameters to perturb — grouped by dimension + subtopic
// subtopic: matches SUBTOPIC_SECTIONS labels or dimension name for cross-dim params
const SENSITIVITY_PARAMS = [
  // ── Economic (core)
  { k: 'npv_cr',                 label: 'NPV',                    dim: 'Economic',      subtopic: 'Economic',        unit: '₹Cr',     pct: true  },
  { k: 'irr_pct',                label: 'IRR',                    dim: 'Economic',      subtopic: 'Economic',        unit: '%',       pct: true  },
  { k: 'payback_period_yr',      label: 'Payback Period',         dim: 'Economic',      subtopic: 'Economic',        unit: 'yr',      pct: false },
  { k: 'opex_per_tonne',         label: 'OPEX/tonne',             dim: 'Economic',      subtopic: 'Economic',        unit: '₹/t',     pct: false },
  { k: 'wacc_pct',               label: 'WACC',                   dim: 'Economic',      subtopic: 'Economic',        unit: '%',       pct: false },
  { k: 'coal_price_t',           label: 'Coal Realization Price', dim: 'Economic',      subtopic: 'Coal Quality',    unit: '₹/t',     pct: true  },
  { k: 'ob_mining_cost',         label: 'OB Mining Cost',         dim: 'Economic',      subtopic: 'HEMM & Cost',     unit: '₹/BCM',   pct: false },
  // ── Technical / Mine Life
  { k: 'annual_prod_mty',        label: 'Annual Production',      dim: 'Technical',     subtopic: 'Mine Life',       unit: 'MTPA',    pct: true  },
  { k: 'mine_life_yr',           label: 'Mine Life',              dim: 'Technical',     subtopic: 'Mine Life',       unit: 'yr',      pct: true  },
  { k: 'advance_rate_m_month',   label: 'Mining Advance Rate',    dim: 'Technical',     subtopic: 'Mine Life',       unit: 'm/mo',    pct: true  },
  // ── Technical / HEMM & Cost
  { k: 'hemm_availability',      label: 'HEMM Availability',      dim: 'Technical',     subtopic: 'HEMM & Cost',     unit: '%',       pct: true  },
  { k: 'hemm_utilisation',       label: 'HEMM Utilisation',       dim: 'Technical',     subtopic: 'HEMM & Cost',     unit: '%',       pct: true  },
  { k: 'haul_dist_m',            label: 'Haul Distance',          dim: 'Technical',     subtopic: 'HEMM & Cost',     unit: 'm',       pct: false },
  { k: 'fuel_consumption_ltr_t', label: 'Fuel Consumption',       dim: 'Technical',     subtopic: 'HEMM & Cost',     unit: 'L/t',     pct: false },
  // ── Technical / Stripping Ratio
  { k: 'stripping_ratio_overall', label: 'Operating SR',          dim: 'Technical',     subtopic: 'Stripping Ratio', unit: 'BCM:t',   pct: false },
  { k: 'besr',                   label: 'Break-even SR',          dim: 'Technical',     subtopic: 'Stripping Ratio', unit: 'BCM:t',   pct: true  },
  { k: 'seam_dip_deg',           label: 'Seam Dip Angle',         dim: 'Technical',     subtopic: 'Stripping Ratio', unit: '°',       pct: false },
  { k: 'seam_thickness_avg_m',   label: 'Seam Thickness',         dim: 'Technical',     subtopic: 'Stripping Ratio', unit: 'm',       pct: true  },
  // ── Technical / Coal Quality
  { k: 'gcv_blended',            label: 'GCV (Blended)',          dim: 'Technical',     subtopic: 'Coal Quality',    unit: 'kcal/kg', pct: true  },
  { k: 'ash_pct',                label: 'Ash Content',            dim: 'Technical',     subtopic: 'Coal Quality',    unit: '%',       pct: false },
  { k: 'total_moisture_pct',     label: 'Total Moisture',         dim: 'Technical',     subtopic: 'Coal Quality',    unit: '%',       pct: false },
  { k: 'recovery_pct',           label: 'Coal Recovery',          dim: 'Technical',     subtopic: 'Coal Quality',    unit: '%',       pct: true  },
  // ── Technical / Bench & Blast
  { k: 'powder_factor_kgbcm',    label: 'Powder Factor',          dim: 'Technical',     subtopic: 'Bench & Blast',   unit: 'kg/BCM',  pct: false },
  { k: 'blast_burden_m',         label: 'Blast Burden',           dim: 'Technical',     subtopic: 'Bench & Blast',   unit: 'm',       pct: true  },
  // ── Environmental / Dewatering & general
  { k: 'ghg_intensity',          label: 'GHG Intensity',          dim: 'Environmental', subtopic: 'Environmental',   unit: 'tCO₂/t',  pct: false },
  { k: 'ob_dump_fos',            label: 'OB Dump FoS',            dim: 'Environmental', subtopic: 'Bench & Blast',   unit: '',        pct: true  },
  { k: 'backfill_ratio',         label: 'Backfill Ratio',         dim: 'Environmental', subtopic: 'Environmental',   unit: '%',       pct: true  },
  { k: 'water_recycling_pct',    label: 'Water Recycling',        dim: 'Environmental', subtopic: 'Dewatering',      unit: '%',       pct: true  },
  { k: 'water_inflow_m3hr',      label: 'Mine Water Inflow',      dim: 'Environmental', subtopic: 'Dewatering',      unit: 'm³/hr',   pct: false },
  { k: 'pump_capacity_m3hr',     label: 'Pump Capacity',          dim: 'Environmental', subtopic: 'Dewatering',      unit: 'm³/hr',   pct: true  },
  { k: 'pumping_head_m',         label: 'Pumping Head',           dim: 'Environmental', subtopic: 'Dewatering',      unit: 'm',       pct: false },
  // ── Social
  { k: 'ltifr',                  label: 'LTIFR',                  dim: 'Social',        subtopic: 'Social',          unit: '',        pct: false },
  { k: 'far',                    label: 'FAR',                    dim: 'Social',        subtopic: 'Social',          unit: '',        pct: false },
  { k: 'local_employment_pct',   label: 'Local Employment',       dim: 'Social',        subtopic: 'Social',          unit: '%',       pct: true  },
  { k: 'csr_spend_cr',           label: 'CSR Spend',              dim: 'Social',        subtopic: 'Social',          unit: '₹Cr',     pct: true  },
  { k: 'fatalities_annual',      label: 'Annual Fatalities',      dim: 'Social',        subtopic: 'Social',          unit: '',        pct: false },
  // ── Geographical / Infrastructure
  { k: 'rail_dist_km',           label: 'Rail Distance',          dim: 'Geographical',  subtopic: 'Infrastructure',  unit: 'km',      pct: false },
  { k: 'total_logistics_cost_t', label: 'Logistics Cost',         dim: 'Geographical',  subtopic: 'Infrastructure',  unit: '₹/t',     pct: false },
  { k: 'annual_working_days',    label: 'Working Days/Year',      dim: 'Geographical',  subtopic: 'Infrastructure',  unit: 'days',    pct: true  },
  { k: 'grid_power_availability_pct', label: 'Grid Power Availability', dim: 'Geographical', subtopic: 'Infrastructure', unit: '%', pct: true },
  { k: 'annual_despatch_mty',    label: 'Annual Despatch',        dim: 'Geographical',  subtopic: 'Infrastructure',  unit: 'MTPA',    pct: true  },
  // ── Governance
  { k: 'esg_disclosure_score',   label: 'ESG Disclosure Score',   dim: 'Governance',    subtopic: 'Governance',      unit: '',        pct: true  },
  { k: 'dgms_compliance_pct',    label: 'DGMS Compliance',        dim: 'Governance',    subtopic: 'Governance',      unit: '%',       pct: true  },
  { k: 'regulatory_violations_annual', label: 'Regulatory Violations', dim: 'Governance', subtopic: 'Governance',   unit: '/yr',     pct: false },
  // ── Risk
  { k: 'slope_fos_mean',         label: 'Slope FoS (Mean)',       dim: 'Risk',          subtopic: 'Bench & Blast',   unit: '',        pct: true  },
  { k: 'slope_fos_sd',           label: 'FoS Std Deviation',      dim: 'Risk',          subtopic: 'Bench & Blast',   unit: '',        pct: false },
  { k: 'prob_of_failure_pct',    label: 'Prob. of Failure',       dim: 'Risk',          subtopic: 'Risk',            unit: '%',       pct: false },
  { k: 'seam_methane_m3t',       label: 'Seam Methane',           dim: 'Risk',          subtopic: 'Risk',            unit: 'm³/t',    pct: false },
  { k: 'haul_road_gradient_pct', label: 'Haul Road Gradient',     dim: 'Risk',          subtopic: 'Bench & Blast',   unit: '%',       pct: false },
  { k: 'near_miss_count_annual', label: 'Near-Miss Count',        dim: 'Risk',          subtopic: 'Risk',            unit: '/yr',     pct: false },
  { k: 'litigation_count',       label: 'Litigation Count',       dim: 'Risk',          subtopic: 'Risk',            unit: '',        pct: false },
];

// POST /api/sensitivity  — body: { params } or { mine_id } or { prediction_id }
router.post('/', async (req, res) => {
  try {
    let base = req.body.params;

    if (!base && req.body.mine_id) {
      const mine = await Mine.findOne({ mine_id: req.body.mine_id });
      if (!mine) return res.status(404).json({ error: 'Mine not found' });
      base = mine.toObject();
    } else if (!base && req.body.prediction_id) {
      const pred = await Prediction.findById(req.body.prediction_id);
      if (!pred) return res.status(404).json({ error: 'Prediction not found' });
      base = pred.inputs;
    }
    if (!base) return res.status(400).json({ error: 'Provide params, mine_id, or prediction_id' });

    const baseMCI = computeMCI(base).mci;
    const PERTURBATIONS = [-0.30, -0.20, -0.10, +0.10, +0.20, +0.30];

    const results = SENSITIVITY_PARAMS.map(p => {
      const val = parseFloat(base[p.k]);
      if (isNaN(val) || val === 0) return null;

      const curve = PERTURBATIONS.map(pctChange => {
        const perturbed = { ...base };
        let newVal;
        if (p.pct) {
          newVal = val * (1 + pctChange);
        } else {
          newVal = val * (1 + pctChange);
        }
        perturbed[p.k] = newVal;
        return {
          pct_change: pctChange * 100,
          value: +newVal.toFixed(4),
          mci: computeMCI(perturbed).mci
        };
      });

      const mci_low  = curve.find(c => c.pct_change === -20)?.mci ?? baseMCI;
      const mci_high = curve.find(c => c.pct_change === +20)?.mci ?? baseMCI;
      const swing    = +(Math.abs(mci_high - mci_low)).toFixed(2);

      return {
        key:      p.k,
        label:    p.label,
        dim:      p.dim,
        subtopic: p.subtopic,
        unit:     p.unit,
        base_val: val,
        mci_low,
        mci_high,
        swing,
        delta_minus20: +(mci_low - baseMCI).toFixed(2),
        delta_plus20:  +(mci_high - baseMCI).toFixed(2),
        curve
      };
    }).filter(Boolean);

    // Sort by swing (absolute impact) descending — tornado chart order
    results.sort((a, b) => b.swing - a.swing);

    // Dimension-level aggregated sensitivity
    const dimSensitivity = {};
    results.forEach(r => {
      if (!dimSensitivity[r.dim]) dimSensitivity[r.dim] = 0;
      dimSensitivity[r.dim] = +(dimSensitivity[r.dim] + r.swing).toFixed(2);
    });

    // Subtopic-level aggregated sensitivity
    const subtopicSensitivity = {};
    results.forEach(r => {
      if (!subtopicSensitivity[r.subtopic]) subtopicSensitivity[r.subtopic] = 0;
      subtopicSensitivity[r.subtopic] = +(subtopicSensitivity[r.subtopic] + r.swing).toFixed(2);
    });

    const baseResult = computeMCI(base);
    res.json({
      base_mci: baseMCI,
      base_grade: baseResult.grade,
      base_subtopic_scores: baseResult.subtopic_scores,
      n_params: results.length,
      top_params: results.slice(0, 15),
      all_params: results,
      dim_sensitivity: dimSensitivity,
      subtopic_sensitivity: subtopicSensitivity,
      perturbation_pct: 20,
      mine_name: base.mine_name || req.body.mine_id || 'Custom'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sensitivity/mines — list all reference mines for picker
router.get('/mines', async (req, res) => {
  try {
    const mines = await Mine.find({}, 'mine_id mine_name subsidiary split location_state');
    res.json(mines);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
