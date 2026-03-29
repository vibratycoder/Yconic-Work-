/**
 * Chat screen — primary Sona Health conversation UI.
 *
 * Matches the web ChatInterface dark design system exactly:
 * - Background: #04090f
 * - Header: rgba(4,9,15,0.95) with sky-blue bottom border
 * - Input area: rgba(4,9,15,0.95) with subtle top border
 * - Sky-blue (#38bdf8) accent throughout
 *
 * Features:
 * - Dark theme matching the web design system
 * - Image attachment via expo-image-picker (photo library or camera)
 * - Attachment thumbnail strip above input bar (max 3 images)
 * - Animated loading dots while awaiting assistant response
 * - Health memory pill indicator in header
 * - Empty state with logo approximation and welcome copy
 * - Citation bottom sheet and emergency triage alert preserved
 * - Conversation ID tracking for multi-turn context
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  ActionSheetIOS,
  Alert,
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
  ScrollView,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ChatBubble } from '../../components/ChatBubble';
import { CitationSheet } from '../../components/CitationSheet';
import { TriageAlert } from '../../components/TriageAlert';
import { ChatMessage, Citation } from '../../lib/types';
import { sendChatMessage } from '../../lib/api';

const DEMO_USER_ID = '274f67e3-77d8-46a4-8ddc-a1978131ca56';

/** Maximum number of image attachments allowed per message. */
const MAX_ATTACHMENTS = 3;

/**
 * A locally-selected image attachment pending send.
 *
 * @property uri      - Local file URI returned by expo-image-picker.
 * @property mimeType - MIME type of the image (e.g. "image/jpeg").
 * @property name     - Derived filename used for display and API context.
 */
interface Attachment {
  uri: string;
  mimeType: string;
  name: string;
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const COLORS = {
  background: '#04090f',
  headerBg: 'rgba(4,9,15,0.95)',
  headerBorder: 'rgba(56,189,248,0.15)',
  inputAreaBg: 'rgba(4,9,15,0.95)',
  inputAreaBorder: 'rgba(255,255,255,0.08)',
  inputBg: 'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.1)',
  inputText: 'rgba(255,255,255,0.85)',
  inputPlaceholder: 'rgba(255,255,255,0.3)',
  sendActive: '#0EA5E9',
  sendDisabled: 'rgba(14,165,233,0.3)',
  primary: '#38bdf8',
  logoBg: '#0369a1',
  memoryText: 'rgba(56,189,248,0.7)',
  memoryBg: 'rgba(56,189,248,0.1)',
  memoryBorder: 'rgba(56,189,248,0.2)',
  white: '#FFFFFF',
  subtitleText: 'rgba(255,255,255,0.4)',
  clearRed: 'rgba(239,68,68,0.8)',
  attachBtnBg: 'rgba(56,189,248,0.08)',
  attachBtnBorder: 'rgba(56,189,248,0.18)',
  removeThumbBg: 'rgba(239,68,68,0.85)',
  userBubbleBg: 'rgba(3,105,161,0.18)',
  userBubbleBorder: 'rgba(56,189,248,0.15)',
  assistantBubbleBg: 'rgba(3,105,161,0.28)',
  assistantBubbleBorder: 'rgba(56,189,248,0.18)',
  loadingDot: '#38bdf8',
} as const;

// ─── Loading dots component ───────────────────────────────────────────────────

/**
 * Animated "..." indicator shown in an assistant bubble while the API is working.
 * Uses italic styling for a conversational feel.
 */
function LoadingDots(): React.ReactElement {
  return (
    <View style={styles.loadingBubble}>
      <Text style={styles.loadingDotsText}>...</Text>
    </View>
  );
}

// ─── Empty state component ────────────────────────────────────────────────────

/**
 * Centered empty state shown when no messages exist.
 * Approximates the pulse waveform logo with a styled text glyph.
 */
function EmptyState(): React.ReactElement {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyLogo}>
        <Text style={styles.emptyLogoGlyph}>〜</Text>
      </View>
      <Text style={styles.emptyTitle}>Ask Sona Health</Text>
      <Text style={styles.emptySubtitle}>
        Answers grounded in peer-reviewed research, personalised to your health profile.
      </Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

/**
 * Primary chat screen for health questions.
 *
 * Renders a dark-themed conversation UI that mirrors the Pulse web app.
 * All existing functionality is preserved: handleClearChat, handleSend,
 * scrollToEnd, CitationSheet, TriageAlert, and conversationId tracking.
 *
 * New in this revision:
 * - Image attachment support via expo-image-picker ActionSheet
 * - Thumbnail preview strip above the input bar
 * - Animated loading dots in an assistant bubble while awaiting response
 * - Redesigned header with logo, title, and memory pill
 * - Dark design system matching web ChatInterface
 */
export default function ChatScreen(): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [emergencyMessage, setEmergencyMessage] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // ── Scroll ──────────────────────────────────────────────────────────────────

  /** Scroll the message list to the bottom, deferred by one frame. */
  const scrollToEnd = useCallback((): void => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // ── Clear chat ──────────────────────────────────────────────────────────────

  /**
   * Prompt the user to confirm, then wipe message history and reset the
   * conversation ID so the next message begins a fresh session.
   */
  const handleClearChat = useCallback((): void => {
    if (messages.length === 0) return;
    Alert.alert(
      'Clear chat',
      'Remove all messages from this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: (): void => {
            setMessages([]);
            setConversationId(undefined);
          },
        },
      ],
    );
  }, [messages.length]);

  // ── Image picker ────────────────────────────────────────────────────────────

  /**
   * Request media library permissions, then launch the photo picker.
   * Appends the chosen image to `attachments` (up to MAX_ATTACHMENTS).
   */
  const pickFromLibrary = useCallback(async (): Promise<void> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    if (!asset) return;
    const uri = asset.uri;
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const filename = uri.split('/').pop() ?? `image_${Date.now()}.jpg`;
    setAttachments((prev) => {
      if (prev.length >= MAX_ATTACHMENTS) return prev;
      return [...prev, { uri, mimeType, name: filename }];
    });
  }, []);

  /**
   * Request camera permissions, then capture a photo.
   * Appends the captured image to `attachments` (up to MAX_ATTACHMENTS).
   */
  const takePhoto = useCallback(async (): Promise<void> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    if (!asset) return;
    const uri = asset.uri;
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const filename = `photo_${Date.now()}.jpg`;
    setAttachments((prev) => {
      if (prev.length >= MAX_ATTACHMENTS) return prev;
      return [...prev, { uri, mimeType, name: filename }];
    });
  }, []);

  /**
   * Show an ActionSheet (iOS native / Alert on Android) allowing the user to
   * choose between the photo library, camera, or cancelling.
   */
  const handleAttachPress = useCallback((): void => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Attachment limit', `You can attach up to ${MAX_ATTACHMENTS} images per message.`);
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Photo Library', 'Take Photo', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (buttonIndex): void => {
          if (buttonIndex === 0) void pickFromLibrary();
          else if (buttonIndex === 1) void takePhoto();
        },
      );
    } else {
      // Android fallback — use an Alert with buttons
      Alert.alert(
        'Add image',
        'Choose a source',
        [
          { text: 'Photo Library', onPress: (): void => { void pickFromLibrary(); } },
          { text: 'Take Photo', onPress: (): void => { void takePhoto(); } },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  }, [attachments.length, pickFromLibrary, takePhoto]);

  /**
   * Remove a single attachment thumbnail by its URI.
   *
   * @param uri - The local file URI to remove from the pending attachments list.
   */
  const removeAttachment = useCallback((uri: string): void => {
    setAttachments((prev) => prev.filter((a) => a.uri !== uri));
  }, []);

  // ── Send ────────────────────────────────────────────────────────────────────

  /**
   * Build the user message (optionally appending attachment context lines),
   * optimistically add it to the list, call the API, then append the
   * assistant reply. Clears attachments after dispatch.
   *
   * Attachment filenames are injected as "[Attached image: filename]" context
   * lines appended to the question text, since the mobile API endpoint does
   * not yet accept multipart payloads.
   */
  const handleSend = useCallback(async (): Promise<void> => {
    const text = inputText.trim();
    const hasAttachments = attachments.length > 0;
    if ((!text && !hasAttachments) || loading) return;

    // Build the question string — append image context lines for the backend
    const attachmentContext = attachments
      .map((a) => `[Attached image: ${a.name}]`)
      .join('\n');
    const question = [text, attachmentContext].filter(Boolean).join('\n');

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text || `[${attachments.length} image${attachments.length > 1 ? 's' : ''} attached]`,
      created_at: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setAttachments([]);
    setLoading(true);
    scrollToEnd();

    try {
      const response = await sendChatMessage(DEMO_USER_ID, question, conversationId);

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
    } catch (error: unknown) {
      const errorText =
        error instanceof Error
          ? error.message
          : 'Unable to reach Sona Health right now. Please try again.';
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorText,
        created_at: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      scrollToEnd();
    } finally {
      setLoading(false);
    }
  }, [inputText, attachments, loading, conversationId, scrollToEnd]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const canSend = (inputText.trim().length > 0 || attachments.length > 0) && !loading;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* App logo — 32×32 rounded square with sky-blue background */}
          <View style={styles.headerLogo}>
            <Text style={styles.headerLogoGlyph}>〜</Text>
          </View>
          <Text style={styles.headerTitle}>Sona Health</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Health memory pill */}
          <View style={styles.memoryPill}>
            <Text style={styles.memoryPillText}>Health memory active</Text>
          </View>
          {/* Clear button — only shown when there are messages */}
          {messages.length > 0 && (
            <TouchableOpacity
              onPress={handleClearChat}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Message list + input ────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Message list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item): string => item.id}
          renderItem={({ item }): React.ReactElement => (
            <ChatBubble message={item} onCitationPress={setSelectedCitation} />
          )}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={<EmptyState />}
          ListFooterComponent={loading ? <LoadingDots /> : null}
          onContentSizeChange={scrollToEnd}
        />

        {/* ── Input area ───────────────────────────────────────────────────── */}
        <View style={styles.inputArea}>

          {/* Attachment thumbnail strip */}
          {attachments.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbnailStrip}
              contentContainerStyle={styles.thumbnailStripContent}
            >
              {attachments.map((attachment): React.ReactElement => (
                <View key={attachment.uri} style={styles.thumbnailWrapper}>
                  <Image
                    source={{ uri: attachment.uri }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                  {/* Remove button */}
                  <TouchableOpacity
                    style={styles.thumbnailRemove}
                    onPress={(): void => removeAttachment(attachment.uri)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons name="close" size={10} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Input row: attach button | text field | send button */}
          <View style={styles.inputRow}>
            {/* Attachment button */}
            <TouchableOpacity
              style={styles.attachButton}
              onPress={handleAttachPress}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityLabel="Attach image"
            >
              <Ionicons
                name="attach-outline"
                size={22}
                color={COLORS.primary}
              />
            </TouchableOpacity>

            {/* Text input */}
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about your labs, symptoms, or medications…"
              placeholderTextColor={COLORS.inputPlaceholder}
              multiline
              maxLength={1000}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={(): void => { void handleSend(); }}
            />

            {/* Send button */}
            <TouchableOpacity
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              onPress={(): void => { void handleSend(); }}
              disabled={!canSend}
              accessibilityLabel="Send message"
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={canSend ? COLORS.white : 'rgba(255,255,255,0.5)'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}
      <CitationSheet citation={selectedCitation} onClose={(): void => setSelectedCitation(null)} />

      <TriageAlert
        visible={emergencyMessage !== null}
        message={emergencyMessage ?? ''}
        onConfirm={(): void => setEmergencyMessage(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Screen ──────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.headerBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  /** 32×32 rounded square logo approximating the pulse waveform. */
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.logoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoGlyph: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  /** Small pill badge indicating active health memory. */
  memoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: COLORS.memoryBg,
    borderWidth: 1,
    borderColor: COLORS.memoryBorder,
  },
  memoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.memoryText,
  },
  clearButton: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.clearRed,
  },

  // ── Keyboard-avoiding wrapper ────────────────────────────────────────────────
  keyboardView: {
    flex: 1,
  },

  // ── Message list ─────────────────────────────────────────────────────────────
  messageList: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    paddingBottom: 8,
    flexGrow: 1,
  },

  // ── Empty state ──────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  /** 9×9 (scaled to 72×72) rounded square with gradient approximated by solid bg. */
  emptyLogo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: COLORS.logoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  emptyLogoGlyph: {
    fontSize: 36,
    color: COLORS.white,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.subtitleText,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },

  // ── Loading dots bubble ──────────────────────────────────────────────────────
  loadingBubble: {
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    backgroundColor: COLORS.assistantBubbleBg,
    borderWidth: 1,
    borderColor: COLORS.assistantBubbleBorder,
  },
  loadingDotsText: {
    fontSize: 20,
    fontStyle: 'italic',
    color: COLORS.loadingDot,
    letterSpacing: 4,
  },

  // ── Input area ───────────────────────────────────────────────────────────────
  inputArea: {
    backgroundColor: COLORS.inputAreaBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.inputAreaBorder,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },

  // ── Attachment thumbnail strip ───────────────────────────────────────────────
  thumbnailStrip: {
    marginBottom: 10,
  },
  thumbnailStripContent: {
    gap: 8,
    paddingRight: 4,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 56,
    height: 56,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  /** Circular ✕ button overlaid on the top-right corner of each thumbnail. */
  thumbnailRemove: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.removeThumbBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Input row ────────────────────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  /** Paperclip attachment trigger button. */
  attachButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.attachBtnBg,
    borderWidth: 1,
    borderColor: COLORS.attachBtnBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 1,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.inputText,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.sendActive,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 1,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.sendDisabled,
  },
});
