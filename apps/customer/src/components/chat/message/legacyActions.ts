// Older reply buttons ("Check weather", "Open trip planner"…) that the
// pre-agent chat engine attached to messages. The agent no longer sends them,
// but conversations restored from history still carry some.
import { makeAPICall } from '@prayana/shared-services';
import { useChatStore } from '../useChatStore';
import type { LegacyAction } from '../types';

async function weatherReply(location: string) {
  const { addMessage, removeMessage } = useChatStore.getState();
  addMessage({ role: 'user', type: 'message', content: `What's the weather in ${location}?` });
  const loadingId = addMessage({ role: 'assistant', type: 'loading', content: `Checking the weather in ${location}…` });
  try {
    const res: any = await makeAPICall(`/destinations/weather/${encodeURIComponent(location)}`, { timeout: 12000 });
    removeMessage(loadingId);
    if (!res?.success) throw new Error('no weather');
    const { current, forecast, location: place, travelRecommendation: rec } = res.data || {};
    let text = `**Weather in ${place?.name || location}${place?.country ? `, ${place.country}` : ''}**\n\n`;
    if (current) {
      text += `- Now: **${current.temperature?.current}${current.temperature?.unit || ''}**, ${current.condition?.description || ''}\n`;
      text += `- Feels like ${current.temperature?.feelsLike}${current.temperature?.unit || ''} · humidity ${current.humidity}% · wind ${current.windSpeed} km/h\n`;
    }
    if (forecast?.length) {
      text += `\n**Next ${Math.min(5, forecast.length)} days**\n`;
      for (const day of forecast.slice(0, 5)) {
        text += `- ${day.dayOfWeek}: ${day.temperature?.min}°–${day.temperature?.max}°, ${day.condition?.description || ''}\n`;
      }
    }
    if (rec?.message) text += `\n${rec.message}`;
    addMessage({
      role: 'assistant',
      type: 'response',
      content: text,
      suggestions: [{ text: 'Best time to visit' }, { text: 'What to pack' }, { text: 'Plan activities' }],
    });
  } catch {
    removeMessage(loadingId);
    addMessage({
      role: 'assistant',
      type: 'error',
      content: `I couldn't get the weather for ${location}. Try again in a bit.`,
    });
  }
}

export function runLegacyAction(action: LegacyAction) {
  const { sendMessage, showTripPlannerForm, chatContext } = useChatStore.getState();
  switch (action.type) {
    case 'open_modal':
      if (action.target === 'trip_planning') showTripPlannerForm();
      break;
    case 'quick_search':
      if (action.query) sendMessage(action.query);
      break;
    case 'place_details':
      sendMessage(`Tell me more about ${action.text?.replace(/^Learn about\s+/i, '') || action.placeId}`);
      break;
    case 'get_weather':
    case 'get_weather_detailed': {
      const location = action.location || chatContext.destination;
      if (location) weatherReply(location);
      else sendMessage('Check the weather');
      break;
    }
    case 'show_featured':
      sendMessage('Show me featured destinations');
      break;
    default:
      // The app's own older replies: { text, action } with no type
      if (action.text) sendMessage(action.text);
  }
}
