/**
 * CMEM Scoring Engine v3.0 — OC Coal Mine Analytical Model
 * Scores 7 dimensions from 150+ input parameters
 * Returns dimension scores 0-100 and MCI
 * New in v3.0: Governance dimension + 20 additional parameters
 */

// ─── Ensemble weights (AHP 50% + EWM 30% + CRITIC 20%) ───────────────────
// v3.0: existing weights scaled ×0.934; all 7 weights sum to 1.000 (|absolute|).
// Risk is treated as SAFETY QUALITY (higher score = better risk management),
// so its weight is +0.267 and scoreRisk() returns 100 − hazard_level.
const ENSEMBLE_WEIGHTS = {
  technical:      0.127,
  economic:       0.170,
  environmental:  0.101,
  social:         0.139,
  geographical:   0.130,
  governance:     0.066,
  risk:           0.267   // positive: applied to safety quality = 100 − hazard score
};

function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}
function safe(v, def = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
}

// ─── Technical Score ──────────────────────────────────────────────────────
function scoreTechnical(p) {
  const gcv      = safe(p.gcv_blended, 3500);
  const sr       = safe(p.stripping_ratio_overall, 4);
  const besr     = safe(p.besr, 6);
  const recov    = safe(p.recovery_pct, 88);
  const hemm_av  = safe(p.hemm_availability, 80);
  const hemm_ut  = safe(p.hemm_utilisation, 70);
  const life     = safe(p.mine_life_yr, safe(p.reserve_mt, 50) / Math.max(safe(p.annual_prod_mty, 1), 0.01));
  const fos_hw   = safe(p.highwall_fos, 1.35);
  const prod     = safe(p.annual_prod_mty, 1);
  const fuel_ltr = safe(p.fuel_consumption_ltr_t, 4.0);
  const advance  = safe(p.advance_rate_m_month, 200);

  // Sub-topic params: HEMM fleet & blasting efficiency
  const shovel_out  = safe(p.shovel_output_bcmhr, 0);   // BCM/hr per shovel
  const num_shovels = safe(p.num_shovels, 0);
  const num_dumpers = safe(p.num_dumpers, 0);
  const dumper_pay  = safe(p.dumper_payload_t, 85);
  const cycle_min   = safe(p.truck_cycle_min, 20);
  const powder_f    = safe(p.powder_factor_kgbcm, 0);   // kg/BCM
  const rqd         = safe(p.rqd_ob, 0);                // % rock quality

  // Sub-topic: Coal Quality (ash, moisture, volatile matter)
  const ash_pct    = safe(p.ash_pct, 30);               // % ash in coal
  const moisture   = safe(p.total_moisture_pct, 10);    // % total moisture
  const volatile_m = safe(p.volatile_matter_pct, 28);   // % volatile matter

  // Sub-topic: Stripping geometry (seam/OB thickness, dip)
  const seam_t     = safe(p.seam_thickness_avg_m, 0);   // average seam thickness
  const ob_t       = safe(p.ob_thickness_avg_m, 0);     // average OB thickness
  const dip_deg    = safe(p.seam_dip_deg, 5);           // seam dip angle (degrees)

  // Sub-topic: HEMM transport efficiency (haul distance, speeds)
  const haul_dist  = safe(p.haul_dist_m, 0);            // one-way haul distance (m)
  const laden_spd  = safe(p.laden_speed_kmhr, 0);       // laden truck speed km/hr
  const empty_spd  = safe(p.empty_speed_kmhr, 0);       // empty return speed km/hr

  // Sub-topic: Blast design geometry
  const burst_m    = safe(p.blast_burden_m, 0);         // blast burden (m)
  const spacing_m  = safe(p.blast_spacing_m, 0);        // blast spacing (m)
  const ucs_ob     = safe(p.ucs_ob_mpa, 0);             // UCS of OB rock (MPa)

  // GCV score: Grade A (>6700)=100 … Grade G (<2200)=0
  const gcv_s  = clamp((gcv - 2200) / (6700 - 2200) * 100);
  // SR efficiency: SR_viability = max(0, (BESR-OSR)/BESR × 100)
  const sr_viability = Math.max(0, (besr - sr) / Math.max(besr, 1) * 100);
  const sr_s   = clamp(sr_viability);
  // Recovery: 95%=100, 70%=0
  const rec_s  = clamp((recov - 70) / (95 - 70) * 100);
  // HEMM combined availability × utilisation
  const hemm_s = clamp(hemm_av * 0.6 + hemm_ut * 0.4);
  // Mine life: 50yr=100, 5yr=0
  const life_s = clamp((life - 5) / (50 - 5) * 100);
  // Highwall stability
  const fos_s  = clamp((fos_hw - 1.0) / (2.5 - 1.0) * 100);
  // Production scale (log normalised, 0.5 MTY=0, 50 MTY=100)
  const prod_s = clamp(Math.log10(prod / 0.5) / Math.log10(50 / 0.5) * 100);
  // Fuel efficiency: 2 L/t=100, 8 L/t=0
  const fuel_s = clamp(100 - (fuel_ltr - 2) / (8 - 2) * 100);
  // Advance rate: 400 m/month=100, 100 m/month=0
  const adv_s  = clamp((advance - 100) / (400 - 100) * 100);

  // Sub-topic: Shovel fleet balance (shovel output vs dumper throughput)
  let fleet_s = 75; // neutral default when not provided
  if (shovel_out > 0 && num_shovels > 0 && num_dumpers > 0 && cycle_min > 0) {
    const shovel_cap  = shovel_out * num_shovels;
    const dumper_cap  = (dumper_pay / 2.5) * num_dumpers * (60 / cycle_min);
    const balance     = Math.min(shovel_cap, dumper_cap) / Math.max(shovel_cap, dumper_cap, 1);
    fleet_s = clamp(balance * 100);
  }

  // Sub-topic: Blast efficiency (powder factor + RQD + burden/spacing design + UCS)
  let blast_s = 70;
  if (powder_f > 0) {
    const pf_s   = clamp(100 - (powder_f - 0.20) / (0.60 - 0.20) * 100);
    const rqd_s  = rqd > 0 ? clamp(rqd) : 60;
    let bs_s = 70;
    if (burst_m > 0 && spacing_m > 0) {
      const ratio = burst_m / spacing_m; // ideal B:S ≈ 0.80
      bs_s = clamp(100 - Math.abs(ratio - 0.80) / 0.40 * 100);
    }
    const ucs_s  = ucs_ob > 0 ? clamp(100 - (ucs_ob - 30) / (150 - 30) * 100) : 60;
    blast_s = 0.35 * pf_s + 0.25 * rqd_s + 0.25 * bs_s + 0.15 * ucs_s;
  }

  // Sub-topic: Coal Quality (ash content, moisture, volatile matter)
  const ash_s   = clamp(100 - (ash_pct - 15) / (45 - 15) * 100); // 15%=100, 45%=0
  const moist_s = clamp(100 - (moisture - 5) / (20 - 5) * 100);   // 5%=100, 20%=0
  const vol_s   = clamp(100 - Math.abs(volatile_m - 30) / 18 * 50); // optimum ~30%
  const coal_qual_s = 0.50 * ash_s + 0.30 * moist_s + 0.20 * vol_s;

  // Sub-topic: Seam geometry (seam/OB ratio, dip angle)
  let seam_geom_s = 60; // neutral when not provided
  if (seam_t > 0 && ob_t > 0) {
    const ratio_s = clamp(seam_t / (seam_t + ob_t) * 100); // seam fraction of total
    const dip_s   = clamp(100 - (dip_deg - 3) / (25 - 3) * 100); // <3°=100, >25°=0
    seam_geom_s = 0.60 * ratio_s + 0.40 * dip_s;
  }

  // Sub-topic: HEMM haul transport efficiency (distance + laden/empty speeds)
  let haul_eff_s = 65; // neutral when not provided
  if (haul_dist > 0) {
    const dist_s = clamp(100 - (haul_dist - 400) / (2000 - 400) * 100); // 400m=100, 2000m=0
    const lspd_s = laden_spd > 0 ? clamp((laden_spd - 10) / (25 - 10) * 100) : 60;
    const espd_s = empty_spd > 0 ? clamp((empty_spd - 15) / (35 - 15) * 100) : 60;
    haul_eff_s = 0.50 * dist_s + 0.25 * lspd_s + 0.25 * espd_s;
  }

  // Weights: sum = 1.000
  const T = (
    0.16 * gcv_s       +
    0.14 * sr_s        +
    0.12 * rec_s       +
    0.12 * hemm_s      +
    0.09 * life_s      +
    0.08 * fos_s       +
    0.06 * prod_s      +
    0.04 * fuel_s      +
    0.03 * adv_s       +
    0.03 * fleet_s     +
    0.03 * blast_s     +
    0.04 * coal_qual_s +
    0.03 * seam_geom_s +
    0.03 * haul_eff_s
  );
  return { score: Math.round(clamp(T) * 10) / 10, sr_viability: Math.round(sr_viability * 10) / 10, breakdown: { gcv_s, sr_s, rec_s, hemm_s, life_s, fos_s, prod_s, fuel_s, adv_s, fleet_s, blast_s, ash_s, moist_s, vol_s, seam_geom_s, haul_eff_s } };
}

// ─── Economic Score ───────────────────────────────────────────────────────
function scoreEconomic(p) {
  const npv     = safe(p.npv_cr, 0);
  const irr     = safe(p.irr_pct, 10);
  const capex   = safe(p.capex_cr, 100);
  const opex_t  = safe(p.opex_per_tonne, 400);
  const coal_p  = safe(p.coal_price_t, 1500);
  const royalty = safe(p.royalty_pct, 14);
  const wacc    = safe(p.wacc_pct, 14);
  const closure = safe(p.closure_bond_cr, 0);
  const rev     = safe(p.annual_revenue_cr, 0);
  const pbp     = safe(p.payback_period_yr, 5);
  // NEW v3.0
  const de_ratio  = safe(p.debt_equity_ratio, 0.5);          // D/E ratio
  const price_vol = safe(p.coal_price_volatility_pct, 20);   // % CV of coal price
  const export_pct = safe(p.export_revenue_pct, 0);          // % revenue from spot/export
  // Sub-topic: HEMM operating cost
  const ob_cost   = safe(p.ob_mining_cost, 0);               // OB mining cost Rs/BCM

  // NPV normalised (₹1000 Cr = 100)
  const npv_s   = clamp(npv / 1000 * 100);
  // IRR vs WACC spread
  const irr_s   = clamp(50 + (irr - wacc) * 5);
  // Payback: 2yr=100, 10yr=0
  const pbp_s   = clamp((10 - pbp) / (10 - 2) * 100);
  // Gross margin proxy
  const margin  = rev > 0 ? ((rev * 100 - opex_t * safe(p.annual_prod_mty, 1) * 10) / (rev * 100)) * 100 : 0;
  const margin_s = clamp(margin);
  // Royalty penalty: lower=better
  const roy_s   = clamp(100 - royalty * 3.5);
  // Closure bond as % CAPEX (lower=better)
  const closure_s = capex > 0 ? clamp(100 - (closure / capex) * 200) : 80;
  // NEW: D/E ratio: 0=100, ≥2.0=0
  const de_s    = clamp(100 - de_ratio * 50);
  // NEW: Price volatility: <10%=100, >40%=0
  const vol_s   = clamp(100 - (price_vol - 10) / (40 - 10) * 100);
  // NEW: Export revenue premium: 0%=50, 100%=100
  const exp_s   = clamp(50 + export_pct * 0.5);
  // Sub-topic: OB mining cost: <80 Rs/BCM=100, >250 Rs/BCM=0
  const obcost_s = ob_cost > 0 ? clamp(100 - (ob_cost - 60) / (250 - 60) * 100) : 60;

  const E = (
    0.27 * npv_s    +
    0.23 * irr_s    +
    0.15 * pbp_s    +
    0.10 * margin_s +
    0.06 * roy_s    +
    0.04 * closure_s +
    0.05 * de_s     +
    0.04 * vol_s    +
    0.03 * exp_s    +
    0.03 * obcost_s
  );
  return { score: Math.round(clamp(E) * 10) / 10, breakdown: { npv_s, irr_s, pbp_s, margin_s, roy_s, de_s, vol_s, obcost_s } };
}

// ─── Environmental Score ─────────────────────────────────────────────────
function scoreEnvironmental(p) {
  const ec_map = { Granted: 100, Conditions: 65, Pending: 30, Refused: 0 };
  const ec     = ec_map[p.ec_status] ?? 50;
  const fc_map = { Granted: 100, 'Not Required': 100, Pending: 40, Refused: 0 };
  const fc     = fc_map[p.fc_status] ?? 60;
  const ob_fos   = safe(p.ob_dump_fos, 1.4);
  const ghg      = safe(p.ghg_intensity, 0.05);
  const backfill = safe(p.backfill_ratio, 30);
  const rainfall = safe(p.annual_rainfall_mm, 1200);
  const seismic  = safe(p.seismic_zone, 2);
  const closure_map = { Approved: 100, Draft: 55, 'Not Prepared': 15 };
  const closure_s  = closure_map[p.closure_plan_status] ?? 50;
  const forest_ha  = safe(p.forest_area_ha, 0);
  const lease_ha   = safe(p.lease_area_ha, 1);
  const forest_ratio = clamp(100 - (forest_ha / lease_ha) * 100);
  const pm10     = safe(p.pm10_ambient_ugm3, 120);
  const water_rec = safe(p.water_recycling_pct, 30);
  const renewable = safe(p.renewable_energy_pct, 0);
  const reclaim  = safe(p.land_reclamation_pct, 20);
  const topsoil_map = { Good: 100, Partial: 55, Poor: 15 };
  const topsoil  = topsoil_map[p.top_soil_management] ?? 50;

  // Sub-topic: dewatering balance — pump capacity vs water inflow
  const inflow      = safe(p.water_inflow_m3hr, 0);
  const pump_cap    = safe(p.pump_capacity_m3hr, 0);
  const runoff_c    = safe(p.runoff_coefficient, 0);

  // Sub-topic: Hydrogeology & sulphur (Dewatering subtopic)
  const sulphur_pct  = safe(p.sulphur_pct, 0.8);              // % sulphur → SO2 risk
  const pump_head    = safe(p.pumping_head_m, 0);             // pumping head (m)
  const hyd_cond     = safe(p.hydraulic_conductivity_mday, 0);// aquifer permeability (m/day)
  const aquifer_t    = safe(p.aquifer_thickness_m, 0);        // aquifer thickness (m)
  const depth_wt_e   = safe(p.depth_below_wt_m, 0);          // mine depth below water table

  const ob_fos_s = clamp((ob_fos - 1.0) / (2.0 - 1.0) * 100);
  const ghg_s    = clamp(100 - ghg * 400);
  const bf_s     = clamp(backfill);
  const seis_s   = clamp(100 - (seismic - 1) * 20);
  const pm10_s   = clamp(100 - (pm10 - 60) / (200 - 60) * 100);
  const wrec_s   = clamp((water_rec - 10) / (70 - 10) * 100);
  const renew_s  = clamp(50 + renewable * (50 / 30));
  const recl_s   = clamp(reclaim / 60 * 100);

  // Sub-topic: dewatering adequacy (pump_cap / inflow ≥ 1.5 = safe)
  let dewat_s = 70; // neutral when not provided
  if (inflow > 0 && pump_cap > 0) {
    const ratio = pump_cap / inflow;
    dewat_s = clamp((ratio - 0.8) / (2.0 - 0.8) * 100); // <0.8 = critical, >2.0 = excellent
  }
  // Sub-topic: runoff coefficient (lower = better drainage management; <0.4=90, >0.8=20)
  const runoff_s = runoff_c > 0 ? clamp(100 - (runoff_c - 0.3) / (0.9 - 0.3) * 80) : 65;

  // Sub-topic: Sulphur → SO2 emission risk: <0.5%=100, >2.5%=0
  const sulphur_env_s = clamp(100 - (sulphur_pct - 0.3) / (2.5 - 0.3) * 100);
  // Sub-topic: Pumping head — higher head = more energy + environmental footprint. <30m=100, >200m=0
  const pump_head_s = pump_head > 0 ? clamp(100 - (pump_head - 20) / (200 - 20) * 100) : 65;
  // Sub-topic: Hydrogeological risk (conductivity × aquifer → ingress potential; low=good)
  let hyd_cond_s = 70;
  if (hyd_cond > 0) {
    const hyd_risk = hyd_cond * Math.max(aquifer_t / 10, 1);
    hyd_cond_s = clamp(100 - (hyd_risk - 0.5) / (30 - 0.5) * 100);
  }
  // Sub-topic: Depth below water table — shallower = higher dewatering burden. >80m=100, <5m=0
  const depth_wt_s = depth_wt_e > 0 ? clamp((depth_wt_e - 5) / (80 - 5) * 100) : 60;

  // Weights: sum = 1.000
  const Env = (
    0.18 * ec            +
    0.10 * fc            +
    0.12 * ob_fos_s      +
    0.08 * ghg_s         +
    0.07 * bf_s          +
    0.05 * closure_s     +
    0.04 * forest_ratio  +
    0.03 * seis_s        +
    0.06 * pm10_s        +
    0.05 * wrec_s        +
    0.03 * renew_s       +
    0.04 * recl_s        +
    0.03 * topsoil       +
    0.02 * dewat_s       +
    0.01 * runoff_s      +
    0.03 * sulphur_env_s +
    0.02 * pump_head_s   +
    0.02 * hyd_cond_s    +
    0.02 * depth_wt_s
  );
  return { score: Math.round(clamp(Env) * 10) / 10, breakdown: { ec, fc, ob_fos_s, ghg_s, bf_s, closure_s, pm10_s, wrec_s, dewat_s, sulphur_env_s, pump_head_s, hyd_cond_s } };
}

// ─── Social Score ─────────────────────────────────────────────────────────
function scoreSocial(p) {
  const ltifr      = safe(p.ltifr, 10);
  const far        = safe(p.far, 20);
  const local_emp  = safe(p.local_employment_pct, 60);
  const csr        = safe(p.csr_spend_cr, 1);
  const training   = safe(p.training_hrs_worker, 40);
  const fatalities = safe(p.fatalities_annual, 2);
  // NEW v3.0
  const women_pct  = safe(p.women_employment_pct, 5);        // % female workforce
  const comm_proj  = safe(p.community_projects_count, 5);    // active community projects
  const contr_ltifr = safe(p.contractor_ltifr, safe(p.ltifr, 10) * 1.2); // contractor LTIFR

  // LTIFR: OC coal benchmark 6–12; <4=100, >20=0
  const ltifr_s  = clamp(100 - (ltifr - 4) / (20 - 4) * 100);
  // FAR: <10=100, >50=0
  const far_s    = clamp(100 - (far - 10) / (50 - 10) * 100);
  // Local employment: >80%=100, <30%=0
  const emp_s    = clamp((local_emp - 30) / (80 - 30) * 100);
  // CSR spend: ₹3 Cr=100, 0=0
  const csr_s    = clamp(csr / 3 * 100);
  // Fatalities: 0=100, 5+=0
  const fat_s    = clamp(100 - fatalities * 20);
  // Training hours: 80 hrs=100, 20 hrs=0
  const train_s  = clamp((training - 20) / (80 - 20) * 100);
  // NEW: Women employment: >15%=100, <2%=0
  const women_s  = clamp((women_pct - 2) / (15 - 2) * 100);
  // NEW: Community projects: 20+=100, 0=0
  const comm_s   = clamp(comm_proj / 20 * 100);
  // NEW: Contractor LTIFR (higher risk than direct): <6=100, >25=0
  const contr_s  = clamp(100 - (contr_ltifr - 6) / (25 - 6) * 100);

  const S = (
    0.24 * ltifr_s +
    0.19 * far_s   +
    0.15 * emp_s   +
    0.10 * csr_s   +
    0.10 * fat_s   +
    0.07 * train_s +
    0.07 * women_s +
    0.05 * comm_s  +
    0.03 * contr_s
  );
  return { score: Math.round(clamp(S) * 10) / 10, breakdown: { ltifr_s, far_s, emp_s, csr_s, fat_s, train_s, women_s } };
}

// ─── Geographical Score ───────────────────────────────────────────────────
function scoreGeographical(p) {
  const rail_km  = safe(p.rail_dist_km, 30);
  const working  = safe(p.annual_working_days, 300);
  const monsoon  = safe(p.monsoon_disruption_days, 50);
  const power_av = safe(p.grid_power_availability_pct, 85);
  const power_t  = safe(p.power_tariff_kwh, 6.0);
  const logistics = safe(p.total_logistics_cost_t, 50);

  // Sub-topic: Infrastructure params
  const rail_tariff  = safe(p.rail_tariff, 1.5);          // Rs/tonne-km
  const road_haul    = safe(p.road_haulage_cost, 10);     // Rs/tonne-km
  const despatch_mty = safe(p.annual_despatch_mty, 0);    // MTPA despatched
  const prod_ref     = safe(p.annual_prod_mty, 1);        // MTPA produced
  const energy_gwh   = safe(p.energy_demand_mwh, 0) / 1000; // convert MWh→GWh

  // Rail distance: 0 km=100, 100 km=0
  const rail_s  = clamp(100 - rail_km);
  // Freight cost: ₹30/t=100, ₹120/t=0
  const logi_s  = clamp(100 - (logistics - 30) / (120 - 30) * 100);
  // Working days: 330=100, 240=0
  const work_s  = clamp((working - 240) / (330 - 240) * 100);
  // Power availability: >95%=100, <70%=0
  const pwr_s   = clamp((power_av - 70) / (95 - 70) * 100);
  // Power tariff: ₹4=100, ₹10=0
  const pwrt_s  = clamp(100 - (power_t - 4) / (10 - 4) * 100);
  // Sub-topic: Rail tariff: <1.0 Rs/tkm=100, >3.5=0
  const tariff_s = clamp(100 - (rail_tariff - 0.5) / (3.5 - 0.5) * 100);
  // Sub-topic: Road haulage cost: <5 Rs/tkm=100, >20=0
  const road_s   = clamp(100 - (road_haul - 3) / (20 - 3) * 100);
  // Sub-topic: Despatch utilisation (actual vs produced): higher=better market integration
  const despatch_s = despatch_mty > 0 ? clamp(despatch_mty / Math.max(prod_ref, 0.01) * 100) : 70;
  // Sub-topic: Energy intensity GWh/MTPA: <30=100, >150=0
  const energy_eff_s = energy_gwh > 0 ? clamp(100 - (energy_gwh / Math.max(prod_ref, 0.01) - 20) / (150 - 20) * 100) : 65;

  // Weights: sum = 1.000
  const G = (
    0.22 * rail_s      +
    0.20 * logi_s      +
    0.20 * work_s      +
    0.16 * pwr_s       +
    0.08 * pwrt_s      +
    0.04 * tariff_s    +
    0.04 * road_s      +
    0.04 * despatch_s  +
    0.02 * energy_eff_s
  );
  return { score: Math.round(clamp(G) * 10) / 10, breakdown: { rail_s, logi_s, work_s, pwr_s, pwrt_s, tariff_s, road_s, despatch_s } };
}

// ─── Governance Score (NEW v3.0) ──────────────────────────────────────────
function scoreGovernance(p) {
  const iso14_map = { Certified: 100, 'In Progress': 55, 'Not Started': 10 };
  const iso45_map = { Certified: 100, 'In Progress': 55, 'Not Started': 10 };
  const iso14   = iso14_map[p.iso_14001] ?? 30;             // Env management system
  const iso45   = iso45_map[p.iso_45001] ?? 30;             // OHS management system
  const violations = safe(p.regulatory_violations_annual, 3);
  const esg     = safe(p.esg_disclosure_score, 40);          // 0-100 ESG disclosure quality
  const audit   = safe(p.audit_findings_critical, 3);        // critical findings/yr
  const dgms    = safe(p.dgms_compliance_pct, 70);           // DGMS audit compliance %

  // Violations: 0=100, ≥5=0
  const viol_s  = clamp(100 - violations * 20);
  // ESG disclosure: direct 0-100
  const esg_s   = clamp(esg);
  // Audit findings: 0=100, ≥5=0
  const audit_s = clamp(100 - audit * 20);
  // DGMS compliance: 100%=100, <50%=0
  const dgms_s  = clamp((dgms - 50) / (100 - 50) * 100);

  const Gov = (
    0.25 * iso45   +   // OHS certification — highest weight
    0.20 * iso14   +   // Env certification
    0.20 * viol_s  +   // Regulatory compliance record
    0.15 * esg_s   +   // Transparency & ESG reporting
    0.12 * dgms_s  +   // Mining regulator compliance
    0.08 * audit_s     // Internal controls quality
  );
  return { score: Math.round(clamp(Gov) * 10) / 10, breakdown: { iso45, iso14, viol_s, esg_s, dgms_s, audit_s } };
}

// ─── Risk Score ───────────────────────────────────────────────────────────
function scoreRisk(p) {
  const fos_mean = safe(p.slope_fos_mean, 1.35);
  const fos_sd   = safe(p.slope_fos_sd, 0.12);
  const pof      = safe(p.prob_of_failure_pct, 3.2);
  const el       = safe(p.expected_loss_cr, 5);
  const cpt      = safe(p.cpt_deg, 165);
  const methane  = safe(p.seam_methane_m3t, 0.4);
  const lease_yr = safe(p.lease_years_remaining, 15);
  const litigation = safe(p.litigation_count, 2);
  const capex    = safe(p.capex_cr, 100);
  const ins_prem = safe(p.insurance_premium_pct, 1.0);
  const near_miss = safe(p.near_miss_count_annual, 30);
  const fire_inc  = safe(p.fire_incident_count_annual, 1);
  const dgms_comp = safe(p.dgms_compliance_pct, 70);

  // Sub-topic: bench geometry, haul road & hydrogeological risk
  const bench_ob   = safe(p.bench_height_ob_m, 0);      // OB bench height
  const road_w     = safe(p.haul_road_width_m, 0);      // haul road width
  const inflow_r   = safe(p.water_inflow_m3hr, 0);      // mine water inflow
  const pump_r     = safe(p.pump_capacity_m3hr, 0);     // pump capacity
  const haul_grad  = safe(p.haul_road_gradient_pct, 0); // haul road gradient %
  const depth_wt_r = safe(p.depth_below_wt_m, 0);       // depth below water table
  const aquifer_r  = safe(p.aquifer_thickness_m, 0);    // aquifer thickness

  // β reliability index: β = (FoS_mean - 1.0) / σ_FoS (Hasofer-Lind)
  const beta     = fos_sd > 0 ? (fos_mean - 1.0) / fos_sd : 0;

  // Slope FoS: ≥2.0=0 risk, ≤1.1=100 risk
  const fos_r    = clamp(100 - (fos_mean - 1.1) / (2.0 - 1.1) * 100);
  // POF: 0%=0 risk, 10%=100 risk
  const pof_r    = clamp(pof * 10);
  // Expected loss as % CAPEX
  const el_r     = capex > 0 ? clamp(el / capex * 1000) : 50;
  // CPT spontaneous combustion: <140=100 risk, >175=0 risk
  const cpt_r    = clamp(100 - (cpt - 140) / (175 - 140) * 100);
  // Methane: 0=0 risk, >2.0=100 risk
  const meth_r   = clamp(methane / 2.0 * 100);
  // Lease years: <5=100 risk, >30=0 risk
  const lease_r  = clamp(100 - (lease_yr - 5) / (30 - 5) * 100);
  // Litigation: 0=0 risk, 5=100 risk
  const liti_r   = clamp(litigation * 20);
  // Insurance premium: <0.5%=0 risk, >3%=100 risk
  const ins_r    = clamp((ins_prem - 0.5) / (3.0 - 0.5) * 100);
  // Near miss: 0=0 risk, >60=100 risk
  const nm_r     = clamp(near_miss / 60 * 100);
  // Fire incidents: 0=0 risk, ≥3=100 risk
  const fire_r   = clamp(fire_inc / 3 * 100);
  // DGMS non-compliance: 100%=0 risk, <50%=100 risk (inverted)
  const dgms_r   = clamp(100 - dgms_comp);

  // Sub-topic: OB bench height — >15 m benches increase slope risk (DGMS: max 10 m for soft rock)
  const bench_r  = bench_ob > 0 ? clamp((bench_ob - 8) / (20 - 8) * 100) : 40;
  // Sub-topic: haul road width — <12 m = high vehicle collision risk for 85 t dumpers
  const road_r   = road_w > 0 ? clamp(100 - (road_w - 10) / (20 - 10) * 100) : 40;
  // Sub-topic: dewatering risk — pump capacity vs inflow (inflow > pump = flood risk)
  let dewat_r = 30; // neutral
  if (inflow_r > 0 && pump_r > 0) {
    const ratio = pump_r / inflow_r;
    dewat_r = clamp(100 - (ratio - 0.8) / (2.0 - 0.8) * 100);
  }

  // Sub-topic: Haul road gradient — >10% high risk for heavy vehicles (DGMS: max 10% grade)
  const grad_r = haul_grad > 0 ? clamp((haul_grad - 6) / (15 - 6) * 100) : 30;

  // Sub-topic: Hydrogeological inundation risk (shallow water table + thick aquifer)
  let hydro_r = 30;
  if (depth_wt_r > 0) {
    const depth_risk   = clamp(100 - (depth_wt_r - 5) / (60 - 5) * 100); // shallow=high risk
    const aquifer_risk = aquifer_r > 0 ? clamp(aquifer_r / 50 * 100) : 30; // thick=more risk
    hydro_r = 0.60 * depth_risk + 0.40 * aquifer_risk;
  }

  // Weights: sum = 1.000
  const R = (
    0.16 * fos_r   +
    0.13 * pof_r   +
    0.12 * el_r    +
    0.11 * cpt_r   +
    0.08 * meth_r  +
    0.06 * lease_r +
    0.04 * liti_r  +
    0.03 * ins_r   +
    0.08 * nm_r    +
    0.04 * fire_r  +
    0.02 * dgms_r  +
    0.04 * bench_r +
    0.02 * road_r  +
    0.03 * dewat_r +
    0.02 * grad_r  +
    0.02 * hydro_r
  );
  const safety_quality = Math.round(clamp(100 - R) * 10) / 10;
  return { score: safety_quality, beta: Math.round(beta * 100) / 100, breakdown: { fos_r, pof_r, el_r, cpt_r, meth_r, lease_r, nm_r, fire_r, bench_r, dewat_r, grad_r, hydro_r } };
}

// ─── MCI Computation ─────────────────────────────────────────────────────
function computeMCI(params) {
  const tech  = scoreTechnical(params);
  const econ  = scoreEconomic(params);
  const env   = scoreEnvironmental(params);
  const soc   = scoreSocial(params);
  const geo   = scoreGeographical(params);
  const gov   = scoreGovernance(params);
  const risk  = scoreRisk(params);

  const dim_scores = {
    technical:     tech.score,
    economic:      econ.score,
    environmental: env.score,
    social:        soc.score,
    geographical:  geo.score,
    governance:    gov.score,
    risk:          risk.score
  };

  const mci_raw = Object.entries(ENSEMBLE_WEIGHTS).reduce((sum, [dim, w]) => {
    return sum + w * dim_scores[dim];
  }, 0);

  // Linear calibration (factor 0.87) derived from 4 validate mines (MAE ≈ 2.5 pts)
  const mci_calibrated = mci_raw * 0.87;
  const mci_rounded = Math.round(Math.max(0, Math.min(100, mci_calibrated)) * 10) / 10;

  let grade, recommendation;
  if      (mci_rounded >= 80) { grade = 'A'; recommendation = 'Excellent — Investment grade. Proceed with full development.'; }
  else if (mci_rounded >= 65) { grade = 'B'; recommendation = 'Good — Viable. Address weakest dimension before capital commitment.'; }
  else if (mci_rounded >= 50) { grade = 'C'; recommendation = 'Marginal — High-risk. Sensitivity analysis required. Staged investment.'; }
  else                        { grade = 'D'; recommendation = 'High Risk — Non-investment grade. Remediation plan required.'; }

  // Valuation method selection (CIMVAL Code)
  let valuation_method;
  const stage = params.lifecycle_stage || 'Producing';
  if (stage === 'Exploration') {
    valuation_method = { method: 'EV/Resource Multiple', reason: 'No cash flow yet — Market Approach via peer comparables', counter: 'No peers → Real Options Valuation' };
  } else if (stage === 'Development') {
    valuation_method = { method: 'DCF + Real Options Valuation', reason: 'Management flexibility to delay/abandon has option value', counter: 'All options committed → Pure DCF ±15%' };
  } else {
    valuation_method = { method: 'DCF / NPV / IRR', reason: 'Stable cash flows — Income Approach (CIMVAL). India CMPDI hurdle FIRR ≥ 10-12%', counter: 'Price σ > 40% → Scenario DCF at P10/P50/P90' };
  }

  // ── Subtopic composite scores (0–100) — aggregated from dimension sub-breakdowns
  const TB = tech.breakdown, EB = env.breakdown, GB = geo.breakdown, RB = risk.breakdown;
  const subtopic_scores = {
    mine_life:       Math.round(clamp(0.55*(TB.life_s??50) + 0.30*(TB.prod_s??50) + 0.15*(TB.adv_s??50)) * 10) / 10,
    hemm_cost:       Math.round(clamp(0.40*(TB.hemm_s??65) + 0.25*(TB.fleet_s??65) + 0.20*(TB.haul_eff_s??65) + 0.15*(TB.fuel_s??65)) * 10) / 10,
    stripping_ratio: Math.round(clamp(0.65*(TB.sr_s??50) + 0.35*(TB.seam_geom_s??60)) * 10) / 10,
    coal_quality:    Math.round(clamp(0.45*(TB.gcv_s??50) + 0.30*(TB.ash_s??50) + 0.15*(EB.sulphur_env_s??70) + 0.10*(100-(RB.cpt_r??40))) * 10) / 10,
    bench_blast:     Math.round(clamp(0.50*(TB.blast_s??65) + 0.30*(100-(RB.bench_r??40)) + 0.20*(100-(RB.grad_r??30))) * 10) / 10,
    dewatering:      Math.round(clamp(0.30*(EB.dewat_s??65) + 0.25*(EB.hyd_cond_s??70) + 0.20*(100-(RB.dewat_r??30)) + 0.15*(EB.pump_head_s??65) + 0.10*(100-(RB.hydro_r??30))) * 10) / 10,
    infrastructure:  Math.round(clamp(0.28*(GB.rail_s??60) + 0.22*(GB.logi_s??60) + 0.20*(GB.pwr_s??70) + 0.16*(GB.despatch_s??70) + 0.14*(GB.tariff_s??65)) * 10) / 10,
  };

  return {
    mci: mci_rounded,
    grade,
    recommendation,
    valuation_method,
    dimension_scores: dim_scores,
    subtopic_scores,
    weights: ENSEMBLE_WEIGHTS,
    reliability_index_beta: risk.beta,
    sr_viability_pct: tech.sr_viability,
    breakdowns: {
      technical:     tech.breakdown,
      economic:      econ.breakdown,
      environmental: env.breakdown,
      social:        soc.breakdown,
      geographical:  geo.breakdown,
      governance:    gov.breakdown,
      risk:          risk.breakdown
    }
  };
}

module.exports = { computeMCI, ENSEMBLE_WEIGHTS };
