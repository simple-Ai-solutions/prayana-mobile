// EsimHeroVideo — the looping background video behind the eSIM hero, matching
// the PWA (which renders a muted, autoplaying <video> with an Unsplash poster).
//
// Same asset as the web. The poster image renders underneath, so if the video
// is slow or blocked the hero still looks right rather than going black — and
// reduce-motion users keep the still image, since a looping background clip is
// exactly the kind of motion that setting exists to suppress.
import React, { useEffect, useState } from 'react';
import {
  View,
  ImageBackground,
  StyleSheet,
  AccessibilityInfo,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

// The same clip and poster the web's eSIM hero uses.
const VIDEO_URL =
  'https://videos.pexels.com/video-files/2169880/2169880-hd_1920_1080_30fps.mp4';
const POSTER_URL =
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1600&q=80';

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export const EsimHeroVideo: React.FC<Props> = ({ style, children }) => {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const player = useVideoPlayer(VIDEO_URL, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (reduceMotion) {
      player.pause();
      return;
    }
    player.play();
  }, [player, reduceMotion]);

  // Only cross-fade the video in once it actually has frames, so we never flash
  // a black rectangle over the poster.
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') setReady(true);
    });
    return () => sub.remove();
  }, [player]);

  const showVideo = !reduceMotion && ready;

  return (
    <ImageBackground source={{ uri: POSTER_URL }} style={style} imageStyle={styles.poster}>
      {showVideo && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            // The hero is decorative — it must not steal the tap or offer PiP.
            allowsPictureInPicture={false}
            allowsFullscreen={false}
          />
        </View>
      )}
      {children}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  poster: {},
});

export default EsimHeroVideo;
