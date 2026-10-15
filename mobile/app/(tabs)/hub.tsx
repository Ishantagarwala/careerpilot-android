import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  AccessibilityInfo,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Menu,
  Paperclip,
  ArrowUp,
  ArrowRight,
  X,
  FileText,
  AlertCircle,
  RotateCcw,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader } from '../../src/components/navigation/AppHeader';
import { ThreadsDrawer } from '../../src/components/navigation/ThreadsDrawer';
import { NoticeBanner } from '../../src/components/product/ProductKit';
import {
  ChartCard,
  DiagramCard,
  GeneratedFileCard,
} from '../../src/components/product/BlockRenderers';
import { elevation, radii, spacing, targetSizes, typography } from '../../src/theme/tokens';
import {
  ThreadMessage,
  SelectedDocContext,
  ReplyBlock,
  InlineRun,
  fetchThread,
  fetchThreads,
  sendChatMessage,
  getStoredSelectedDocs,
  setStoredSelectedDocs,
  parseReplyBlocks,
  parseInline,
  getCachedThread,
  setCachedThread,
} from '../../src/api/study';
import { useAuth } from '../../src/context/AuthContext';

/*
 * AI Hub — design/png/02-hub-chat.png, Language B (android-shared.css .hub).
 *
 * The structural contract, from android-shared.css :243-346:
 *
 *   app bar     hamburger · 19px thread title · 12px subject subtitle ·
 *               model pill (34px, radius 17, mono 11.5/600, 7px green live dot)
 *   user turn   .bubble-user  #050505 fill, radius 20/20/6/20, max-width 84%,
 *                             padding 13/16, 15/1.5 — right-aligned
 *   reply       .reply  identity row (20x3 LIME rule + mono 11/600 uppercase
 *                       "CareerPilot"), then flowing prose
 *   blocks      .reply h3 17 Anybody · .reply li with a 6px LIME dot ·
 *               .codeblock #15171b radius 12 mono 12.5/1.75
 *   grounding   .sourcecard 1.5px hairline, radius 12, #fbfbfc, PDF mark
 *   thinking    .thinking three 6px muted dots + mono 11 label. Quiet.
 *   composer    .composer .shell radius 22, 1.5px hairline, two soft shadows;
 *               a control row of .chipbtn (40px, radius 20, mono 11.5/600)
 *               labels and a 44px --hub-strong circle send
 *
 * Before this pass every turn — user and assistant alike — was the same
 * bordered card with a "YOU"/"AI TUTOR" label, the reply had no headings, no
 * lime bullets and no grounding card, the attach control was an unlabelled
 * paperclip, and the send button was 38dp.
 */

const PROMPT_SUGGESTIONS = [
  'Explain database normalization with a simple example.',
  'What are the core differences between SQL and NoSQL?',
  'Help me prepare for a frontend engineering interview.',
];

const generateLocalMessageId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

/* --------------------------------------------------------------- thinking -- */

/**
 * The streaming indicator: three muted dots at .4/.7/1 opacity plus a mono
 * label (css:341-346). DESIGN_SPEC.md §6 requires the quiet fallback — under
 * reduced motion it is a static label, never a pulse.
 */
const ThinkingIndicator: React.FC<{ label: string }> = ({ label }) => {
  const { hub } = useTheme();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => mounted && setReduced(!!on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on: boolean) =>
      setReduced(!!on)
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return (
    <View style={styles.thinking} accessibilityLabel={label} accessibilityRole="text">
      <View style={styles.thinkingDots}>
        {[0.4, 0.7, 1].map((o, i) => (
          <View key={i} style={[styles.thinkingDot, { backgroundColor: hub.muted, opacity: reduced ? 0.7 : o }]} />
        ))}
      </View>
      <Text style={[styles.thinkingLabel, { color: hub.muted }]}>{label}</Text>
    </View>
  );
};

/* ------------------------------------------------------------- reply blocks -- */

/**
 * One inline run: bold, italic or inline code. Nested <Text> is how React
 * Native composes a styled span inside a paragraph.
 */
const Inline: React.FC<{ run: InlineRun; color: string; codeBg: string }> = ({
  run,
  color,
  codeBg,
}) => {
  if (run.code) {
    return (
      <Text
        style={[
          styles.inlineCode,
          { color, backgroundColor: codeBg, fontFamily: typography.fontMonoBold },
        ]}
      >
        {run.text}
      </Text>
    );
  }
  return (
    <Text
      style={[
        run.bold && styles.inlineBold,
        run.italic && styles.inlineItalic,
        { color },
      ]}
    >
      {run.text}
    </Text>
  );
};

const InlineRuns: React.FC<{ text: string; color: string; codeBg: string }> = ({
  text,
  color,
  codeBg,
}) => (
  <>
    {parseInline(text).map((run, i) => (
      <Inline key={i} run={run} color={color} codeBg={codeBg} />
    ))}
  </>
);

const ReplyBlocks: React.FC<{ blocks: ReplyBlock[] }> = ({ blocks }) => {
  const { hub } = useTheme();

  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <Text key={index} style={[styles.replyHeading, { color: hub.text }]}>
              <InlineRuns text={block.text} color={hub.text} codeBg={hub.soft} />
            </Text>
          );
        }
        if (block.kind === 'bullets') {
          return (
            <View key={index} style={styles.replyList}>
              {block.items.map((item, i) => (
                <View key={i} style={styles.replyListItem}>
                  {/* css:311-312 — a 6px lime dot, the identity mark of a reply */}
                  <View style={[styles.replyBullet, { backgroundColor: hub.primary }]} />
                  <Text style={[styles.replyBulletText, { color: hub.text }]}>
                    <InlineRuns text={item} color={hub.text} codeBg={hub.soft} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        if (block.kind === 'code') {
          return (
            <View key={index} style={styles.codeBlock}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text selectable style={styles.codeBlockText}>
                  {block.text}
                </Text>
              </ScrollView>
            </View>
          );
        }
        /*
         * The three structured blocks from the AI Hub system prompt. Without
         * these, a requested document printed raw JSON into the bubble and a
         * chart printed its payload — see docs/ai-hub-audit.md.
         */
        if (block.kind === 'file') {
          return <GeneratedFileCard key={index} spec={block.spec} raw={block.raw} />;
        }
        if (block.kind === 'chart') {
          // spec is null when the model emitted malformed JSON; fall back to
          // showing the payload rather than rendering an empty box.
          return block.spec ? (
            <ChartCard key={index} spec={block.spec} />
          ) : (
            <View key={index} style={styles.codeBlock}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text selectable style={styles.codeBlockText}>
                  {block.raw}
                </Text>
              </ScrollView>
            </View>
          );
        }
        if (block.kind === 'mermaid') {
          return <DiagramCard key={index} source={block.text} />;
        }
        return (
          <Text key={index} selectable style={[styles.replyParagraph, { color: hub.text }]}>
            <InlineRuns text={block.text} color={hub.text} codeBg={hub.soft} />
          </Text>
        );
      })}
    </>
  );
};

/* --------------------------------------------------------------- the screen -- */

export default function HubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    threadId?: string;
    newChat?: string;
    docId?: string;
    docName?: string;
    /** Dictated on another screen (e.g. Career) and handed over to compose here. */
    voicePrompt?: string;
  }>();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadTitle, setThreadTitle] = useState<string | null>(null);
  const [threadSubject, setThreadSubject] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  /** Tracks the last dictation handed over, so it is applied exactly once. */
  const appliedVoicePromptRef = React.useRef<string | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<SelectedDocContext[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  /**
   * True when the thread shown came from the device rather than the server,
   * because the request failed (design/png/10-dark-offline.png). It drives the
   * amber banner, the "Cached" bar tag and the disabled composer.
   */
  const [isOffline, setIsOffline] = useState(false);
  /** The threads drawer (design/png/03-hub-threads.png). */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const loadContextDocs = useCallback(async () => {
    let docs = await getStoredSelectedDocs();
    if (params.docId && params.docName) {
      const exists = docs.some((d) => d.id === params.docId);
      if (!exists) {
        if (docs.length >= 3) {
          docs = [...docs.slice(1), { id: params.docId, filename: params.docName }];
        } else {
          docs = [...docs, { id: params.docId, filename: params.docName }];
        }
        await setStoredSelectedDocs(docs);
      }
    }
    setSelectedDocs(docs.slice(0, 3));
  }, [params.docId, params.docName]);

  /*
   * A prompt dictated on another screen arrives as a query param. It is placed
   * in the composer rather than sent immediately: it can then be corrected
   * before it costs a request, and there is no race with the thread-loading
   * effect above. The ref guard means a re-render (or a hot reload) cannot
   * apply the same dictation twice.
   */
  useEffect(() => {
    const dictated = params.voicePrompt?.trim();
    if (!dictated) return;
    if (appliedVoicePromptRef.current === dictated) return;
    appliedVoicePromptRef.current = dictated;
    setInputMessage(dictated);
  }, [params.voicePrompt]);

  const loadThread = useCallback(
    async (targetThreadId?: string) => {
      if (params.newChat === 'true' || params.newChat === '1') {
        setActiveThreadId(null);
        setThreadTitle(null);
        setThreadSubject(null);
        setMessages([]);
        setError(null);
        setIsOffline(false);
        return;
      }

      setIsLoadingThread(true);
      setError(null);

      const userId = user?.id;

      try {
        let idToLoad = targetThreadId || params.threadId;

        if (!idToLoad) {
          const threads = await fetchThreads();
          if (threads && threads.length > 0) {
            idToLoad = threads[0]._id;
          }
        }

        if (idToLoad) {
          const fullThread = await fetchThread(idToLoad);
          setActiveThreadId(fullThread._id);
          setThreadTitle(fullThread.threadTitle || null);
          setMessages(fullThread.messages || []);
          setIsOffline(false);
          // Read-through: an opened thread stays readable without a network.
          if (userId) {
            await setCachedThread(userId, {
              id: fullThread._id,
              title: fullThread.threadTitle || null,
              messages: fullThread.messages || [],
            });
          }
        } else {
          setActiveThreadId(null);
          setThreadTitle(null);
          setThreadSubject(null);
          setMessages([]);
          setIsOffline(false);
        }
      } catch (err: any) {
        /*
         * The server is unreachable, so fall back to the last thread this device
         * opened. The screen says so, out loud, rather than showing an empty
         * thread or a spinner that never resolves — that honesty is the whole
         * point of design/png/10-dark-offline.png.
         */
        const cached = userId ? await getCachedThread(userId, targetThreadId || params.threadId) : null;
        if (cached) {
          setActiveThreadId(cached.id);
          setThreadTitle(cached.title);
          setMessages(cached.messages);
          setIsOffline(true);
          setError(null);
        } else {
          setActiveThreadId(null);
          setThreadTitle(null);
          setThreadSubject(null);
          setMessages([]);
          setIsOffline(false);
        }
      } finally {
        setIsLoadingThread(false);
      }
    },
    [params.newChat, params.threadId, user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      loadContextDocs();
      loadThread(params.threadId);
    }, [loadContextDocs, loadThread, params.threadId])
  );

  /*
   * The app bar's subtitle. screens.py:114 shows "DBMS · Unit 3" — a subject
   * and a unit. The thread API carries no subject, so the honest equivalent is
   * the grounding document's name plus how many turns the thread holds.
   */
  useEffect(() => {
    if (selectedDocs.length > 0) {
      setThreadSubject(selectedDocs[0].filename.replace(/\.[a-z0-9]+$/i, ''));
    } else if (messages.length > 0) {
      setThreadSubject(
        messages.length + (messages.length === 1 ? ' message' : ' messages')
      );
    } else {
      setThreadSubject(null);
    }
  }, [selectedDocs, messages.length]);

  const toggleReasoning = (key: string) => {
    setExpandedReasoning((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRemoveDocContext = async (docId: string) => {
    const updated = selectedDocs.filter((d) => d.id !== docId);
    setSelectedDocs(updated);
    await setStoredSelectedDocs(updated);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isSending) return;

    setError(null);
    const userMsg: ThreadMessage = {
      id: generateLocalMessageId('local'),
      role: 'user',
      content: query,
      documentIds: selectedDocs.map((d) => d.id),
      sentAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsSending(true);
    setStreamingId(null);

    const assistantId = generateLocalMessageId('local-assistant');

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    const upsertAssistant = (update: (msg: ThreadMessage) => ThreadMessage) => {
      setStreamingId(assistantId);
      setMessages((prev) => {
        const existing = prev.some((m) => m.id === assistantId);
        if (!existing) {
          const fresh: ThreadMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            sentAt: new Date(),
          };
          return [...prev, update(fresh)];
        }
        return prev.map((m) => (m.id === assistantId ? update(m) : m));
      });
    };

    try {
      const response = await sendChatMessage({
        message: query,
        threadId: activeThreadId || undefined,
        documentIds: selectedDocs.map((d) => d.id),
        onToken: (delta) =>
          upsertAssistant((msg) => ({ ...msg, content: msg.content + delta })),
        onReasoning: (delta) =>
          upsertAssistant((msg) => ({ ...msg, reasoning: (msg.reasoning || '') + delta })),
        onTitle: (title) => setThreadTitle(title),
      });

      if (response && response.threadId) {
        setActiveThreadId(response.threadId);
      }

      setMessages((prev) => {
        const finalMsg: ThreadMessage = {
          id: assistantId,
          role: 'assistant',
          content: response?.reply || '',
          reasoning: response?.reasoning || undefined,
          contextDoc: selectedDocs[0]?.filename,
          documentIds: selectedDocs.map((d) => d.id),
          showPracticeAction: selectedDocs.length > 0,
          sentAt: new Date(),
        };

        return prev.some((m) => m.id === assistantId)
          ? prev.map((m) =>
              m.id === assistantId
                ? {
                    ...finalMsg,
                    reasoning: finalMsg.reasoning || m.reasoning,
                    sentAt: m.sentAt,
                  }
                : m
            )
          : [...prev, finalMsg];
      });
    } catch (err: any) {
      console.error('Chat message send failed:', err);
      setError(err?.message || 'Failed to receive a response. Please check your connection.');
      setMessages((prev) => prev.filter((m) => !(m.id === assistantId && !m.content.trim())));
      setInputMessage(query);
    } finally {
      setIsSending(false);
      setStreamingId(null);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  };

  const isNewChat = messages.length === 0;
  const canSend = !!inputMessage.trim() && !isSending && !isOffline;

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      {/* App bar — hamburger opens the threads drawer (mockup 03), the title is
          the live thread, and the model pill is the bar's one trailing item.
          Offline, the pill is replaced by a "Cached" tag (screens.py:678). */}
      <AppHeader
        title={threadTitle || 'AI Hub'}
        subtitle={threadSubject || undefined}
        isRoot
        hideProfile
        divider={false}
        leading={
          <Pressable
            onPress={() => setDrawerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open threads"
            hitSlop={8}
            style={({ pressed }) => [styles.barIcon, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Menu size={targetSizes.iconSizeLarge} color={hub.text} />
          </Pressable>
        }
        trailingSlot={
          isOffline ? (
            <View style={[styles.cachedTag, { borderColor: '#3a3f4b' }]}>
              <Text style={[styles.cachedTagText, { color: hub.muted }]}>Cached</Text>
            </View>
          ) : (
            <View style={[styles.modelPill, { borderColor: hub.line }]}>
              <View style={styles.modelDot} />
              <Text style={[styles.modelPillText, { color: hub.text }]}>Ready</Text>
            </View>
          )
        }
      />

      {/* Offline banner (screens.py:680-683) — the warm amber notice, not a
          generic grey card. "You're offline. This thread is read from your
          device." is the exact copy from the mockup. NoticeBanner already
          carries both the light and the dark sampling of that amber. */}
      {isOffline && (
        <View style={styles.offlineBannerWrap}>
          <NoticeBanner>You&apos;re offline. This thread is read from your device.</NoticeBanner>
        </View>
      )}

      {/* Grounding documents, as the composer's context chips (css:270-275). */}
      {selectedDocs.length > 0 && (
        <View style={styles.contextRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.contextScroll}
          >
            {selectedDocs.map((doc) => (
              <View
                key={doc.id}
                style={[styles.contextChip, { backgroundColor: hub.surface, borderColor: hub.line }]}
              >
                <FileText size={13} color={hub.muted} />
                <Text
                  numberOfLines={1}
                  style={[styles.contextChipText, { color: hub.muted }]}
                >
                  {doc.filename}
                </Text>
                <Pressable
                  onPress={() => handleRemoveDocContext(doc.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${doc.filename} from context`}
                  hitSlop={10}
                >
                  <X size={12} color={hub.muted} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {isLoadingThread && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={hub.muted} />
          <Text style={[styles.loadingText, { color: hub.muted }]}>Loading conversation…</Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.thread}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Empty state — deterministic and plain (DESIGN_SPEC.md §8): no emoji,
            no invented content, just the three real suggested prompts. */}
        {isNewChat && !isLoadingThread && (
          <View style={styles.empty}>
            <Text style={[styles.emptyHeading, { color: hub.text }]}>
              What would you like to learn today?
            </Text>
            <Text style={[styles.emptyLede, { color: hub.muted }]}>
              Ask about a concept, attach your notes, or prepare for an interview.
            </Text>
            <View style={styles.suggestList}>
              {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleSendMessage(suggestion)}
                  accessibilityRole="button"
                  accessibilityLabel={suggestion}
                  style={({ pressed }) => [
                    styles.suggestRow,
                    {
                      backgroundColor: hub.surface,
                      borderColor: hub.line,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.suggestText, { color: hub.text }]}>{suggestion}</Text>
                  <ArrowRight size={15} color={hub.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const messageKey = msg.id || msg._id || `msg-${index}`;
          const isReasoningExpanded = !!expandedReasoning[messageKey];
          const isStreamingThis = streamingId === messageKey;
          const blocks = isUser ? [] : parseReplyBlocks(msg.content || '');

          /* A streaming reply that has not produced text yet shows the quiet
             thinking state, not an empty bubble. */
          const showThinking = !isUser && isStreamingThis && !msg.content.trim();

          if (isUser) {
            return (
              <View
                key={messageKey}
                style={[styles.userBubble, { backgroundColor: hub.strong }]}
              >
                <Text selectable style={[styles.userText, { color: hub.surface }]}>
                  {msg.content}
                </Text>
              </View>
            );
          }

          return (
            <View key={messageKey} style={styles.reply}>
              {/* Identity row — lime rule + mono name (css:300-304) */}
              <View style={styles.replyWho}>
                <View style={[styles.replyMark, { backgroundColor: hub.primary }]} />
                <Text style={[styles.replyName, { color: hub.muted }]}>CareerPilot</Text>
              </View>

              {!!msg.title && (
                <Text style={[styles.replyTitle, { color: hub.text }]}>{msg.title}</Text>
              )}

              {/* Chain-of-thought stays a collapsed, quiet trace — never mixed
                  into the answer (DESIGN_SPEC.md §6). */}
              {!!msg.reasoning && (
                <Pressable
                  onPress={() => toggleReasoning(messageKey)}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle the AI thinking trace"
                  style={[styles.reasoningBox, { backgroundColor: hub.soft }]}
                >
                  <Text style={[styles.reasoningLabel, { color: hub.muted }]}>
                    {isReasoningExpanded ? 'THINKING · TAP TO HIDE' : 'THINKING · TAP TO SHOW'}
                  </Text>
                  <Text
                    selectable
                    numberOfLines={isReasoningExpanded ? undefined : 3}
                    style={[styles.reasoningText, { color: hub.muted }]}
                  >
                    {msg.reasoning}
                  </Text>
                </Pressable>
              )}

              {showThinking ? (
                <ThinkingIndicator label="thinking…" />
              ) : (
                <ReplyBlocks blocks={blocks} />
              )}

              {isStreamingThis && !!msg.content.trim() && (
                <ThinkingIndicator label="writing…" />
              )}

              {/* Grounding card (css:324-338) */}
              {!!msg.contextDoc && (
                <View
                  style={[
                    styles.sourceCard,
                    { backgroundColor: hub.raised, borderColor: hub.line },
                  ]}
                >
                  <View style={[styles.sourcePdf, { backgroundColor: hub.surface, borderColor: hub.line }]}>
                    <Text style={[styles.sourcePdfText, { color: hub.muted }]}>PDF</Text>
                  </View>
                  <View style={styles.sourceMeta}>
                    <Text numberOfLines={1} style={[styles.sourceName, { color: hub.text }]}>
                      {msg.contextDoc}
                    </Text>
                    <Text style={[styles.sourceSub, { color: hub.muted }]}>
                      {msg.documentIds && msg.documentIds.length > 0
                        ? 'grounded on ' +
                          msg.documentIds.length +
                          (msg.documentIds.length === 1 ? ' chunk' : ' chunks')
                        : 'from your library'}
                    </Text>
                  </View>
                </View>
              )}

              {msg.showPracticeAction && (
                <Pressable
                  onPress={() => {
                    const docId = selectedDocs[0]?.id;
                    router.push({ pathname: '/quiz', params: docId ? { docId } : {} } as any);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Practice with a question"
                  hitSlop={8}
                  style={({ pressed }) => [styles.practiceRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.practiceText, { color: hub.text }]}>
                    Practice with a question
                  </Text>
                  <ArrowRight size={15} color={hub.text} />
                </Pressable>
              )}
            </View>
          );
        })}

        {error && (
          <View
            style={[styles.errorBanner, { backgroundColor: hub.surface, borderColor: hub.danger }]}
          >
            <View style={styles.errorHeader}>
              <AlertCircle size={16} color={hub.danger} />
              <Text style={[styles.errorTitle, { color: hub.danger }]}>Response failed</Text>
            </View>
            <Text style={[styles.errorText, { color: hub.text }]}>{error}</Text>
            <Pressable
              onPress={() => handleSendMessage()}
              accessibilityRole="button"
              accessibilityLabel="Retry sending message"
              hitSlop={8}
              style={({ pressed }) => [
                styles.retryRow,
                { borderColor: hub.line, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <RotateCcw size={14} color={hub.text} />
              <Text style={[styles.retryText, { color: hub.text }]}>Retry</Text>
            </Pressable>
          </View>
        )}

        {isSending && !streamingId && <ThinkingIndicator label="thinking…" />}
      </ScrollView>

      {/* Composer — css:260-280 */}
      <View
        style={[
          styles.composer,
          { backgroundColor: hub.bg, paddingBottom: Math.max(insets.bottom, spacing.sm) + 56 },
        ]}
      >
        <View
          style={[
            styles.composerShell,
            elevation.hubComposer,
            { backgroundColor: hub.surface, borderColor: hub.composerLine },
          ]}
        >
          <TextInput
            value={inputMessage}
            onChangeText={setInputMessage}
            placeholder={
              isOffline
                ? 'Reconnect to ask a follow-up…'
                : isNewChat
                ? 'Ask about your notes…'
                : 'Ask a follow-up…'
            }
            placeholderTextColor={hub.muted}
            style={[styles.composerInput, { color: hub.text }]}
            multiline
            editable={!isSending && !isOffline}
            accessibilityLabel="Message CareerPilot"
          />

          <View style={styles.composerBar}>
            <Pressable
              onPress={() => router.push('/upload' as any)}
              disabled={isOffline}
              accessibilityRole="button"
              accessibilityLabel="Attach study material"
              accessibilityState={{ disabled: isOffline }}
              style={({ pressed }) => [
                styles.chipBtn,
                { borderColor: hub.line, opacity: isOffline ? 0.5 : pressed ? 0.7 : 1 },
              ]}
            >
              <Paperclip size={14} color={hub.muted} />
              <Text style={[styles.chipBtnText, { color: hub.muted }]}>Attach</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/library' as any)}
              disabled={isOffline}
              accessibilityRole="button"
              accessibilityLabel="Open your study plan"
              accessibilityState={{ disabled: isOffline }}
              style={({ pressed }) => [
                styles.chipBtn,
                { borderColor: hub.line, opacity: isOffline ? 0.5 : pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.chipBtnText, { color: hub.muted }]}>Study plan</Text>
            </Pressable>

            <Pressable
              onPress={() => handleSendMessage()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={
                isOffline ? 'Sending is unavailable while offline' : 'Send message'
              }
              accessibilityState={{ disabled: !canSend }}
              // css:280 — disabled send is --hub-soft with a muted glyph;
              // css:276-279 — enabled is a 44dp --hub-strong circle.
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: canSend ? (pressed ? hub.strongHover : hub.strong) : hub.soft,
                },
              ]}
            >
              <ArrowUp size={20} color={canSend ? hub.surface : hub.muted} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Threads drawer — slides over the hub, hub chrome still visible behind
          the scrim (design/png/03-hub-threads.png). */}
      <ThreadsDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelectThread={(threadId) => {
          setDrawerOpen(false);
          loadThread(threadId);
        }}
        onNewThread={() => {
          setDrawerOpen(false);
          setActiveThreadId(null);
          setThreadTitle(null);
          setThreadSubject(null);
          setMessages([]);
          setError(null);
          setIsOffline(false);
        }}
        onDeleted={(threadId) => {
          /*
           * If the deleted thread is the one on screen, clear it. Leaving the
           * transcript up while its row vanishes from the drawer is the kind of
           * state mismatch that makes the app feel broken — the next message
           * would also be sent to a thread that no longer exists.
           */
          if (threadId !== activeThreadId) return;
          setActiveThreadId(null);
          setThreadTitle(null);
          setThreadSubject(null);
          setMessages([]);
          setError(null);
          setIsOffline(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* app bar */
  barIcon: {
    width: targetSizes.iconTouch,
    height: targetSizes.iconTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelPill: {
    // css:283-288 — 34px, radius 17, 1.5px hairline, mono 11.5/600
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: 17,
  },
  modelDot: {
    // css:289 — the live dot
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  modelPillText: {
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.23,
  },
  /** screens.py:678 — the offline bar tag: hairline, --hub-muted label. */
  cachedTag: {
    height: 25,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cachedTagText: {
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  },

  /* offline banner — css:349-354 / screens.py:680-683. The amber itself lives
     in NoticeBanner; this is only the gutter around it. */
  offlineBannerWrap: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },

  /* context chips */
  contextRow: {
    paddingBottom: spacing.sm,
  },
  contextScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    maxWidth: 240,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: 17,
  },
  contextChipText: {
    flexShrink: 1,
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.xs,
  },

  /* thread */
  thread: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    // Clears the absolutely-positioned composer (~140dp) plus the tab bar, so
    // the grounding card and the practice action can always scroll into view.
    paddingBottom: 200,
    gap: spacing.lg,
  },
  userBubble: {
    // css:293-298 — right-aligned, max-width 84%, radius 20/20/6/20
    alignSelf: 'flex-end',
    maxWidth: '84%',
    paddingHorizontal: spacing.base,
    paddingVertical: 13,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 20,
  },
  userText: {
    fontFamily: typography.fontBody,
    fontSize: 15,
    lineHeight: 15 * typography.lineHeights.normal,
  },

  reply: {
    // css:299 — .reply { margin-top: 20px } handled by the thread gap.
  },
  replyWho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 9,
  },
  replyMark: {
    // css:301-302 — a 20x3 lime rule, the reply's identity mark
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  replyName: {
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.77,
    textTransform: 'uppercase',
  },
  replyTitle: {
    fontFamily: typography.fontHeading,
    fontSize: typography.sizes.subheading,
    lineHeight: typography.sizes.subheading * typography.lineHeights.section,
    marginBottom: spacing.sm,
  },
  replyParagraph: {
    // css:305 — 15.5 / 1.68, the reading size
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.bodyChat,
    lineHeight: typography.sizes.bodyChat * typography.lineHeights.relaxed,
    marginBottom: 11,
  },
  replyHeading: {
    // css:306-307 — Anybody 17 / 700
    fontFamily: typography.fontHeading,
    fontSize: typography.sizes.subheading,
    lineHeight: typography.sizes.subheading * typography.lineHeights.section,
    marginTop: spacing.base,
    marginBottom: 8,
  },
  replyList: {
    marginBottom: 11,
  },
  replyListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  replyBullet: {
    // css:311-312 — 6px radius-50% dot, offset to sit on the first line
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
  },
  replyBulletText: {
    flex: 1,
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.bodyChat,
    lineHeight: typography.sizes.bodyChat * 1.62,
  },
  codeBlock: {
    // css:315-319 — a dark panel, radius 12, mono 12.5 / 1.75
    backgroundColor: '#15171b',
    borderRadius: 12,
    padding: spacing.base,
    marginVertical: spacing.md,
  },
  codeBlockText: {
    color: '#e6e8ee',
    fontFamily: typography.fontMono,
    fontSize: 12.5,
    lineHeight: 12.5 * 1.75,
  },
  /** css:313-314 — .reply code: mono 13.5 on --hub-soft, radius 5 */
  inlineCode: {
    fontSize: 13.5,
    borderRadius: 5,
  },
  inlineBold: {
    fontFamily: typography.fontBodyBold,
  },
  inlineItalic: {
    fontStyle: 'italic',
  },

  sourceCard: {
    // css:324-328
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  sourcePdf: {
    // css:329-333 — a 30x38 page with a "PDF" mark
    width: 30,
    height: 38,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  sourcePdfText: {
    fontFamily: typography.fontMonoBold,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  sourceMeta: { flex: 1, minWidth: 0 },
  sourceName: {
    // css:335-336 — 13 / 600, ellipsised
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizes.sm,
  },
  sourceSub: {
    // css:337-338 — mono 10.5
    fontFamily: typography.fontMonoMedium,
    fontSize: typography.sizes.fine,
    marginTop: 2,
  },

  practiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    minHeight: 36,
  },
  practiceText: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizes.body,
  },

  /* thinking (css:341-346) */
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.md,
  },
  thinkingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  thinkingLabel: {
    fontFamily: typography.fontMonoMedium,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.44,
    marginLeft: 4,
  },

  /* reasoning trace */
  reasoningBox: {
    borderRadius: radii.chip,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  reasoningLabel: {
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.77,
  },
  reasoningText: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.xs,
    lineHeight: typography.sizes.xs * typography.lineHeights.normal,
  },

  /* error */
  errorBanner: {
    borderWidth: 1.5,
    borderRadius: radii.card,
    padding: spacing.base,
    gap: spacing.xs,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizes.sm,
  },
  errorText: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeights.meta,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderRadius: radii.chip,
    marginTop: spacing.xs,
  },
  retryText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: typography.sizes.xs,
  },

  /* empty state */
  empty: {
    paddingTop: spacing.lg,
    alignItems: 'flex-start',
  },
  emptyHeading: {
    // A screen-title weight for the hub's own greeting (css:244-246 .greeting)
    fontFamily: typography.fontHeading,
    fontSize: 28,
    lineHeight: 28 * typography.lineHeights.display,
    letterSpacing: -0.7,
  },
  emptyLede: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.bodyChat,
    lineHeight: typography.sizes.bodyChat * typography.lineHeights.normal,
    marginTop: spacing.sm,
  },
  suggestList: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  suggestRow: {
    // css:249-253 — .suggest .row
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: 15,
  },
  suggestText: {
    flex: 1,
    fontFamily: typography.fontBodyMedium,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeights.normal,
  },

  /* composer (css:260-280) — pinned to the foot of the screen, with the thread
     padded so the last reply can always scroll clear of it. */
  composer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  composerShell: {
    borderWidth: 1.5,
    borderRadius: radii.composer,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: spacing.base,
    paddingRight: 12,
  },
  composerInput: {
    fontFamily: typography.fontBody,
    fontSize: 15,
    lineHeight: 15 * typography.lineHeights.normal,
    maxHeight: 120,
    paddingBottom: 10,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chipBtn: {
    // css:270-275 — 40px, radius 20, mono 11.5/600
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingHorizontal: 13,
    borderWidth: 1.5,
    borderRadius: 20,
  },
  chipBtnText: {
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.23,
  },
  sendBtn: {
    // css:276-279 — a 44dp circle, NOT lime
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
});
