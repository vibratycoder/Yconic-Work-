/**
 * Labs screen — displays all lab results with scan and document upload functionality.
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LabCard } from '../../components/LabCard';
import { LabResult, RatedLabResult } from '../../lib/types';
import { fetchHealthProfile, uploadLabScan, analyzeDocument } from '../../lib/api';

const DEMO_USER_ID = '274f67e3-77d8-46a4-8ddc-a1978131ca56';

/** Rating colours for the personalised badge. */
const RATING_COLORS: Record<string, string> = {
  High:    '#ff9f0a',
  Low:     '#0a84ff',
  Normal:  '#30d158',
  Unknown: '#8e8e93',
};

/**
 * Inline badge showing the personalised rating for a lab result.
 */
function RatingBadge({ rating }: { rating: string }): React.ReactElement {
  return (
    <View style={[styles.ratingBadge, { borderColor: RATING_COLORS[rating] ?? '#8e8e93' }]}>
      <Text style={[styles.ratingBadgeText, { color: RATING_COLORS[rating] ?? '#8e8e93' }]}>
        {rating}
      </Text>
    </View>
  );
}

/**
 * Lab results screen with camera scan and document upload capability.
 *
 * Displays all lab results grouped by personalised rating (High/Low first,
 * then Normal).  Document uploads are automatically classified — non-bloodwork
 * files are rejected with an informative alert.
 */
export default function LabsScreen(): React.ReactElement {
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [ratedMap, setRatedMap] = useState<Map<string, RatedLabResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadLabs = useCallback(async (): Promise<void> => {
    try {
      const profile = await fetchHealthProfile(DEMO_USER_ID);
      setLabs(profile?.recent_labs ?? []);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadLabs(); }, [loadLabs]);

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

  /** Group labs by personalised rating, falling back to original status. */
  const getRating = (lab: LabResult): string => {
    const r = ratedMap.get(lab.test_name.toLowerCase());
    if (r) return r.rating;
    if (lab.status === 'critical' || lab.status === 'high') return 'High';
    if (lab.status === 'low') return 'Low';
    if (lab.status === 'normal') return 'Normal';
    return 'Unknown';
  };

  const needsAttention = labs.filter((l) => ['High', 'Low'].includes(getRating(l)));
  const normal = labs.filter((l) => getRating(l) === 'Normal');
  const unknown = labs.filter((l) => getRating(l) === 'Unknown');

  const busy = scanning || uploading;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lab Results</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.uploadButton, busy && styles.buttonDisabled]}
            onPress={handleUploadDocument}
            disabled={busy}
          >
            {uploading
              ? <ActivityIndicator color="#0EA5E9" size="small" />
              : <Text style={styles.uploadButtonText}>Import</Text>
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

      {ratedMap.size > 0 && (
        <View style={styles.personalisedBanner}>
          <Text style={styles.personalisedBannerText}>
            Ratings adjusted for your age, sex &amp; BMI
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadLabs(); }} />}
      >
        {needsAttention.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Needs Attention ({needsAttention.length})</Text>
            {needsAttention.map((lab, i) => {
              const rated = ratedMap.get(lab.test_name.toLowerCase());
              return (
                <View key={lab.test_name + i}>
                  <LabCard lab={lab} />
                  {rated && <RatingBadge rating={rated.rating} />}
                </View>
              );
            })}
          </View>
        )}

        {normal.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Normal ({normal.length})</Text>
            {normal.map((lab, i) => (
              <LabCard key={lab.test_name + i} lab={lab} />
            ))}
          </View>
        )}

        {unknown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Unknown ({unknown.length})</Text>
            {unknown.map((lab, i) => (
              <LabCard key={lab.test_name + i} lab={lab} />
            ))}
          </View>
        )}

        {labs.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No lab results yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Scan" to photograph a lab report, or "Import" to upload an image or PDF.
              Pulse will detect bloodwork automatically and rate each value against your
              personalised normal ranges.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  headerButtons: { flexDirection: 'row', gap: 8 },
  uploadButton: { borderWidth: 1, borderColor: '#0EA5E9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  scanButton: { backgroundColor: '#0EA5E9', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  buttonDisabled: { opacity: 0.5 },
  scanButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  uploadButtonText: { fontSize: 14, fontWeight: '600', color: '#0EA5E9' },
  personalisedBanner: { marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(14,165,233,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)' },
  personalisedBannerText: { fontSize: 12, color: '#0EA5E9', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 12 },
  ratingBadge: { alignSelf: 'flex-start', marginTop: -8, marginBottom: 8, marginLeft: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  ratingBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151', marginBottom: 12 },
  emptySubtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
});
