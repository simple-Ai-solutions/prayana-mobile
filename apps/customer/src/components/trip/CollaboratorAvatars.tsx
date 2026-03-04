import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { colors, fontSize, fontWeight, spacing, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';

interface CollaboratorAvatarsProps {
  onPress?: () => void;
  maxVisible?: number;
}

const USER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

function getColor(index: number): string {
  return USER_COLORS[index % USER_COLORS.length];
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

const CollaboratorAvatars: React.FC<CollaboratorAvatarsProps> = ({
  onPress,
  maxVisible = 4,
}) => {
  const activeEditors = useCreateTripStore((s) => s.activeEditors) || [];
  const isCollaborating = useCreateTripStore((s) => s.isCollaborating);

  if (!isCollaborating || activeEditors.length <= 1) return null;

  const visible = activeEditors.slice(0, maxVisible);
  const overflow = activeEditors.length - maxVisible;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {visible.map((editor: any, index: number) => (
        <View
          key={editor.id || editor.uid || index}
          style={[
            styles.avatar,
            { backgroundColor: getColor(index), zIndex: maxVisible - index, marginLeft: index > 0 ? -8 : 0 },
          ]}
        >
          <Text style={styles.avatarText}>
            {getInitials(editor.name || editor.displayName, editor.email)}
          </Text>
          {/* Online indicator */}
          <View style={styles.onlineDot} />
        </View>
      ))}
      {overflow > 0 && (
        <View style={[styles.avatar, styles.overflowAvatar, { marginLeft: -8 }]}>
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    position: 'relative',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  overflowAvatar: {
    backgroundColor: colors.gray[400],
  },
  overflowText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
});

export default React.memo(CollaboratorAvatars);
