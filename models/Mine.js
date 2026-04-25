const mongoose = require('mongoose');

const MineSchema = new mongoose.Schema({
  // ── Identity ────────────────────────────────────────────────────────────
  mine_id:        { type: String, required: true, unique: true },
  mine_name:      { type: String, required: true },
  subsidiary:     String,
  location_state: String,
  data_year:      Number,
  split:          { type: String, enum: ['Train', 'Validate', 'Test'], default: 'Train' },
  primary_source: String,
  mine_type:      { type: String, default: 'Coal OC' },
  lifecycle_stage:{ type: String, enum: ['Exploration','Development','Producing'], default: 'Producing' },

  // ── ECONOMIC ─────────────────────────────────────────────────────────────
  npv_cr:              Number, // ₹ Crore
  irr_pct:             Number, // %
  payback_period_yr:   Number, // Years
  capex_cr:            Number, // ₹ Crore (pre-production)
  sustaining_capex_cr: Number, // ₹ Crore/yr
  opex_per_tonne:      Number, // ₹/tonne
  ob_mining_cost:      Number, // ₹/BCM
  coal_price_t:        Number, // ₹/tonne (CIL notified)
  annual_revenue_cr:   Number, // ₹ Crore/yr
  royalty_pct:         Number, // %
  cit_pct:             Number, // % Corporate Income Tax
  besr:                Number, // BCM:tonne (break-even SR)
  epcm_pct:            Number, // % of direct cost
  contingency_pct:     Number, // % of direct cost
  wacc_pct:            Number, // % p.a.
  discount_rate_pct:   Number, // % p.a.
  annual_depreciation_cr: Number, // ₹ Crore/yr
  closure_bond_cr:     Number, // ₹ Crore — MISSING #9 (now added)
  coal_grade:          String, // CIL Grade A–G — MISSING (now added)

  // ── TECHNICAL ─────────────────────────────────────────────────────────────
  stripping_ratio_instantaneous: Number, // BCM:tonne
  stripping_ratio_overall: Number,       // BCM:tonne
  shovel_bucket_m3:   Number,
  bucket_fill_factor: Number,
  shovel_swing_sec:   Number,
  hemm_availability:  Number, // %
  hemm_utilisation:   Number, // %
  shovel_output_bcmhr: Number,
  num_shovels:        Number,
  dumper_payload_t:   Number,
  haul_dist_m:        Number,
  laden_speed_kmhr:   Number,
  empty_speed_kmhr:   Number,
  truck_cycle_min:    Number,
  num_dumpers:        Number,
  bench_height_ob_m:  Number,
  bench_height_coal_m:Number,
  blast_hole_dia_mm:  Number,
  blast_burden_m:     Number,
  blast_spacing_m:    Number,
  powder_factor_kgbcm:Number,
  highwall_fos:       Number,
  recovery_pct:       Number, // %
  dilution_oc_pct:    Number, // %
  haul_road_width_m:  Number,
  haul_road_gradient_pct: Number,
  rolling_resistance_kgt: Number,
  pump_capacity_m3hr: Number,
  pumping_head_m:     Number,
  annual_prod_mty:    Number, // MTY — MISSING #6 (now added)
  mine_life_yr:       Number, // years — MISSING #7 (now added)

  // ── GEOLOGICAL ────────────────────────────────────────────────────────────
  reserve_mt:         Number, // Mt (mineable)
  resource_mt:        Number, // Mt (geological)
  borehole_density:   Number, // No./km²
  seam_thickness_avg_m: Number,
  seam_dip_deg:       Number,
  insitu_density_tm3: Number,
  recovery_factor_oc: Number, // %
  gcv_seamwise:       Number, // kcal/kg
  gcv_blended:        Number, // kcal/kg
  ash_pct:            Number,
  total_moisture_pct: Number,
  inherent_moisture_pct: Number,
  volatile_matter_pct:Number,
  fixed_carbon_pct:   Number,
  sulphur_pct:        Number,
  ob_thickness_avg_m: Number,
  ob_density_tm3:     Number,
  hydraulic_conductivity_mday: Number,
  aquifer_thickness_m:Number,
  depth_below_wt_m:   Number,
  ucs_ob_mpa:         Number,
  rqd_ob:             Number, // %
  catchment_area_km2: Number,

  // ── ENVIRONMENTAL ─────────────────────────────────────────────────────────
  lease_area_ha:      Number,
  forest_area_ha:     Number,
  ob_dump_height_m:   Number,
  ob_dump_fos:        Number,
  backfill_ratio:     Number, // %
  ghg_scope1_tco2yr:  Number,
  ghg_scope2_tco2yr:  Number,
  ghg_intensity:      Number, // tCO₂e/tonne ROM
  diesel_kl_yr:       Number,
  annual_rainfall_mm: Number,
  runoff_coefficient: Number,
  water_inflow_m3hr:  Number,
  // ── MISSING ENVIRONMENTAL (added) ────────────────────────────────────────
  ec_status:          { type: String, enum: ['Granted','Conditions','Pending','Refused'], default: 'Granted' },
  fc_status:          { type: String, enum: ['Granted','Pending','Not Required','Refused'], default: 'Not Required' },
  forest_clearance_ha_pending: Number, // ha — MISSING #3
  seismic_zone:       { type: Number, min: 1, max: 5, default: 2 }, // IS 1893 — MISSING #4
  closure_plan_status:{ type: String, enum: ['Approved','Draft','Not Prepared'], default: 'Draft' }, // MISSING #5

  // ── SOCIAL ────────────────────────────────────────────────────────────────
  ltifr:              Number,
  far:                Number,
  man_hours_annual:   Number,
  lti_count_annual:   Number,
  fatalities_annual:  Number,
  local_employment_pct: Number,
  workforce_count:    Number,
  paf_count:          Number,
  land_acquisition_ha:Number,
  rr_cost_cr:         Number,
  csr_spend_cr:       Number,
  training_hrs_worker:Number, // hrs/worker/yr — MISSING #8

  // ── RISK ──────────────────────────────────────────────────────────────────
  slope_fos_mean:     Number,
  slope_fos_sd:       Number,
  prob_of_failure_pct:Number,
  flood_inflow_q100:  Number, // m³/hr
  expected_loss_cr:   Number, // ₹ Crore actuarial E[L]
  cpt_deg:            Number, // °C crossing point temperature
  seam_methane_m3t:   Number,
  lease_years_remaining: Number,
  litigation_count:   Number,
  insurance_premium_pct: Number, // % of asset value/yr — MISSING (added)

  // ── GEOGRAPHICAL ──────────────────────────────────────────────────────────
  rail_dist_km:       Number,
  rail_tariff:        Number, // ₹/tonne-km
  road_haulage_cost:  Number, // ₹/tonne-km
  annual_despatch_mty:Number,
  total_logistics_cost_t: Number, // ₹/tonne
  annual_working_days:Number,
  monsoon_disruption_days: Number,
  grid_power_availability_pct: Number,
  energy_demand_mwh:  Number,
  power_tariff_kwh:   Number,
  process_water_demand_m3day: Number,

  // ── ADDITIONAL ECONOMIC (v3.0) ────────────────────────────────────────────
  debt_equity_ratio:          Number, // D/E ratio (financial leverage)
  coal_price_volatility_pct:  Number, // % CV of coal price over 3 yrs
  export_revenue_pct:         Number, // % revenue from spot/export markets

  // ── ADDITIONAL TECHNICAL (v3.0) ───────────────────────────────────────────
  fuel_consumption_ltr_t:     Number, // litres diesel per tonne mined
  advance_rate_m_month:       Number, // mining advance rate (m/month)

  // ── ADDITIONAL ENVIRONMENTAL (v3.0) ───────────────────────────────────────
  pm10_ambient_ugm3:          Number, // ambient PM10 level (μg/m³); CPCB limit 100
  water_recycling_pct:        Number, // % mine water recycled/reused
  renewable_energy_pct:       Number, // % renewable in power mix
  land_reclamation_pct:       Number, // % mine lease land reclaimed/restored
  top_soil_management:        { type: String, enum: ['Good','Partial','Poor'], default: 'Partial' },

  // ── ADDITIONAL SOCIAL (v3.0) ──────────────────────────────────────────────
  women_employment_pct:       Number, // % female workforce
  community_projects_count:   Number, // active community development projects
  contractor_ltifr:           Number, // contractor LTIFR (per 10⁶ man-hrs)

  // ── ADDITIONAL RISK (v3.0) ────────────────────────────────────────────────
  near_miss_count_annual:     Number, // near-miss incidents per year
  fire_incident_count_annual: Number, // coal mine fire incidents per year
  dgms_compliance_pct:        Number, // DGMS audit compliance score (%)

  // ── GOVERNANCE (new dimension, v3.0) ──────────────────────────────────────
  iso_14001:                   { type: String, enum: ['Certified','In Progress','Not Started'], default: 'In Progress' },
  iso_45001:                   { type: String, enum: ['Certified','In Progress','Not Started'], default: 'In Progress' },
  regulatory_violations_annual: Number, // regulatory violations per year
  esg_disclosure_score:        Number, // 0–100 ESG reporting quality index
  audit_findings_critical:     Number, // critical audit findings per year

  // ── ACTUAL SCORES (for validation mines) ──────────────────────────────────
  actual_scores: {
    mci:           Number,
    technical:     Number,
    economic:      Number,
    environmental: Number,
    social:        Number,
    geographical:  Number,
    governance:    Number,
    risk:          Number,
    grade:         String,
    source:        String
  }
}, { timestamps: true });

module.exports = mongoose.model('Mine', MineSchema);
