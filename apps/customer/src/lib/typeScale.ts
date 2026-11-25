// The app's text sizes for page titles and section headings, so every tab
// reads the same: Explore, Planner and My Trips used 30, Profile 24,
// Notifications 26, and My Trips labelled its sections in small capitals
// where the other tabs used bold headings.
import { TextStyle } from 'react-native';

export const PAGE_TITLE: TextStyle = { fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.8 };
export const SECTION_TITLE: TextStyle = { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 };
export const CARD_TITLE: TextStyle = { fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.2 };
export const BODY: TextStyle = { fontSize: 14, lineHeight: 20 };
export const CAPTION: TextStyle = { fontSize: 12, lineHeight: 16 };
