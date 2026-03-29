/**
 * Bottom sheet displaying a full PubMed citation with abstract.
 * Opens when the user taps a citation card in the chat.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { Citation } from '../lib/types';

interface CitationSheetProps {
  /** Citation to display. Null means the sheet is closed. */
  citation: Citation | null;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
}

/**
 * Modal bottom sheet showing full PubMed citation details.
 *
 * Displays title, journal, year, authors, and the full abstract.
 * Provides a direct link to the PubMed record for verification.
 */
export function CitationSheet({ citation, onClose }: CitationSheetProps): React.ReactElement | null {
  if (!citation) return null;

  const handleOpenSource = (): void => {
    Linking.openURL(citation.pubmed_url);
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.pmidLabel}>
            {citation.source === 'google_scholar' ? `Scholar ID: ${citation.pmid}` : `PMID: ${citation.pmid}`}
          </Text>
          <Text style={styles.title}>{citation.title}</Text>
          <Text style={styles.journal}>
            {citation.journal} · {citation.year}
          </Text>
          <Text style={styles.abstractLabel}>Abstract</Text>
          <Text style={styles.abstractText}>{citation.display_summary}</Text>
          <TouchableOpacity style={styles.pubmedButton} onPress={handleOpenSource}>
            <Text style={styles.pubmedButtonText}>
              {citation.source === 'google_scholar' ? 'View on Google Scholar' : 'View on PubMed'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  pmidLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 24,
    marginBottom: 8,
  },
  journal: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '500',
    marginBottom: 20,
  },
  abstractLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  abstractText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 23,
    marginBottom: 24,
  },
  pubmedButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  pubmedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
