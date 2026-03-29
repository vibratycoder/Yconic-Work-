/**
 * Labs screen — displays all lab results with scan and document upload functionality.
 *
 * Matches the web bloodwork page design system pixel-perfectly:
 * - Dark background (#04090f) with glass-morphism cards
 * - Summary filter pills (All / High / Normal / Low / Unknown)
 * - Table / Chart view toggle
 * - Section grouping: CBC, Metabolic Panel, Lipid Panel, Thyroid & Metabolic
 * - Horizontal bullet chart (pure View/StyleSheet, no SVG library)
 * - Demo badge when showing simulated data (no real labs loaded yet)
 *
 * Supports two import paths:
 * 1. Camera scan — photographs a lab report for direct OCR extraction.
 * 2. Document upload — picks any file; the backend classifies it and routes
 *    bloodwork automatically to this screen with personalised High/Normal/Low ratings.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LabResult, RatedLabResult } from '../../lib/types';
import { fetchHealthProfile, uploadLabScan, analyzeDocument } from '../../lib/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_USER_ID = '274f67e3-77d8-46a4-8ddc-a1978131ca56';

const DEMO_DATE = '2026-03-15';

/** Simulated demo lab results — identical to the web bloodwork page. */
const SIMULATED_LABS: LabResult[] = [
  // Complete Blood Count
  { test_name: 'WBC',        value: 7.2,  unit: 'K/µL',           reference_range_low: 4.5,  reference_range_high: 11.0, status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'RBC',        value: 5.1,  unit: 'M/µL',           reference_range_low: 4.7,  reference_range_high: 6.1,  status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'Hemoglobin', value: 15.2, unit: 'g/dL',           reference_range_low: 13.5, reference_range_high: 17.5, status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'Hematocrit', value: 44,   unit: '%',              reference_range_low: 41,   reference_range_high: 53,   status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'Platelets',  value: 240,  unit: 'K/µL',           reference_range_low: 150,  reference_range_high: 400,  status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  // Comprehensive Metabolic Panel
  { test_name: 'Glucose (Fasting)', value: 88,  unit: 'mg/dL',           reference_range_low: 70,  reference_range_high: 100, status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'Creatinine',        value: 0.9, unit: 'mg/dL',           reference_range_low: 0.7, reference_range_high: 1.3, status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'eGFR',              value: 112, unit: 'mL/min/1.73m²',  reference_range_low: 60,                             status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'Sodium',            value: 140, unit: 'mEq/L',           reference_range_low: 136, reference_range_high: 145, status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'Potassium',         value: 4.1, unit: 'mEq/L',           reference_range_low: 3.5, reference_range_high: 5.0, status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'ALT',               value: 22,  unit: 'U/L',             reference_range_low: 7,   reference_range_high: 56,  status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'AST',               value: 18,  unit: 'U/L',             reference_range_low: 10,  reference_range_high: 40,  status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  // Lipid Panel
  { test_name: 'Total Cholesterol', value: 172, unit: 'mg/dL', reference_range_high: 200, status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'LDL Cholesterol',   value: 108, unit: 'mg/dL', reference_range_high: 100, status: 'high',   date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'HDL Cholesterol',   value: 52,  unit: 'mg/dL', reference_range_low: 40,   status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'Triglycerides',     value: 88,  unit: 'mg/dL', reference_range_high: 150, status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  // Thyroid & Metabolic
  { test_name: 'TSH',             value: 2.4,  unit: 'mIU/L',  reference_range_low: 0.4, reference_range_high: 4.0,   status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'HbA1c',           value: 5.2,  unit: '%',      reference_range_high: 5.7,                               status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'Vitamin D (25-OH)', value: 22, unit: 'ng/mL',  reference_range_low: 30,  reference_range_high: 100,   status: 'low',    date_collected: DEMO_DATE, lab_source: 'manual' },
  { test_name: 'Iron',            value: 95,   unit: 'µg/dL',  reference_range_low: 60,  reference_range_high: 170,   status: 'normal', date_collected: DEMO_DATE, lab_source: 'manual' },
];

/** Mapping from test name to display section label — order matters for rendering. */
const SECTION_MAP: Record<string, string> = {
  'WBC':                 'Complete Blood Count',
  'RBC':                 'Complete Blood Count',
  'Hemoglobin':          'Complete Blood Count',
  'Hematocrit':          'Complete Blood Count',
  'Platelets':           'Complete Blood Count',
  'Glucose (Fasting)':   'Metabolic Panel',
  'Creatinine':          'Metabolic Panel',
  'eGFR':                'Metabolic Panel',
  'Sodium':              'Metabolic Panel',
  'Potassium':           'Metabolic Panel',
  'ALT':                 'Metabolic Panel',
  'AST':                 'Metabolic Panel',
  'Total Cholesterol':   'Lipid Panel',
  'LDL Cholesterol':     'Lipid Panel',
  'HDL Cholesterol':     'Lipid Panel',
  'Triglycerides':       'Lipid Panel',
  'TSH':                 'Thyroid & Metabolic',
  'HbA1c':               'Thyroid & Metabolic',
  'Vitamin D (25-OH)':   'Thyroid & Metabolic',
  'Iron':                'Thyroid & Metabolic',
};

/** Canonical section display order. */
const SECTION_ORDER = [
  'Complete Blood Count',
  'Metabolic Panel',
  'Lipid Panel',
  'Thyroid & Metabolic',
];

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

/** Status-specific colours matching the web design system. */
const STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  high:     { color: '#ff9f0a', bg: 'rgba(255,159,10,0.15)',  border: 'rgba(255,159,10,0.4)'  },
  low:      { color: '#0a84ff', bg: 'rgba(10,132,255,0.15)', border: 'rgba(10,132,255,0.4)'  },
  normal:   { color: '#30d158', bg: 'rgba(48,209,88,0.12)',  border: 'rgba(48,209,88,0.35)'  },
  unknown:  { color: '#8e8e93', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' },
  critical: { color: '#ff453a', bg: 'rgba(255,45,85,0.18)',  border: 'rgba(255,69,58,0.45)'  },
};

/** Filter pill labels in display order. */
const FILTER_OPTIONS = ['All', 'High', 'Normal', 'Low', 'Unknown'] as const;
type FilterOption = typeof FILTER_OPTIONS[number];

/** View mode for table vs bullet chart. */
type ViewMode = 'Table' | 'Chart';

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Resolve the display status for a lab result, using the rated map if available.
 *
 * @param lab     - The raw lab result.
 * @param ratedMap - Map of test_name (lowercased) → RatedLabResult.
 * @returns Normalised status string ('high' | 'low' | 'normal' | 'critical' | 'unknown').
 */
function resolveStatus(lab: LabResult, ratedMap: Map<string, RatedLabResult>): string {
  const rated = ratedMap.get(lab.test_name.toLowerCase());
  if (rated) {
    const r = rated.rating.toLowerCase();
    if (r === 'high') return 'high';
    if (r === 'low')  return 'low';
    return 'normal';
  }
  return lab.status ?? 'unknown';
}

/**
 * Return the section label for a given test name,
 * falling back to 'Other' for unmapped tests.
 *
 * @param testName - The lab test name.
 */
function sectionForTest(testName: string): string {
  return SECTION_MAP[testName] ?? 'Other';
}

/**
 * Format a numeric lab value for display.
 *
 * @param value - The numeric value or undefined.
 * @param unit  - The unit string or undefined.
 */
function formatValue(value: number | undefined, unit: string | undefined): string {
  if (value === undefined) return '—';
  const v = Number.isInteger(value) ? String(value) : value.toFixed(value < 1 ? 2 : 1);
  return unit ? `${v} ${unit}` : v;
}

/**
 * Build a human-readable reference range string.
 *
 * @param low  - Lower bound or undefined.
 * @param high - Upper bound or undefined.
 */
function formatRange(low: number | undefined, high: number | undefined): string {
  if (low !== undefined && high !== undefined) return `${low} – ${high}`;
  if (low !== undefined) return `> ${low}`;
  if (high !== undefined) return `< ${high}`;
  return '—';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Capitalised status badge pill matching the web design.
 *
 * @param status - Resolved status string.
 */
function StatusBadge({ status }: { status: string }): React.ReactElement {
  const token = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  return (
    <View style={[styles.statusBadge, { backgroundColor: token.bg, borderColor: token.border }]}>
      <Text style={[styles.statusBadgeText, { color: token.color }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

/** Props for a single table row. */
interface TableRowProps {
  lab: LabResult;
  ratedMap: Map<string, RatedLabResult>;
  isEven: boolean;
}

/**
 * A single table row showing test name, value+unit, status badge, and reference range.
 *
 * @param props.lab      - The lab result data.
 * @param props.ratedMap - Personalised rating map.
 * @param props.isEven   - Whether this is an even-indexed row (for subtle alternating bg).
 */
function TableRow({ lab, ratedMap, isEven }: TableRowProps): React.ReactElement {
  const status = resolveStatus(lab, ratedMap);
  const token  = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  return (
    <View style={[styles.tableRow, isEven && styles.tableRowEven]}>
      <Text style={styles.tableTestName} numberOfLines={1}>{lab.test_name}</Text>
      <Text style={[styles.tableValue, { color: token.color }]}>
        {formatValue(lab.value, lab.unit)}
      </Text>
      <StatusBadge status={status} />
      <Text style={styles.tableRange}>
        {formatRange(lab.reference_range_low, lab.reference_range_high)}
      </Text>
    </View>
  );
}

/** Props for a bullet chart row. */
interface ChartRowProps {
  lab: LabResult;
  ratedMap: Map<string, RatedLabResult>;
}

/**
 * Horizontal bullet chart row rendered purely with View and StyleSheet.
 *
 * Layout:
 *  [test name 100px] [track (flex:1)] [value 72px]
 *
 * Track layers (all absolute):
 *  1. Grey full-width track (height 8, borderRadius 4)
 *  2. Green zone = normal range (rgba(48,209,88,0.25))
 *  3. Coloured dot at value position
 *
 * @param props.lab      - The lab result data.
 * @param props.ratedMap - Personalised rating map.
 */
function ChartRow({ lab, ratedMap }: ChartRowProps): React.ReactElement {
  const [trackWidth, setTrackWidth] = useState(0);
  const status = resolveStatus(lab, ratedMap);
  const token  = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;

  const hasNumeric = lab.value !== undefined;
  const low        = lab.reference_range_low;
  const high       = lab.reference_range_high;
  const hasRange   = low !== undefined || high !== undefined;

  /**
   * Capture the rendered track width so we can position the dot and green zone.
   *
   * @param e - Layout change event.
   */
  const onTrackLayout = useCallback((e: LayoutChangeEvent): void => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  /**
   * Convert a data value to an x-offset (px) within the track.
   * Uses a fixed ±50 % padding beyond the reference range to define the scale.
   *
   * @param v      - The data value to map.
   * @param minVal - Scale minimum.
   * @param maxVal - Scale maximum.
   */
  const toX = (v: number, minVal: number, maxVal: number): number => {
    if (maxVal === minVal) return trackWidth / 2;
    return ((v - minVal) / (maxVal - minVal)) * trackWidth;
  };

  // Compute scale bounds — reference range ± 50 % padding
  let scaleMin = 0;
  let scaleMax = 0;
  if (hasNumeric && hasRange) {
    const rangeMin = low  ?? (lab.value! * 0.5);
    const rangeMax = high ?? (lab.value! * 1.5);
    const spread   = rangeMax - rangeMin;
    scaleMin = rangeMin - spread * 0.5;
    scaleMax = rangeMax + spread * 0.5;
  }

  const dotX       = (hasNumeric && hasRange && trackWidth > 0)
    ? Math.max(0, Math.min(trackWidth - 14, toX(lab.value!, scaleMin, scaleMax) - 7))
    : -1;
  const greenLeft  = (low  !== undefined && trackWidth > 0) ? toX(low,  scaleMin, scaleMax) : 0;
  const greenRight = (high !== undefined && trackWidth > 0) ? toX(high, scaleMin, scaleMax) : trackWidth;
  const greenWidth = Math.max(0, Math.min(trackWidth, greenRight) - Math.max(0, greenLeft));

  return (
    <View style={styles.chartRow}>
      {/* Test name */}
      <Text style={styles.chartTestName} numberOfLines={1}>{lab.test_name}</Text>

      {/* Track area */}
      <View style={styles.chartTrackContainer} onLayout={onTrackLayout}>
        {(hasNumeric && hasRange && trackWidth > 0) ? (
          <>
            {/* Grey background track */}
            <View style={styles.chartTrack} />
            {/* Green normal zone */}
            <View
              style={[
                styles.chartGreenZone,
                {
                  left:  Math.max(0, greenLeft),
                  width: greenWidth,
                },
              ]}
            />
            {/* Coloured value dot */}
            <View
              style={[
                styles.chartDot,
                {
                  left:            dotX,
                  backgroundColor: token.color,
                },
              ]}
            />
          </>
        ) : (
          <View style={styles.chartTrack} />
        )}
      </View>

      {/* Value text */}
      <Text style={[styles.chartValue, { color: token.color }]}>
        {formatValue(lab.value, lab.unit)}
      </Text>
    </View>
  );
}

/** Props for a filter pill. */
interface FilterPillProps {
  label: FilterOption;
  count: number;
  active: boolean;
  onPress: () => void;
}

/**
 * Summary filter pill showing the status label and count.
 * Active state uses the status colour as background/border.
 *
 * @param props.label   - The filter label.
 * @param props.count   - Number of matching results.
 * @param props.active  - Whether this pill is currently selected.
 * @param props.onPress - Tap handler.
 */
function FilterPill({ label, count, active, onPress }: FilterPillProps): React.ReactElement {
  const token = label === 'All'
    ? { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.4)' }
    : (STATUS_COLORS[label.toLowerCase()] ?? STATUS_COLORS.unknown);

  return (
    <TouchableOpacity
      style={[
        styles.filterPill,
        active
          ? { backgroundColor: token.bg, borderColor: token.border }
          : styles.filterPillInactive,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.filterPillCount, { color: active ? token.color : 'rgba(255,255,255,0.4)' }]}>
        {count}
      </Text>
      <Text style={[styles.filterPillLabel, { color: active ? token.color : 'rgba(255,255,255,0.4)' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

/**
 * Lab results screen — full redesign matching the web bloodwork page.
 *
 * Features:
 * - Shows SIMULATED_LABS when no real labs exist (isDemo = true)
 * - Summary filter pills: All / High / Normal / Low / Unknown
 * - Table / Chart view switcher
 * - Table view: section-grouped rows with status badges and reference ranges
 * - Chart view: horizontal bullet charts built purely with View/StyleSheet
 * - Scan and Import buttons in the header retain all existing logic
 */
export default function LabsScreen(): React.ReactElement {
  const [profileLabs, setProfileLabs] = useState<LabResult[]>([]);
  const [ratedMap, setRatedMap]       = useState<Map<string, RatedLabResult>>(new Map());
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [scanning, setScanning]       = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('All');
  const [viewMode, setViewMode]         = useState<ViewMode>('Table');

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  /**
   * Fetch the health profile and populate profileLabs.
   * Errors are non-fatal — the demo data will display instead.
   */
  const loadLabs = useCallback(async (): Promise<void> => {
    try {
      const profile = await fetchHealthProfile(DEMO_USER_ID);
      setProfileLabs(profile?.recent_labs ?? []);
    } catch {
      // Non-fatal: fall through to demo data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect((): void => { void loadLabs(); }, [loadLabs]);

  // ---------------------------------------------------------------------------
  // Import handlers — logic preserved exactly from original file
  // ---------------------------------------------------------------------------

  /** Camera scan → direct OCR → rated results. */
  const handleScanLabs = useCallback(async (): Promise<void> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access required', 'Please allow camera access to scan lab reports.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) return;

    setScanning(true);
    try {
      const scanResult = await uploadLabScan(
        DEMO_USER_ID,
        result.assets[0].uri,
        result.assets[0].mimeType ?? 'image/jpeg',
      );
      if (scanResult.rated_results && scanResult.rated_results.length > 0) {
        setRatedMap((prev) => {
          const next = new Map(prev);
          for (const r of scanResult.rated_results!) {
            next.set(r.test_name.toLowerCase(), r);
          }
          return next;
        });
      }
      Alert.alert('Labs imported', scanResult.import_summary);
      await loadLabs();
    } catch {
      Alert.alert('Scan failed', 'Could not extract lab results. Please ensure the image is clear and well-lit.');
    } finally {
      setScanning(false);
    }
  }, [loadLabs]);

  /**
   * Document picker → classify → if bloodwork, extract and rate.
   * Non-bloodwork documents are rejected gracefully.
   */
  const handleUploadDocument = useCallback(async (): Promise<void> => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      copyToCacheDirectory: true,
    });

    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setUploading(true);
    try {
      const analysis = await analyzeDocument(
        DEMO_USER_ID,
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
      );

      if (!analysis.is_bloodwork) {
        Alert.alert(
          'Not bloodwork',
          `This looks like a ${analysis.document_type} document. Please upload a blood test results report.`,
        );
        return;
      }

      if (analysis.rated_results && analysis.rated_results.length > 0) {
        setRatedMap((prev) => {
          const next = new Map(prev);
          for (const r of analysis.rated_results!) {
            next.set(r.test_name.toLowerCase(), r);
          }
          return next;
        });
      }

      Alert.alert(
        'Bloodwork imported',
        analysis.import_summary ?? `${analysis.total_count ?? 0} results imported.`,
      );
      await loadLabs();
    } catch (error) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }, [loadLabs]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const isDemo = profileLabs.length === 0;
  const labs   = isDemo ? SIMULATED_LABS : profileLabs;

  /** Count results per status bucket. */
  const counts: Record<FilterOption, number> = {
    All:     labs.length,
    High:    labs.filter((l) => resolveStatus(l, ratedMap) === 'high'    || resolveStatus(l, ratedMap) === 'critical').length,
    Normal:  labs.filter((l) => resolveStatus(l, ratedMap) === 'normal').length,
    Low:     labs.filter((l) => resolveStatus(l, ratedMap) === 'low').length,
    Unknown: labs.filter((l) => resolveStatus(l, ratedMap) === 'unknown').length,
  };

  /** Apply active filter. */
  const filteredLabs: LabResult[] = labs.filter((l) => {
    if (activeFilter === 'All') return true;
    const s = resolveStatus(l, ratedMap);
    if (activeFilter === 'High')    return s === 'high'    || s === 'critical';
    if (activeFilter === 'Low')     return s === 'low';
    if (activeFilter === 'Normal')  return s === 'normal';
    if (activeFilter === 'Unknown') return s === 'unknown';
    return true;
  });

  /**
   * Group filtered labs into sections, preserving canonical display order.
   * Returns an ordered array of [sectionLabel, labs[]] pairs.
   */
  const groupedSections = (): Array<[string, LabResult[]]> => {
    const map = new Map<string, LabResult[]>();
    for (const lab of filteredLabs) {
      const section = sectionForTest(lab.test_name);
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(lab);
    }
    // Sort by canonical order, then append any 'Other' section last
    const ordered: Array<[string, LabResult[]]> = [];
    for (const s of SECTION_ORDER) {
      if (map.has(s)) ordered.push([s, map.get(s)!]);
    }
    if (map.has('Other')) ordered.push(['Other', map.get('Other')!]);
    return ordered;
  };

  const busy = scanning || uploading;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Lab Results</Text>
            {isDemo && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Demo</Text>
              </View>
            )}
          </View>
          {isDemo && (
            <Text style={styles.headerSubtitle}>Simulated · 20-year-old male</Text>
          )}
        </View>

        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.importButton, busy && styles.buttonDisabled]}
            onPress={handleUploadDocument}
            disabled={busy}
          >
            {uploading
              ? <ActivityIndicator color="#38bdf8" size="small" />
              : <Text style={styles.importButtonText}>Import</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanButton, busy && styles.buttonDisabled]}
            onPress={handleScanLabs}
            disabled={busy}
          >
            {scanning
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={styles.scanButtonText}>Scan</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Personalised ratings banner (real data only) */}
      {ratedMap.size > 0 && !isDemo && (
        <View style={styles.personalisedBanner}>
          <Text style={styles.personalisedBannerText}>
            Ratings adjusted for your age, sex &amp; BMI
          </Text>
        </View>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Filter pills row + view-mode toggle                                 */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.controlsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          {FILTER_OPTIONS.map((opt) => (
            <FilterPill
              key={opt}
              label={opt}
              count={counts[opt]}
              active={activeFilter === opt}
              onPress={() => setActiveFilter(opt)}
            />
          ))}
        </ScrollView>

        {/* Table / Chart toggle */}
        <View style={styles.viewToggle}>
          {(['Table', 'Chart'] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleBtnActive]}
              onPress={() => setViewMode(mode)}
              activeOpacity={0.75}
            >
              <Text style={[styles.viewToggleBtnText, viewMode === mode && styles.viewToggleBtnTextActive]}>
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                         */}
      {/* ------------------------------------------------------------------ */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void loadLabs(); }}
            tintColor="#38bdf8"
          />
        }
      >
        {filteredLabs.length === 0 && labs.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No lab results yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Scan" to photograph a lab report, or "Import" to upload an image or PDF.
              Pulse will detect bloodwork automatically and rate each value against your
              personalised normal ranges.
            </Text>
          </View>
        )}

        {filteredLabs.length === 0 && labs.length > 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No results for this filter</Text>
          </View>
        )}

        {filteredLabs.length > 0 && viewMode === 'Table' && (
          <>
            {groupedSections().map(([section, sectionLabs]) => (
              <View key={section} style={styles.section}>
                {/* Section header */}
                <Text style={styles.sectionHeader}>{section}</Text>

                {/* Column headers */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Test</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Value</Text>
                  <Text style={[styles.tableHeaderCell, { width: 72 }]}>Status</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Range</Text>
                </View>

                {/* Rows */}
                <View style={styles.card}>
                  {sectionLabs.map((lab, idx) => (
                    <TableRow
                      key={lab.test_name}
                      lab={lab}
                      ratedMap={ratedMap}
                      isEven={idx % 2 === 0}
                    />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {filteredLabs.length > 0 && viewMode === 'Chart' && (
          <>
            {groupedSections().map(([section, sectionLabs]) => (
              <View key={section} style={styles.section}>
                <Text style={styles.sectionHeader}>{section}</Text>
                <View style={styles.card}>
                  {sectionLabs.map((lab) => (
                    <ChartRow
                      key={lab.test_name}
                      lab={lab}
                      ratedMap={ratedMap}
                    />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Screen
  container:       { flex: 1, backgroundColor: '#04090f' },
  loadingContainer:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#04090f' },

  // Header
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerLeft:      { flex: 1 },
  titleRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:           { fontSize: 24, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  headerSubtitle:  { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  headerButtons:   { flexDirection: 'row', gap: 8, marginLeft: 12 },

  demoBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)' },
  demoBadgeText:   { fontSize: 11, fontWeight: '600', color: '#38bdf8' },

  importButton:    { borderWidth: 1, borderColor: 'rgba(56,189,248,0.5)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  importButtonText:{ fontSize: 14, fontWeight: '600', color: '#38bdf8' },
  scanButton:      { backgroundColor: '#0EA5E9', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  scanButtonText:  { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  buttonDisabled:  { opacity: 0.45 },

  // Personalised banner
  personalisedBanner:     { marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(14,165,233,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)' },
  personalisedBannerText: { fontSize: 12, color: '#0EA5E9', textAlign: 'center' },

  // Controls row (filter pills + view toggle)
  controlsRow:           { flexDirection: 'row', alignItems: 'center', paddingRight: 16, marginBottom: 8 },
  filterPillsContainer:  { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  filterPill:            { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterPillInactive:    { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
  filterPillCount:       { fontSize: 13, fontWeight: '700' },
  filterPillLabel:       { fontSize: 12, fontWeight: '500' },

  viewToggle:            { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, marginLeft: 8 },
  viewToggleBtn:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  viewToggleBtnActive:   { backgroundColor: 'rgba(56,189,248,0.18)' },
  viewToggleBtnText:     { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  viewToggleBtnTextActive:{ color: '#38bdf8' },

  // Scroll content
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  // Section
  section:       { marginBottom: 24 },
  sectionHeader: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 2 },

  // Card wrapper
  card:    { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' },

  // Table
  tableHeaderRow:  { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 6, marginBottom: 0 },
  tableHeaderCell: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 6 },
  tableRowEven:    { backgroundColor: 'rgba(255,255,255,0.025)' },
  tableTestName:   { flex: 2, fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.85)' },
  tableValue:      { flex: 1.5, fontSize: 13, fontWeight: '600' },
  tableRange:      { flex: 1.5, fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right' },

  // Status badge
  statusBadge:     { width: 72, alignItems: 'center', paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6, borderWidth: 1 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },

  // Chart
  chartRow:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  chartTestName:       { width: 110, fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  chartTrackContainer: { flex: 1, height: 14, justifyContent: 'center', position: 'relative' },
  chartTrack:          { position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  chartGreenZone:      { position: 'absolute', height: 8, borderRadius: 4, backgroundColor: 'rgba(48,209,88,0.25)', top: 3 },
  chartDot:            { position: 'absolute', width: 14, height: 14, borderRadius: 7, top: 0 },
  chartValue:          { width: 72, fontSize: 12, fontWeight: '600', textAlign: 'right' },

  // Empty state
  emptyState:    { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 10 },
  emptySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 21 },
});
