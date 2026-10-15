// "Sacred Pilgrimage Sites in India", ported from the web home page:
//   components/collections/PilgrimageSection + PosterTile variant="arch"
//
// Each site is a temple-arch poster (see ArchPoster): the name in gold italic
// serif, then the state, the three things the place is known for (the aarti,
// the langar, the qawwali), its rating and an Explore button. Photos step
// through the site's gallery while the card is on screen.
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import {
  Building2, Church, Flame, Footprints, Landmark, Mountain, Music, Palette,
  Sailboat, Sparkles, TreePine, UtensilsCrossed, Waves,
} from 'lucide-react-native';
import { spacing } from '@prayana/shared-ui';
import { useRailPlayback, useRailClock } from './HomeRails';
import { ArchPoster, ARCH_CARD_W } from './ArchPoster';
import { RAIL_GAP } from '../../lib/railLayout';
import {
  PILGRIMAGE_SITES, SITE_INFO, SITE_GALLERY, type PilgrimagePlace, type PerkIcon,
} from '../../lib/pilgrimage';

const ICONS: Record<PerkIcon, React.ComponentType<any>> = {
  Building2, Church, Flame, Footprints, Landmark, Mountain, Music, Palette,
  Sailboat, Sparkles, TreePine, UtensilsCrossed, Waves,
};

export function PilgrimageRail({ onPlacePress }: {
  onPlacePress: (place: PilgrimagePlace) => void;
}) {
  const { canPlay, scrollProps, inView } = useRailPlayback(ARCH_CARD_W, RAIL_GAP);
  const tick = useRailClock(inView);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      {...scrollProps}
    >
      {PILGRIMAGE_SITES.map((place, i) => {
        const info = SITE_INFO[place.id];
        return (
          <ArchPoster
            key={place.id}
            frames={[...new Set([place.image, ...(SITE_GALLERY[place.id] || [])])]}
            name={place.name}
            strap={info?.strap}
            eyebrow={info?.state}
            perks={(info?.perks || []).map(([label, icon]) => ({ label, Icon: ICONS[icon] }))}
            footer={place.rating ? `★ ${place.rating} rated` : ''}
            playing={canPlay(i)}
            tick={tick}
            onPress={() => onPlacePress(place)}
            accessibilityLabel={`${place.name}${info ? `, ${info.state}` : ''}`}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { gap: RAIL_GAP, paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 12 },
});
