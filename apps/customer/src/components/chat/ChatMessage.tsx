// One message in the Isha chat. The cards a reply can carry live in
// ./message/*; this file decides which message shape to draw.
import React, { memo, useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { makeAPICall, makeItineraryAPICall } from '@prayana/shared-services';
import IshaAvatar from './IshaAvatar';
import ItineraryDayCards from './ItineraryDayCards';
import ItineraryLoading from './ItineraryLoading';
import ItineraryPreviewCard from './ItineraryPreviewCard';
import TripChoices from './TripChoices';
import TripPlannerCompact from './TripPlannerCompact';
import ActionCards from './message/ActionCards';
import ChatMapCard from './message/ChatMapCard';
import EsimPlanCards from './message/EsimPlanCards';
import ImageCarousel from './message/ImageCarousel';
import InventoryCards from './message/InventoryCards';
import MessageMarkdown from './message/MessageMarkdown';
import PlaceCards from './message/PlaceCards';
import ReplySteps from './message/ReplySteps';
import ReplyToolbar from './message/ReplyToolbar';
import { runLegacyAction } from './message/legacyActions';
import { useIsha } from './ishaTheme';
import { useChatStore } from './useChatStore';
import { Chip, InkButton, Notice, OutlineButton } from './ui';
import type { ChatMessage as Msg } from './types';

const askAbout = (name: string) => useChatStore.getState().sendMessage(`Tell me about ${name}`);
const regenerate = () => useChatStore.getState().regenerateLastResponse();

// Isha's small label above each reply
function IshaLabel() {
  const t = useIsha();
  return (
    <View style={styles.label}>
      <IshaAvatar size={24} ring={1.5} />
      <Text style={[styles.labelText, { color: t.text }]}>Isha</Text>
    </View>
  );
}

/**
 * The plan, opened here under its card. A chat reopened from history keeps
 * only the plan's slug, so the plan is fetched by it.
 */
function useItinerary() {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);

  const toggle = useCallback(
    async (identifier?: string | null, md?: string | null) => {
      if (open) {
        setOpen(false);
        return;
      }
      if (typeof md === 'string' && md.includes('## Day')) {
        setMarkdown(md);
        setOpen(true);
        return;
      }
      if (markdown) {
        setOpen(true);
        return;
      }
      if (!identifier) {
        Toast.show({ type: 'error', text1: "Couldn't open this itinerary", text2: 'Ask Isha to plan the trip again.' });
        return;
      }
      setOpening(true);
      try {
        const json: any = await makeAPICall(`/itinerary/search?slug=${encodeURIComponent(identifier)}`, { timeout: 15000 });
        const found = json?.data?.results?.[0] || (Array.isArray(json?.data) ? json.data[0] : null);
        if (!found?.markdown) throw new Error('no plan');
        setMarkdown(found.markdown);
        setOpen(true);
      } catch {
        Toast.show({ type: 'error', text1: "Couldn't open this itinerary", text2: 'Ask Isha to plan the trip again.' });
      } finally {
        setOpening(false);
      }
    },
    [open, markdown],
  );

  return { open, opening, markdown, toggle, close: () => setOpen(false) };
}

function UserMessage({ message }: { message: Msg }) {
  const t = useIsha();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const { content, deliveryStatus } = message;

  const startEdit = () => {
    setText(content);
    setEditing(true);
  };
  const submit = () => {
    if (!text.trim()) return;
    useChatStore.getState().editAndResend(message.id, text.trim());
    setEditing(false);
  };
  const menu = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert('Your message', undefined, [
      { text: 'Copy', onPress: () => Clipboard.setStringAsync(content).catch(() => {}) },
      ...(deliveryStatus !== 'offline' ? [{ text: 'Edit and resend', onPress: startEdit }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  if (editing) {
    return (
      <View style={styles.userCol}>
        <View style={[styles.editBox, { borderColor: t.borderStrong, backgroundColor: t.surface }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            accessibilityLabel="Edit your message"
            style={[styles.editInput, { color: t.text }]}
          />
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)} style={({ pressed }) => [styles.editBtn, pressed && { backgroundColor: t.sunken }]}>
              <Text style={[styles.editBtnText, { color: t.body }]}>Cancel</Text>
            </Pressable>
            <InkButton label="Send" size="sm" disabled={!text.trim()} onPress={submit} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.userCol}>
      <Pressable onLongPress={menu} delayLongPress={300} accessibilityHint="Long press to copy or edit" style={{ maxWidth: '88%' }}>
        <View
          style={[
            styles.userBubble,
            deliveryStatus === 'failed'
              ? { borderWidth: 1, borderColor: t.dangerBorder, backgroundColor: t.surface }
              : { backgroundColor: t.userBubble },
            deliveryStatus === 'offline' && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.userText, { color: deliveryStatus === 'failed' ? t.body : t.userText }]}>
            {content}
          </Text>
        </View>
      </Pressable>
      {deliveryStatus === 'failed' && (
        <View style={styles.failed} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={14} color={t.danger} />
          <Text style={[styles.failedText, { color: t.danger }]}>Not sent</Text>
          <Text onPress={() => useChatStore.getState().retryMessage(message.id)} style={[styles.failedLink, { color: t.text }]}>
            Retry
          </Text>
          <Text onPress={startEdit} style={[styles.failedLink, { color: t.text }]}>
            Edit
          </Text>
        </View>
      )}
      {deliveryStatus === 'offline' && (
        <View style={styles.failed}>
          <Ionicons name="time-outline" size={13} color={t.muted} />
          <Text style={[styles.failedText, { color: t.muted }]}>Sends when you're back online</Text>
        </View>
      )}
    </View>
  );
}

function AgentMessage({ message }: { message: Msg }) {
  const t = useIsha();
  const name = message.agentName || 'Support';
  return (
    <View style={{ gap: 8 }} accessibilityLabel={`${name} from the Prayana team`}>
      <View style={styles.label}>
        <View style={[styles.agentInitial, { backgroundColor: t.agentBadgeBg }]}>
          <Text style={[styles.agentInitialText, { color: t.agentText }]}>{name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={[styles.labelText, { color: t.text }]}>{name}</Text>
        <View style={[styles.teamBadge, { backgroundColor: t.agentBg }]}>
          <Text style={[styles.teamBadgeText, { color: t.agentText }]}>Prayana team</Text>
        </View>
      </View>
      <View style={[styles.agentBubble, { borderColor: t.agentBorder, backgroundColor: t.agentBg }]}>
        <Text selectable style={[styles.userText, { color: t.body }]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function ItineraryPreviewMessage({ message }: { message: Msg }) {
  const itin = useItinerary();
  const ref = message.itineraryRef;
  const requestData = message.requestData || (ref ? { destination: ref.destination, duration: ref.duration, transportMode: ref.transportMode } : null);

  const view = async () => {
    const d = message.itineraryData;
    const full = d?.markdown && typeof d.markdown === 'object' ? d.markdown : d?.data && typeof d.data === 'object' ? d.data : d;
    const identifier = full?.slug || full?.markdownItineraryId || full?.itineraryId || ref?.slug || ref?.markdownItineraryId;
    const md = typeof full?.markdown === 'string' ? full.markdown : typeof d?.markdown === 'string' ? d.markdown : null;
    if (identifier || md || itin.open) {
      itin.toggle(identifier, md);
      return;
    }
    // An old card with nothing to open: ask for the same plan again (the
    // server returns the existing one quickly)
    const destination = requestData?.destination;
    const duration = requestData?.duration;
    if (!destination || !duration) {
      Toast.show({ type: 'error', text1: "Couldn't recover this itinerary", text2: 'Ask Isha to plan the trip again.' });
      return;
    }
    try {
      const json: any = await makeItineraryAPICall('/itinerary/generate-markdown', {
        method: 'POST',
        body: JSON.stringify({ destination, duration, transportMode: requestData?.transportMode || 'car_bus' }),
      });
      const data = json?.data;
      const id = data?.slug || data?.markdownItineraryId || data?.itineraryId;
      if (!json?.success || !id) throw new Error('none');
      itin.toggle(id, typeof data?.markdown === 'string' ? data.markdown : null);
    } catch {
      Toast.show({ type: 'error', text1: `Couldn't load this itinerary`, text2: `Ask Isha to plan a trip to ${destination} again.` });
    }
  };

  return (
    <View>
      <ItineraryPreviewCard
        itineraryData={message.itineraryData}
        requestData={requestData}
        fallbackImages={message.images}
        fallbackPlaces={message.topPlaces}
        onViewFull={view}
        opening={itin.opening}
        open={itin.open}
      />
      {itin.open && (
        <ItineraryDayCards
          markdown={itin.markdown}
          destination={requestData?.destination}
          duration={requestData?.duration}
          fallbackPlaces={message.topPlaces}
          onClose={itin.close}
        />
      )}
    </View>
  );
}

function IshaReply({ message, isLatest, isAuthenticated }: { message: Msg; isLatest: boolean; isAuthenticated: boolean }) {
  const t = useIsha();
  const itin = useItinerary();
  const {
    content, type, actions, relatedPlaces, topPlaces, images, suggestions, destinationData, detectedDestination,
    isStreaming, esimPlans, actionCards, itinerary, inventory, localPlaces, map, steps, interrupted, stopped,
  } = message;
  const hasContent = !!content;
  const done = !isStreaming;
  const tripChoices = (actionCards || []).filter((c) => c.type === 'trip_choices');
  const plan = itinerary || message.itineraryRef;
  const planDestination = detectedDestination || plan?.destination;

  const openPlan = () => {
    const slug = itinerary?.slug || itinerary?.markdownItineraryId || message.itineraryRef?.slug || message.itineraryRef?.markdownItineraryId;
    itin.toggle(slug, itinerary?.markdown);
  };

  return (
    <View style={[{ gap: 12 }, message.isTemporary && { opacity: 0.7 }]} accessibilityLabel="Isha's reply">
      <IshaLabel />

      {type === 'error' ? (
        <Notice
          actions={
            isLatest && message.errorReason !== 'day' && message.errorReason !== 'budget' ? (
              <InkButton label="Try again" icon="refresh" size="sm" onPress={regenerate} />
            ) : undefined
          }
        >
          {content}
        </Notice>
      ) : (
        <>
          <ReplySteps steps={steps || []} isStreaming={isStreaming} hasContent={hasContent} />

          {/* The place's photos first, as soon as Isha finds them: the words stream in below */}
          {!!images?.length && <ImageCarousel images={images} />}

          {hasContent && (
            <MessageMarkdown content={content} topPlaces={topPlaces} onAskAbout={askAbout} streaming={isStreaming} />
          )}

          {interrupted && (
            <Notice
              actions={
                isLatest ? (
                  <>
                    <InkButton label="Finish this reply" size="sm" onPress={() => useChatStore.getState().finishInterruptedReply(message.id)} />
                    <OutlineButton label="Start over" icon="refresh" onPress={regenerate} />
                  </>
                ) : undefined
              }
            >
              The connection dropped mid-reply. What you see is kept.
            </Notice>
          )}

          {stopped && (
            <View style={styles.stopped}>
              <View style={[styles.stoppedSquare, { backgroundColor: t.muted }]} />
              <Text style={[styles.stoppedText, { color: t.muted }]}>Stopped</Text>
              {isLatest && (
                <>
                  <Text style={[styles.stoppedText, { color: t.muted }]}>·</Text>
                  <Text onPress={regenerate} style={[styles.stoppedText, styles.link, { color: t.text }]}>
                    Regenerate
                  </Text>
                </>
              )}
            </View>
          )}
        </>
      )}

      {/* How long, when, who's going and the rest, asked in one go */}
      {done &&
        tripChoices.map((card, idx) => (
          <TripChoices key={`trip-${idx}`} data={card.data} locked={!isLatest} onSubmit={(text) => useChatStore.getState().sendMessage(text)} />
        ))}

      {/* A plan the agent built: its cover, then day by day here in the chat */}
      {done && plan && (
        <View>
          <ItineraryPreviewCard
            itineraryData={{ structured: null }}
            requestData={{ destination: planDestination, duration: plan.duration, transportMode: plan.transportMode }}
            fallbackImages={images?.length ? images : message.coverImages?.length ? message.coverImages : message.itineraryRef?.images}
            fallbackPlaces={topPlaces}
            onViewFull={openPlan}
            opening={itin.opening}
            open={itin.open}
          />
          {itin.open && (
            <ItineraryDayCards markdown={itin.markdown} destination={planDestination} duration={plan.duration} fallbackPlaces={topPlaces} onClose={itin.close} />
          )}
        </View>
      )}

      {done && !!inventory?.length && <InventoryCards inventory={inventory} />}

      {done && (
        <ActionCards
          // The plan's own card opens it: no second "Open your plan" button
          cards={plan ? (actionCards || []).filter((c) => c.type !== 'view_itinerary') : actionCards}
          isAuthenticated={isAuthenticated}
          onOpenItinerary={(card) => itin.toggle(card.data?.itineraryId || itinerary?.slug, itinerary?.markdown)}
        />
      )}

      {done && !!esimPlans?.length && <EsimPlanCards plans={esimPlans} isAuthenticated={isAuthenticated} />}

      {/* Real places from search_local, with a map */}
      {done && !!localPlaces?.length && <ChatMapCard map={map} places={localPlaces} />}

      {done && !!topPlaces?.length && (
        <PlaceCards topPlaces={topPlaces} destinationData={destinationData} detectedDestination={detectedDestination} isAuthenticated={isAuthenticated} />
      )}

      {done && !!relatedPlaces?.length && (
        <View style={styles.chips} accessibilityLabel="Related places">
          {relatedPlaces.map((p, idx) => (
            <Chip key={p.id || idx} label={p.name} onPress={() => askAbout(p.name)} />
          ))}
        </View>
      )}

      {/* Buttons from the older chat engine, still on restored chats */}
      {done && !!actions?.length && !tripChoices.length && !suggestions?.length && (
        <View style={styles.chips}>
          {actions.map((a, idx) => (
            <Chip key={idx} label={a.text} onPress={() => runLegacyAction(a)} />
          ))}
        </View>
      )}

      {done && hasContent && content.length > 2500 && type !== 'error' && isLatest && (
        <OutlineButton label="Keep going" icon="play-forward-outline" onPress={() => useChatStore.getState().continueGenerating()} style={{ alignSelf: 'flex-start' }} />
      )}

      {done && hasContent && type !== 'error' && !interrupted && <ReplyToolbar content={content} isLatest={isLatest} />}
    </View>
  );
}

function ChatMessage({ message, isLatest, isAuthenticated }: { message: Msg; isLatest: boolean; isAuthenticated: boolean }) {
  switch (message.type) {
    case 'trip_planner_form':
      return <PlannerForm />;
    case 'itinerary_preview':
      return <ItineraryPreviewMessage message={message} />;
    case 'itinerary_loading':
      return <ItineraryLoading destination={message.requestData?.destination} duration={message.requestData?.duration} />;
    case 'loading':
      return (
        <View style={{ gap: 12 }} accessibilityLabel="Isha is working">
          <IshaLabel />
          <ReplySteps steps={[{ text: message.content || 'Thinking…', done: false }]} isStreaming hasContent={false} />
        </View>
      );
    default:
      break;
  }
  if (message.role === 'user') return <UserMessage message={message} />;
  if (message.senderType === 'agent') return <AgentMessage message={message} />;
  return <IshaReply message={message} isLatest={isLatest} isAuthenticated={isAuthenticated} />;
}

function PlannerForm() {
  const isSending = useChatStore((s) => s.isSending);
  return <TripPlannerCompact onSubmit={(form) => useChatStore.getState().generateTripItinerary(form)} isGenerating={isSending} />;
}

export default memo(ChatMessage);

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  userCol: { alignItems: 'flex-end', gap: 6 },
  userBubble: { borderRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 10 },
  userText: { fontSize: 15, lineHeight: 22 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  failedText: { fontSize: 12 },
  failedLink: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline', paddingHorizontal: 4, paddingVertical: 4 },
  editBox: { width: '88%', borderWidth: 1, borderRadius: 18, padding: 10 },
  editInput: { fontSize: 15, lineHeight: 22, minHeight: 44, maxHeight: 140, padding: 0 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  editBtn: { height: 36, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' },
  editBtnText: { fontSize: 13, fontWeight: '500' },
  agentInitial: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  agentInitialText: { fontSize: 11, fontWeight: '600' },
  teamBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  teamBadgeText: { fontSize: 11, fontWeight: '600' },
  agentBubble: { borderWidth: 1, borderRadius: 18, borderTopLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  stopped: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stoppedSquare: { width: 8, height: 8, borderRadius: 1.5 },
  stoppedText: { fontSize: 12 },
  link: { fontWeight: '600', textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
