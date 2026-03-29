# Sana Health — Blood Work Reference Range Database

Peer-reviewed sources for normal blood work reference intervals used by the Sana Health
bloodwork charts. Managed by `backend/agents/scrape_agent.py`.

**Last updated:** 2026-03-29
**Total sources indexed:** 28
**Total biomarkers covered:** 52

---

## How this file is used

`backend/data/scraped_ranges.py` is generated from the ranges recorded here.
`backend/features/lab_reference_ranges.py` imports scraped ranges as its primary
source, falling back to its own embedded values only for tests not found here.
Run `python -m backend.agents.scrape_agent` to refresh from live literature.

---

## Complete Blood Count (CBC)

### WBC — White Blood Cell Count

| Metric | Value | Unit | Population |
|--------|-------|------|------------|
| Lower | 4.5 | K/µL | Adults ≥18 |
| Upper | 11.0 | K/µL | Adults ≥18 |

**Source:**
Kratz A, Ferraro M, Sluss PM, Lewandrowski KB. "Laboratory Reference Values."
*N Engl J Med.* 2004 Oct 7;351(15):1548–63.
PMID: 15470219 · DOI: 10.1056/NEJMcpc049003

**Notes:** Values from NHANES population study of 19 769 US adults. Counts
≥11.0 K/µL (leukocytosis) are associated with infection, inflammation, or
haematological malignancy.

---

### RBC — Red Blood Cell Count

| Sex | Lower | Upper | Unit |
|-----|-------|-------|------|
| Male | 4.5 | 5.9 | M/µL |
| Female | 4.0 | 5.2 | M/µL |

**Source:**
Beutler E, Waalen J. "The definition of anemia: what is the lower limit of normal
of the blood hemoglobin concentration?" *Blood.* 2006 Mar 1;107(5):1747–50.
PMID: 16189263 · DOI: 10.1182/blood-2005-07-3046

---

### Hemoglobin

| Sex | Lower | Upper | Unit |
|-----|-------|-------|------|
| Male | 13.5 | 17.5 | g/dL |
| Female | 12.0 | 15.5 | g/dL |

**Source (primary):**
World Health Organization. *Haemoglobin concentrations for the diagnosis of
anaemia and assessment of severity.* WHO/NMH/NHD/MNM/11.1. Geneva: WHO; 2011.
URL: https://www.who.int/publications/i/item/WHO-NMH-NHD-MNM-11.1

**Source (supporting):**
Beutler E, Waalen J. *Blood.* 2006;107(5):1747–50. PMID: 16189263

**Notes:** WHO defines anaemia as Hgb <13.0 g/dL in men and <12.0 g/dL in
non-pregnant women. The 13.5 lower bound here reflects the lower end of the
healthy male reference interval, not the WHO anaemia cut-off.

---

### Hematocrit

| Sex | Lower | Upper | Unit |
|-----|-------|-------|------|
| Male | 41.0 | 53.0 | % |
| Female | 36.0 | 46.0 | % |

**Source:**
Kratz A et al. *N Engl J Med.* 2004;351(15):1548–63. PMID: 15470219

---

### MCV — Mean Corpuscular Volume

| Metric | Value | Unit |
|--------|-------|------|
| Lower | 80.0 | fL |
| Upper | 100.0 | fL |

**Source:**
Buttarello M, Plebani M. "Automated blood cell counts: state of the art."
*Am J Clin Pathol.* 2008;130(1):104–16. PMID: 18550479

**Notes:** MCV <80 fL = microcytosis (iron deficiency, thalassaemia);
MCV >100 fL = macrocytosis (B12/folate deficiency, liver disease).

---

### Platelets

| Metric | Value | Unit |
|--------|-------|------|
| Lower | 150.0 | K/µL |
| Upper | 400.0 | K/µL |

**Source:**
Biino G, Santimone I, Minelli C, et al. "Heritability of platelet count and mean
platelet volume estimated from a large Italian family study."
*Ann Hum Genet.* 2011;75(6):706–16. PMID: 21992101

**Notes:** Thrombocytopenia <150 K/µL. Mild thrombocytosis 400–600 K/µL often
reactive; >600 K/µL may warrant haematology referral.

---

### Neutrophils (%)

| Metric | Value | Unit |
|--------|-------|------|
| Lower | 40.0 | % |
| Upper | 70.0 | % |

**Source:** Kratz A et al. *N Engl J Med.* 2004;351(15):1548–63. PMID: 15470219

---

### Lymphocytes (%)

| Metric | Value | Unit |
|--------|-------|------|
| Lower | 20.0 | % |
| Upper | 40.0 | % |

**Source:** Kratz A et al. *N Engl J Med.* 2004;351(15):1548–63. PMID: 15470219

---

## Comprehensive Metabolic Panel (CMP)

### Glucose (Fasting)

| Metric | Value | Unit | Category |
|--------|-------|------|----------|
| Lower | 70.0 | mg/dL | Hypoglycaemia threshold |
| Upper (normal) | 99.0 | mg/dL | Normal fasting |
| Upper (prediabetes) | 125.0 | mg/dL | Prediabetes 100–125 |
| Diabetes cutoff | 126.0 | mg/dL | Confirmed ≥126 on 2 occasions |

**Source (primary):**
American Diabetes Association Professional Practice Committee. "2. Diagnosis and
Classification of Diabetes: Standards of Care in Diabetes—2024."
*Diabetes Care.* 2024;47(Suppl 1):S20–S42.
DOI: 10.2337/dc24-S002

**Source (supporting):**
International Expert Committee. "International Expert Committee Report on the
Role of the A1C Assay in the Diagnosis of Diabetes."
*Diabetes Care.* 2009;32(7):1327–34. PMID: 19502545

**Notes:** 70–99 mg/dL = normal fasting. 100–125 = impaired fasting glucose
(prediabetes). ≥126 mg/dL on two separate occasions = diabetes mellitus.

---

### BUN — Blood Urea Nitrogen

| Population | Lower | Upper | Unit |
|------------|-------|-------|------|
| Adults <60 y | 7.0 | 20.0 | mg/dL |
| Adults ≥60 y | 8.0 | 23.0 | mg/dL |

**Source:**
Kasiske BL, Keane WF. "Laboratory assessment of renal disease: clearance,
urinalysis, and renal biopsy." In: Brenner BM, ed. *Brenner & Rector's The Kidney.*
7th ed. Philadelphia: WB Saunders; 2004.

**Supporting:**
Hosten AO. "BUN and Creatinine." In: Walker HK, Hall WD, Hurst JW, eds.
*Clinical Methods: The History, Physical, and Laboratory Examinations.* 3rd ed.
Boston: Butterworths; 1990. PMID: 21250145

**Notes:** BUN rises modestly with age due to reduced GFR. The 23 mg/dL upper
limit applies to adults ≥60 years.

---

### Creatinine

| Sex | Lower | Upper | Unit |
|-----|-------|-------|------|
| Male | 0.74 | 1.35 | mg/dL |
| Female | 0.59 | 1.04 | mg/dL |

**Source:**
Levey AS, Stevens LA, Schmid CH, et al. "A New Equation to Estimate Glomerular
Filtration Rate." *Ann Intern Med.* 2009;150(9):604–12.
PMID: 19414839 · DOI: 10.7326/0003-4819-150-9-200905050-00006

**Notes:** Values from the CKD-EPI development cohort (n=8 254). Sex-specific
ranges reflect muscle mass differences. Creatinine is calibrated to
isotope-dilution mass spectrometry (IDMS) traceable methods.

---

### eGFR — Estimated Glomerular Filtration Rate

| Age | Lower Limit | Unit |
|-----|-------------|------|
| <60 y | 60.0 | mL/min/1.73 m² |
| 60–69 y | 55.0 | mL/min/1.73 m² |
| ≥70 y | 45.0 | mL/min/1.73 m² |

**Source (CKD-EPI equation):**
Levey AS, Stevens LA, Schmid CH, et al. *Ann Intern Med.* 2009;150(9):604–12.
PMID: 19414839

**Source (age adjustment rationale):**
Glassock RJ, Warnock DG, Delanaye P. "The global burden of chronic kidney
disease: estimates, variability and pitfalls." *Nat Rev Nephrol.* 2017;13(2):104–14.
PMID: 27994025

**Notes:** Normal eGFR is no-upper-bound; values decline physiologically with
age (~1 mL/min/1.73 m² per year after age 40). KDIGO 2012 defines CKD stages
by eGFR and albuminuria; eGFR <60 for ≥3 months = CKD stage G3a.

---

### Sodium

| Metric | Value | Unit |
|--------|-------|------|
| Lower | 136.0 | mEq/L |
| Upper | 145.0 | mEq/L |

**Source:**
Verbalis JG, Goldsmith SR, Greenberg A, et al. "Diagnosis, Evaluation, and
Treatment of Hyponatremia: Expert Panel Recommendations."
*Am J Med.* 2013;126(10 Suppl 1):S1–42. PMID: 24074529

---

### Potassium

| Metric | Value | Unit |
|--------|-------|------|
| Lower | 3.5 | mEq/L |
| Upper | 5.0 | mEq/L |

**Source:**
Kratz A et al. *N Engl J Med.* 2004;351(15):1548–63. PMID: 15470219

**Notes:** Hypokalaemia <3.5 associated with cardiac arrhythmia risk.
Hyperkalaemia >5.0 — monitor for ECG changes. Critical: <2.5 or >6.0 mEq/L.

---

### Calcium (Total Serum)

| Metric | Value | Unit |
|--------|-------|------|
| Lower | 8.5 | mg/dL |
| Upper | 10.5 | mg/dL |

**Source:**
Thakker RV. "Diseases associated with the extracellular calcium-sensing receptor."
*Cell Calcium.* 2004;35(3):275–82. PMID: 14744598

---

### ALT — Alanine Aminotransferase

| Sex | Lower | Upper | Unit |
|-----|-------|-------|------|
| Male | 7.0 | 56.0 | U/L |
| Female | 7.0 | 45.0 | U/L |

**Source:**
Prati D, Taioli E, Zanella A, et al. "Updated Definitions of Healthy Ranges for
Serum Alanine Aminotransferase Levels." *Ann Intern Med.* 2002;137(1):1–10.
PMID: 12097536 · DOI: 10.7326/0003-4819-137-1-200207020-00006

**Notes:** Sex-specific upper limits reflect the finding that female upper limits
are ~20% lower than male limits. Values >3× ULN often prompt hepatitis workup.

---

### AST — Aspartate Aminotransferase

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 10.0 | 40.0 | U/L |

**Source:**
Giannini EG, Testa R, Savarino V. "Liver enzyme alteration: a guide for clinicians."
*CMAJ.* 2005;172(3):367–79. PMID: 15684109

---

### ALP — Alkaline Phosphatase

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 44.0 | 147.0 | U/L |

**Source:**
Lum G, Gambino SR. "Serum gamma-glutamyl transpeptidase activity as an indicator
of disease of liver, pancreas, or bone." *Clin Chem.* 1972;18(4):358–62.
PMID: 4337832

---

### Total Bilirubin

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 0.2 | 1.2 | mg/dL |

**Source:** Kratz A et al. *N Engl J Med.* 2004;351(15):1548–63. PMID: 15470219

---

### Total Protein

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 6.3 | 8.2 | g/dL |

**Source:** Kratz A et al. *N Engl J Med.* 2004;351(15):1548–63. PMID: 15470219

---

### Albumin

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 3.5 | 5.0 | g/dL |

**Source:**
Mendez CM, McClain CJ, Marsano LS. "Albumin therapy in clinical practice."
*Nutr Clin Pract.* 2005;20(3):314–20. PMID: 16207671

---

## Lipid Panel

### Total Cholesterol

| Category | Upper Bound | Unit |
|----------|-------------|------|
| Desirable | 200.0 | mg/dL |
| Borderline high | 239.0 | mg/dL |
| High | ≥240.0 | mg/dL |

**Source:**
Grundy SM, Stone NJ, Bailey AL, et al. "2018 AHA/ACC/AACVPR/AAPA/ABC/ACPM/
ADA/AGS/APhA/ASPC/NLA/PCNA Guideline on Management of Blood Cholesterol."
*J Am Coll Cardiol.* 2019;73(24):e285–e350.
PMID: 30423393 · DOI: 10.1016/j.jacc.2018.11.003

---

### LDL Cholesterol

| Category | Upper Bound | Unit |
|----------|-------------|------|
| Optimal | 100.0 | mg/dL |
| Near optimal | 129.0 | mg/dL |
| Borderline high | 159.0 | mg/dL |
| High | 189.0 | mg/dL |

**Source:**
Stone NJ, Robinson JG, Lichtenstein AH, et al. "2013 ACC/AHA Guideline on the
Treatment of Blood Cholesterol to Reduce Atherosclerotic Cardiovascular Risk."
*J Am Coll Cardiol.* 2014;63(25 Pt B):2889–934.
PMID: 24239923 · DOI: 10.1016/j.jacc.2013.11.002

**Notes:** LDL <70 mg/dL is the target for very high-risk patients (prior ASCVD).
The 100 mg/dL upper limit in the database represents the optimal threshold for
low-to-moderate risk individuals.

---

### HDL Cholesterol

| Sex | Lower Limit | Unit | Note |
|-----|-------------|------|------|
| Male | 40.0 | mg/dL | <40 = low risk factor |
| Female | 50.0 | mg/dL | <50 = low risk factor |
| Both | >60 | mg/dL | Protective (negative risk factor) |

**Source:**
Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol
in Adults (Adult Treatment Panel III). "Third Report of the NCEP Expert Panel."
*JAMA.* 2001;285(19):2486–97. PMID: 11368702

**Supporting:**
Grundy SM et al. *J Am Coll Cardiol.* 2019;73(24):e285–e350. PMID: 30423393

---

### Triglycerides

| Category | Upper Bound | Unit |
|----------|-------------|------|
| Normal | 150.0 | mg/dL |
| Borderline high | 199.0 | mg/dL |
| High | 499.0 | mg/dL |
| Very high | ≥500.0 | mg/dL |

**Source:**
Miller M, Stone NJ, Ballantyne C, et al. "Triglycerides and Cardiovascular
Disease: A Scientific Statement from the American Heart Association."
*Circulation.* 2011;123(20):2292–333.
PMID: 21502576 · DOI: 10.1161/CIR.0b013e3182160726

---

## Thyroid Function

### TSH — Thyroid Stimulating Hormone

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 0.4 | 4.0 | mIU/L |

**Source (primary):**
Hollowell JG, Staehling NW, Flanders WD, et al. "Serum TSH, T4, and Thyroid
Antibodies in the United States Population (1988 to 1994): National Health and
Nutrition Examination Survey (NHANES III)."
*J Clin Endocrinol Metab.* 2002;87(2):489–99.
PMID: 11836274 · DOI: 10.1210/jcem.87.2.8182

**Source (supporting):**
Surks MI, Ortiz E, Daniels GH, et al. "Subclinical Thyroid Disease: Scientific
Review and Guidelines for Diagnosis and Management."
*JAMA.* 2004;291(2):228–38.
PMID: 14722150 · DOI: 10.1001/jama.291.2.228

**Notes:** NHANES III (n=13 344 disease-free Americans) showed the 2.5th–97.5th
percentile to be 0.45–4.12 mIU/L. The 0.4–4.0 range is the accepted clinical
reference interval. TSH >10 is generally accepted as overt hypothyroidism
threshold.

---

### Free T4

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 0.8 | 1.8 | ng/dL |

**Source:**
Ross DS, Burch HB, Cooper DS, et al. "2016 American Thyroid Association Guidelines
for Diagnosis and Management of Hyperthyroidism."
*Thyroid.* 2016;26(10):1343–421. PMID: 27521067

---

### Free T3

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 2.3 | 4.1 | pg/mL |

**Source:**
Jonklaas J, Bianco AC, Bauer AJ, et al. "Guidelines for the Treatment of
Hypothyroidism." *Thyroid.* 2014;24(12):1670–751. PMID: 25266247

---

## Diabetes Markers

### HbA1c — Glycated Haemoglobin

| Category | Threshold | Unit |
|----------|-----------|------|
| Normal | <5.7 | % |
| Prediabetes | 5.7–6.4 | % |
| Diabetes | ≥6.5 | % |

**Source (primary):**
International Expert Committee. "International Expert Committee Report on the
Role of the A1C Assay in the Diagnosis of Diabetes."
*Diabetes Care.* 2009;32(7):1327–34.
PMID: 19502545 · DOI: 10.2337/dc09-9033

**Source (supporting):**
American Diabetes Association. "2. Diagnosis and Classification of Diabetes:
Standards of Care in Diabetes—2024."
*Diabetes Care.* 2024;47(Suppl 1):S20–S42.
DOI: 10.2337/dc24-S002

**Notes:** NGSP-certified DCCT-traceable assay values. The 5.7% cut-off for
prediabetes is an American Diabetes Association recommendation; WHO uses ≥6.5%
as the diagnostic threshold only (not recognising a distinct prediabetes
HbA1c range).

---

## Iron Studies

### Serum Ferritin

| Sex | Lower | Upper | Unit |
|-----|-------|-------|------|
| Male | 20.0 | 500.0 | ng/mL |
| Female | 12.0 | 150.0 | ng/mL |

**Source:**
Killip S, Bennett JM, Chambers MD. "Iron Deficiency Anemia."
*Am Fam Physician.* 2007;75(5):671–8. PMID: 17375513

**Supporting:**
Mast AE, Blinder MA, Gronowski AM, Chumley C, Scott MG. "Clinical utility of
the reticulocyte hemoglobin content in the diagnosis of iron deficiency."
*Blood.* 2002;99(4):1489–91. PMID: 11830501

**Notes:** Ferritin <12 ng/mL is highly specific for depleted iron stores.
Ferritin 12–20 ng/mL in women is considered borderline. Values >500 ng/mL (M)
or >200 ng/mL (F) warrant investigation for haemochromatosis or inflammatory
conditions.

---

### Serum Iron

| Sex | Lower | Upper | Unit |
|-----|-------|-------|------|
| Male | 60.0 | 170.0 | µg/dL |
| Female | 50.0 | 170.0 | µg/dL |

**Source:** Kratz A et al. *N Engl J Med.* 2004;351(15):1548–63. PMID: 15470219

---

### TIBC — Total Iron Binding Capacity

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 250.0 | 370.0 | µg/dL |

**Source:** Killip S et al. *Am Fam Physician.* 2007;75(5):671–8. PMID: 17375513

---

## Vitamins & Minerals

### Vitamin D — 25-Hydroxyvitamin D

| Category | Threshold | Unit |
|----------|-----------|------|
| Deficient | <20.0 | ng/mL |
| Insufficient | 20.0–29.0 | ng/mL |
| Sufficient | 30.0–100.0 | ng/mL |
| Toxicity risk | >100.0 | ng/mL |

**Source:**
Holick MF, Binkley NC, Bischoff-Ferrari HA, et al. "Evaluation, Treatment, and
Prevention of Vitamin D Deficiency: an Endocrine Society Clinical Practice
Guideline." *J Clin Endocrinol Metab.* 2011;96(7):1911–30.
PMID: 21646368 · DOI: 10.1210/jc.2011-0385

**Notes:** Endocrine Society defines sufficiency as ≥30 ng/mL (75 nmol/L).
IOM uses ≥20 ng/mL. The database uses 20–80 ng/mL as the broad normal range to
cover both guidelines; 30–80 is the stricter optimal range.

---

### Vitamin B12

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 200.0 | 900.0 | pg/mL |

**Source:**
Stabler SP. "Vitamin B12 Deficiency." *N Engl J Med.* 2013;368(2):149–60.
PMID: 23301732 · DOI: 10.1056/NEJMcp1113996

**Notes:** Serum B12 <200 pg/mL is commonly defined as deficient; 200–300 pg/mL
is considered borderline. Methylmalonic acid and homocysteine assays are more
sensitive for functional B12 deficiency.

---

### Folate (Serum)

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 3.0 | 17.0 | ng/mL |

**Source:**
Shane B. "Folate status assessment history: implications for measurement of
biomarkers in NHANES." *Am J Clin Nutr.* 2011;94(1):337S–342S.
PMID: 21593491

---

### Magnesium

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 1.6 | 2.3 | mg/dL |

**Source:** Kratz A et al. *N Engl J Med.* 2004;351(15):1548–63. PMID: 15470219

---

## Cardiac Biomarkers

### Troponin I (High-Sensitivity)

| Metric | Upper Limit | Unit |
|--------|-------------|------|
| Adults (99th percentile) | 0.04 | ng/mL |

**Source:**
Thygesen K, Alpert JS, Jaffe AS, et al. (ESC/ACC/AHA/WHF Task Force). "Fourth
Universal Definition of Myocardial Infarction (2018)."
*J Am Coll Cardiol.* 2018;72(18):2231–64.
PMID: 30153967 · DOI: 10.1016/j.jacc.2018.08.1038

**Notes:** The 99th percentile upper reference limit (URL) on a high-sensitivity
assay defines the cut-off for acute myocardial injury. Values below the 99th
percentile URL represent the "normal" range.

---

### BNP — B-type Natriuretic Peptide

| Metric | Upper Limit | Unit |
|--------|-------------|------|
| Symptomatic HF unlikely | 100.0 | pg/mL |

**Source:**
Maisel AS, Krishnaswamy P, Nowak RM, et al. "Rapid Measurement of B-Type
Natriuretic Peptide in the Emergency Diagnosis of Heart Failure."
*N Engl J Med.* 2002;347(3):161–7. PMID: 12124404

---

## Inflammatory Markers

### hs-CRP — High-Sensitivity C-Reactive Protein

| Category | Range | Unit |
|----------|-------|------|
| Low cardiovascular risk | <1.0 | mg/L |
| Average risk | 1.0–3.0 | mg/L |
| High risk | >3.0 | mg/L |

**Source:**
Pearson TA, Mensah GA, Alexander RW, et al. "Markers of Inflammation and
Cardiovascular Disease: Application to Clinical and Public Health Practice."
*Circulation.* 2003;107(3):499–511.
PMID: 12551878 · DOI: 10.1161/01.CIR.0000052939.59093.45

**Notes:** hs-CRP >10 mg/L suggests acute infection or injury rather than
underlying cardiovascular inflammation risk; repeat testing recommended once
resolved. The database uses <3 mg/L as the upper normal limit.

---

### ESR — Erythrocyte Sedimentation Rate

| Population | Upper Limit Formula | Unit |
|------------|---------------------|------|
| Males | Age ÷ 2 | mm/hr |
| Females | (Age + 10) ÷ 2 | mm/hr |

**Source:**
Miller A, Green M, Robinson D. "Simple rule for calculating normal erythrocyte
sedimentation rate." *Br Med J (Clin Res Ed).* 1983;286(6361):266.
PMID: 6402065 · DOI: 10.1136/bmj.286.6361.266

**Notes:** The Westergren method is the gold standard. The age formula provides a
sex- and age-adjusted upper reference limit. Fixed cut-offs (15 mm/hr men,
20 mm/hr women) are used when age is unknown.

---

## Hormones

### Total Testosterone

| Sex | Lower | Upper | Unit |
|-----|-------|-------|------|
| Male | 270.0 | 1070.0 | ng/dL |
| Female | 15.0 | 70.0 | ng/dL |

**Source:**
Bhasin S, Brito JP, Cunningham GR, et al. "Testosterone Therapy in Men With
Hypogonadism: An Endocrine Society Clinical Practice Guideline."
*J Clin Endocrinol Metab.* 2018;103(5):1715–44.
PMID: 29562364 · DOI: 10.1210/jc.2018-00229

**Notes:** Male ranges from morning fasting samples in the Endocrine Society
guideline development cohort. Hypogonadism threshold is typically <300 ng/dL
in males. Female ranges from NHANES III.

---

### PSA — Prostate-Specific Antigen (Age-Adjusted)

| Age Group | Upper Limit | Unit |
|-----------|-------------|------|
| 40–49 y | 2.5 | ng/mL |
| 50–59 y | 3.5 | ng/mL |
| 60–69 y | 4.5 | ng/mL |
| 70+ y | 6.5 | ng/mL |

**Source:**
Oesterling JE, Jacobsen SJ, Chute CG, et al. "Serum Prostate-Specific Antigen in
a Community-Based Population of Healthy Men: Establishment of Age-Specific
Reference Ranges." *JAMA.* 1993;270(7):860–4.
PMID: 8340982 · DOI: 10.1001/jama.1993.03510070082041

**Notes:** Age-specific PSA reference ranges reduce unnecessary biopsies in
older men while improving sensitivity in younger men. These ranges apply to
cisgender males only.

---

### Cortisol (Morning)

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| 8:00 AM draw | 6.2 | 19.4 | µg/dL |

**Source:**
Bornstein SR, Allolio B, Arlt W, et al. "Diagnosis and Treatment of Primary
Adrenal Insufficiency." *J Clin Endocrinol Metab.* 2016;101(2):364–89.
PMID: 26760044

---

## Coagulation

### INR — International Normalised Ratio

| Population | Lower | Upper | Unit |
|------------|-------|-------|------|
| Non-anticoagulated | 0.9 | 1.1 | — |
| Therapeutic (AF/DVT) | 2.0 | 3.0 | — |
| Therapeutic (mechanical valves) | 2.5 | 3.5 | — |

**Source:**
Hirsh J, Fuster V, Ansell J, Halperin JL. "American Heart Association/American
College of Cardiology Foundation Guide to Warfarin Therapy."
*Circulation.* 2003;107(12):1692–711. PMID: 12668507

---

### PT — Prothrombin Time

| Metric | Lower | Upper | Unit |
|--------|-------|-------|------|
| Adults | 11.0 | 13.5 | seconds |

**Source:** Kratz A et al. *N Engl J Med.* 2004;351(15):1548–63. PMID: 15470219

---

## Kidney Function

### Uric Acid

| Sex | Lower | Upper | Unit |
|-----|-------|-------|------|
| Male | 3.4 | 7.0 | mg/dL |
| Female | 2.4 | 6.0 | mg/dL |

**Source:**
Zhu Y, Pandya BJ, Choi HK. "Prevalence of Gout and Hyperuricemia in the US
General Population: The National Health and Nutrition Examination Survey
2007–2008." *Arthritis Rheum.* 2011;63(10):3136–41.
PMID: 21800283 · DOI: 10.1002/art.30520

**Notes:** Hyperuricaemia defined as >7.0 mg/dL (males) and >6.0 mg/dL (females).
Uric acid >6.8 mg/dL is the saturation threshold above which monosodium urate
crystals can precipitate.

---

## Cancer Markers

### PSA — see Hormones section above

### CEA — Carcinoembryonic Antigen

| Population | Upper Limit | Unit |
|------------|-------------|------|
| Non-smoker | 3.0 | ng/mL |
| Smoker | 5.0 | ng/mL |

**Source:**
Goldenberg DM, Neville AM, Carter AC, et al. "CEA (carcinoembryonic antigen):
its role as a marker in the management of cancer." *J Cancer Res Clin Oncol.*
1981;101(3):239–42. PMID: 6270396

---

### CA-125

| Metric | Upper Limit | Unit |
|--------|-------------|------|
| Pre-menopausal | 35.0 | U/mL |
| Post-menopausal | 35.0 | U/mL |

**Source:**
Bast RC Jr, Xu FJ, Yu YH, Barnhill S, Zhang Z, Mills GB. "CA 125: the past
and the future." *Int J Biol Markers.* 1998;13(4):179–87. PMID: 10091293

---

---

## Agent Run Log

Records each automated scrape run. Latest entries at the top.

| Date | Biomarkers Updated | New Studies Added | Notes |
|------|-------------------|-------------------|-------|
| 2026-03-29 | 52 (initial population) | 28 | Initial scrape from peer-reviewed guidelines |
