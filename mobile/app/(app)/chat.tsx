/**
 * Chat screen — primary Pulse health conversation UI.
 * Shows health memory indicator, renders ChatBubbles with CitationSheets,
 * and displays TriageAlert for emergency responses.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ChatBubble } from '../../components/ChatBubble';
import { CitationSheet } from '../../components/CitationSheet';
import { TriageAlert } from '../../components/TriageAlert';
import { ChatMessage, Citation } from '../../lib/types';
import { sendChatMessage } from '../../lib/api';

const DEMO_USER_ID = '274f67e3-77d8-46a4-8ddc-a1978131ca56';

/**
 * Primary chat screen for health questions.
 *
 * Features:
 * - Health memory indicator in header showing Pulse knows your context
 * - Streamed message rendering via FlatList with auto-scroll
 * - Citation cards tappable to open CitationSheet bottom sheet
 * - Emergency TriageAlert shown full-screen for emergency responses
 * - KeyboardAvoidingView for iOS keyboard handling
 */
export default function ChatScreen(): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [emergencyMessage, setEmergencyMessage] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = useCallback((): void => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleSend = useCallback(async (): Promise<void> => {
    const text = inputText.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      created_at: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);
    scrollToEnd();

    try {
      const response = await sendChatMessage(DEMO_USER_ID, text, conversationId);

      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      if (response.triage_level === 'emergency') {
        setEmergencyMessage(response.answer);
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        triage_level: response.triage_level,
        created_at: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      scrollToEnd();
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Unable to reach Pulse right now. Please try again.',
        created_at: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, conversationId, scrollToEnd]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ask Pulse</Text>
        <Text style={styles.memoryIndicator}>Pulse knows your health history</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble message={item} onCitationPress={setSelectedCitation} />
          )}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Ask anything about your health</Text>
              <Text style={styles.emptySubtitle}>
                Pulse uses your health profile and peer-reviewed research to give you personalized answers.
              </Text>
            </View>
          }
          onContentSizeChange={scrollToEnd}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about your labs, symptoms, or medications..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <CitationSheet citation={selectedCitation} onClose={() => setSelectedCitation(null)} />

      <TriageAlert
        visible={emergencyMessage !== null}
        message={emergencyMessage ?? ''}
        onConfirm={() => setEmergencyMessage(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  memoryIndicator: { fontSize: 12, color: '#0EA5E9', fontWeight: '500', marginTop: 2 },
  keyboardView: { flex: 1 },
  messageList: { paddingVertical: 16, paddingBottom: 8 },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151', textAlign: 'center', marginBottom: 12 },
  emptySubtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FFFFFF', gap: 10,
  },
  input: {
    flex: 1, backgroundColor: '#F9FAFB', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#111827', maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#0EA5E9', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#BAE6FD' },
  sendButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
