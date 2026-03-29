/**
 * Chat message bubble with optional citation cards below assistant responses.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChatMessage, Citation } from '../lib/types';

interface ChatBubbleProps {
  /** The chat message to render. */
  message: ChatMessage;
  /** Called when a citation card is tapped. */
  onCitationPress: (citation: Citation) => void;
}

/**
 * Renders a single chat message bubble.
 *
 * User messages appear on the right in sky blue.
 * Assistant messages appear on the left in white with a subtle shadow.
 * Citations render as tappable cards below assistant messages.
 */
export function ChatBubble({ message, onCitationPress }: ChatBubbleProps): React.ReactElement {
  const isAssistant = message.role === 'assistant';

  return (
    <View style={[styles.container, isAssistant ? styles.assistantContainer : styles.userContainer]}>
      <View style={[styles.bubble, isAssistant ? styles.assistantBubble : styles.userBubble]}>
        <Text style={[styles.content, isAssistant ? styles.assistantText : styles.userText]}>
          {message.content}
        </Text>
      </View>

      {isAssistant && message.citations && message.citations.length > 0 && (
        <View style={styles.citationsContainer}>
          <Text style={styles.citationsLabel}>Sources</Text>
          {message.citations.map((citation) => (
            <TouchableOpacity
              key={citation.pmid}
              style={styles.citationCard}
              onPress={() => onCitationPress(citation)}
              activeOpacity={0.75}
            >
              <Text style={styles.citationPmid}>
                {citation.source === 'google_scholar' ? `Scholar ${citation.pmid}` : `PMID ${citation.pmid}`}
              </Text>
              <Text style={styles.citationTitle} numberOfLines={2}>
                {citation.title}
              </Text>
              <Text style={styles.citationMeta}>
                {citation.journal} · {citation.year}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    maxWidth: '85%',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
    marginLeft: 16,
  },
  userContainer: {
    alignSelf: 'flex-end',
    marginRight: 16,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#0EA5E9',
    borderBottomRightRadius: 4,
  },
  content: {
    fontSize: 16,
    lineHeight: 23,
  },
  assistantText: {
    color: '#111827',
  },
  userText: {
    color: '#FFFFFF',
  },
  citationsContainer: {
    marginTop: 8,
    marginLeft: 4,
  },
  citationsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  citationCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
  },
  citationPmid: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0EA5E9',
    marginBottom: 2,
  },
  citationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 18,
    marginBottom: 2,
  },
  citationMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
});
