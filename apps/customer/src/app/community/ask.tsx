// app/community/ask.tsx — Ask a Question (mobile)
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, spacing, borderRadius, useTheme } from "@prayana/shared-ui";
import { communityAPI } from "@prayana/shared-services";

const CATEGORIES = [
  { value: "destination", label: "Destination" },
  { value: "visa", label: "Visa & Documentation" },
  { value: "accommodation", label: "Accommodation" },
  { value: "transport", label: "Transport" },
  { value: "food", label: "Food & Cuisine" },
  { value: "safety", label: "Safety & Health" },
  { value: "budget", label: "Budget & Money" },
  { value: "gear", label: "Gear & Packing" },
  { value: "esim", label: "eSIM & Connectivity" },
  { value: "other", label: "Other" },
];

type ImageRecord = { url: string; s3Key: string; mimeType?: string; visionTags?: string[] };

export default function AskScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const params = useLocalSearchParams<{
    destination?: string;
    category?: string;
    title?: string;
    fromBooking?: string;
  }>();

  const [title, setTitle] = useState((params.title as string) || "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState((params.category as string) || "destination");
  const [tagInput, setTagInput] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [similar, setSimilar] = useState<any[]>([]);

  // Prefill from query params (post-trip emails, deep links)
  useEffect(() => {
    if (params.destination && !title) {
      setTitle(`Tips for ${params.destination} — what would you tell a future traveler?`);
      setTagInput((params.destination as string).toLowerCase());
    }
  }, []); // eslint-disable-line

  // Vector dedupe — debounced check
  useEffect(() => {
    const text = `${title}\n${description}`.trim();
    if (text.length < 14) {
      setSimilar([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await communityAPI.findSimilarQuestions(text);
        setSimilar(res?.data || []);
      } catch {
        setSimilar([]);
      }
    }, 700);
    return () => clearTimeout(handle);
  }, [title, description]);

  const pickImage = async () => {
    if (images.length >= 4) {
      Alert.alert("Limit reached", "Max 4 images per question");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "We need access to your photos to attach images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUploadingImage(true);
    try {
      const fd = new FormData();
      // RN FormData blob shape
      fd.append("images", {
        uri: asset.uri,
        type: asset.mimeType || "image/jpeg",
        name: asset.fileName || `upload-${Date.now()}.jpg`,
      } as any);
      fd.append("kind", "question");
      const res = await communityAPI.uploadImages(fd);
      const newImages = (res?.data?.images || []) as ImageRecord[];
      const rejected = res?.data?.rejected || [];
      if (rejected.length > 0) {
        Alert.alert("Image rejected", rejected[0]?.reason || "Failed content moderation");
      }
      setImages((prev) => [...prev, ...newImages]);
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Please try again");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (idx: number) => {
    const next = [...images];
    next.splice(idx, 1);
    setImages(next);
  };

  const submit = async () => {
    if (title.trim().length < 10) {
      Alert.alert("Title too short", "Title must be at least 10 characters");
      return;
    }
    setBusy(true);
    try {
      const tags = tagInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await communityAPI.createQuestion({
        title: title.trim(),
        description: description.trim(),
        category,
        tags,
        isAnonymous,
        images,
      });
      const id = res?.data?._id;
      router.replace((id ? `/community/${id}` : "/community") as any);
    } catch (e: any) {
      Alert.alert("Failed to post", e?.message || "Please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={themeColors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: themeColors.text }]}>Ask a Question</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={[styles.label, { color: themeColors.text }]}>Question title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Best month to visit Hampi for photography?"
            placeholderTextColor={themeColors.textTertiary}
            style={[styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
            maxLength={200}
          />
          <Text style={[styles.counter, { color: themeColors.textTertiary }]}>{title.length}/200</Text>
        </View>

        {similar.length > 0 && (
          <View style={styles.similarBox}>
            <Text style={styles.similarTitle}>👀 Similar questions already asked:</Text>
            {similar.slice(0, 3).map((q: any) => (
              <TouchableOpacity
                key={q._id}
                onPress={() => router.push(`/community/${q._id}` as any)}
                style={{ paddingVertical: 4 }}
              >
                <Text style={styles.similarItem} numberOfLines={2}>
                  • {q.title}
                </Text>
                <Text style={styles.similarMeta}>
                  {q.answerCount || 0} answer{q.answerCount === 1 ? "" : "s"}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.similarHint}>If none match, continue posting below.</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: themeColors.text }]}>Details (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add context, dates, what you've already tried…"
            placeholderTextColor={themeColors.textTertiary}
            style={[styles.input, styles.textarea, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
            multiline
            maxLength={5000}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: themeColors.text }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  style={[styles.catChip, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, active && styles.catChipActive]}
                >
                  <Text style={[styles.catChipText, { color: themeColors.textSecondary }, active && styles.catChipTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: themeColors.text }]}>Tags (comma-separated)</Text>
          <TextInput
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="hampi, karnataka, photography"
            placeholderTextColor={themeColors.textTertiary}
            style={[styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: themeColors.text }]}>Photos (optional, max 4)</Text>
          <View style={styles.imageGrid}>
            {images.map((img, i) => (
              <View key={img.s3Key} style={styles.imageThumbWrap}>
                <Image source={{ uri: img.url }} style={styles.imageThumb} />
                <TouchableOpacity
                  style={styles.imageRemove}
                  onPress={() => removeImage(i)}
                >
                  <Ionicons name="close" size={12} color="white" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 4 && (
              <TouchableOpacity
                style={[styles.imageThumb, styles.imageAdd, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border }]}
                onPress={pickImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator color={colors.primary[500]} />
                ) : (
                  <Ionicons name="add" size={24} color={themeColors.textTertiary} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setIsAnonymous(!isAnonymous)}
          style={styles.checkboxRow}
        >
          <View style={[styles.checkbox, { borderColor: themeColors.border }, isAnonymous && styles.checkboxChecked]}>
            {isAnonymous && <Ionicons name="checkmark" size={14} color="white" />}
          </View>
          <Text style={[styles.checkboxLabel, { color: themeColors.textSecondary }]}>Ask anonymously (your name won't be shown)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={submit}
          disabled={busy || title.trim().length < 10}
          style={[styles.submitBtn, (busy || title.trim().length < 10) && { opacity: 0.5 }]}
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitText}>Post Question</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, justifyContent: "space-between",
    backgroundColor: "white", borderBottomWidth: 1, borderColor: colors.gray[200],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as any, color: colors.gray[900] },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  field: { gap: 6 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any, color: colors.gray[800] },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.gray[900],
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  counter: { fontSize: 10, color: colors.gray[400], textAlign: "right" },
  similarBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  similarTitle: { fontSize: 12, fontWeight: fontWeight.semibold as any, color: "#1e40af", marginBottom: 4 },
  similarItem: { fontSize: 13, color: "#1e40af" },
  similarMeta: { fontSize: 11, color: "#3b82f6" },
  similarHint: { fontSize: 10, color: "#3b82f6", marginTop: 4 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "white", borderWidth: 1, borderColor: colors.gray[200],
  },
  catChipActive: { backgroundColor: colors.primary[100], borderColor: colors.primary[300] },
  catChipText: { fontSize: 11, color: colors.gray[700] },
  catChipTextActive: { color: colors.primary[700], fontWeight: fontWeight.semibold as any },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageThumb: {
    width: 72, height: 72, borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100], borderWidth: 1, borderColor: colors.gray[200],
  },
  imageThumbWrap: { position: "relative" },
  imageRemove: {
    position: "absolute", top: 2, right: 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 999, padding: 2,
  },
  imageAdd: { alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 2,
    borderColor: colors.gray[300], alignItems: "center", justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  checkboxLabel: { fontSize: fontSize.sm, color: colors.gray[700] },
  submitBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  submitText: { color: "white", fontWeight: fontWeight.semibold as any, fontSize: fontSize.md },
});
