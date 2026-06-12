import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

// --- React Native components from global (guaranteed to exist) ---
const RN = (typeof ReactNative !== "undefined" ? ReactNative : {}) as any;
const { ScrollView, View, Text, TextInput, Image, Pressable, TouchableOpacity } = RN;

// --- Try to get Discord Form components, but don't crash if missing ---
let FormSection: any, FormRow: any, FormDivider: any;
try {
  const forms = findByProps("FormSection", "FormRow", "FormDivider");
  if (forms) {
    FormSection = forms.FormSection;
    FormRow = forms.FormRow;
    FormDivider = forms.FormDivider;
  }
} catch (e) {}

// --- Toasts ---
let showToast: any;
try {
  const toasts = findByProps("showToast");
  showToast = toasts?.showToast || ((msg: string) => console.log("[FakeProfile]", msg));
} catch (e) {
  showToast = (msg: string) => console.log("[FakeProfile]", msg);
}

// --- Asset icons ---
let getAssetIDByName: any;
try {
  const assets = findByProps("getAssetIDByName");
  getAssetIDByName = assets?.getAssetIDByName || (() => null);
} catch (e) {
  getAssetIDByName = () => null;
}

// --- React hooks ---
const { useState, useCallback } = React;

// --- Storage init ---
if (!storage.overrides) {
  storage.overrides = [];
}

// --- Get stores ---
const UserStore = findByStoreName("UserStore");
const UserProfileStore = findByStoreName("UserProfileStore");

// Helper
function getOverride(userId: string) {
  return storage.overrides.find((o: any) => o.userId === userId);
}

let patches: any[] = [];

// --- Simple custom button (guaranteed to work) ---
function Btn(props: { text: string; color?: string; onPress: () => void; style?: any }) {
  return React.createElement(Pressable, {
    onPress: props.onPress,
    style: [
      {
        backgroundColor: props.color || "#5865f2",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
      },
      props.style
    ]
  }, React.createElement(Text, {
    style: { color: "#ffffff", fontSize: 14, fontWeight: "600" }
  }, props.text));
}

// --- Simple custom section header ---
function SectionTitle(props: { text: string }) {
  return React.createElement(Text, {
    style: {
      color: "#b9bbbe",
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      marginTop: 24,
      marginBottom: 8,
      marginHorizontal: 16,
    }
  }, props.text);
}

// --- Simple custom row ---
function Row(props: { label: string; subLabel?: string; onPress?: () => void; leading?: any; trailing?: any }) {
  return React.createElement(Pressable, {
    onPress: props.onPress,
    style: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: "#2f3136",
      marginBottom: 1,
    }
  },
    props.leading && React.createElement(View, { style: { marginRight: 12 } }, props.leading),
    React.createElement(View, { style: { flex: 1 } },
      React.createElement(Text, { style: { color: "#dcddde", fontSize: 14 } }, props.label),
      props.subLabel && React.createElement(Text, { style: { color: "#72767d", fontSize: 12, marginTop: 2 } }, props.subLabel)
    ),
    props.trailing && React.createElement(View, { style: { marginLeft: 8 } }, props.trailing)
  );
}

export default {
  onLoad: () => {
    // Patch UserStore.getUser
    if (UserStore && typeof UserStore.getUser === "function") {
      const userPatch = after("getUser", UserStore, (args, ret) => {
        if (!ret || !ret.id) return ret;
        const override = getOverride(ret.id);
        if (!override) return ret;

        const modified = { ...ret };
        if (override.avatarUrl) {
          modified.avatar = override.avatarUrl;
          modified.avatarDecoration = null;
        }
        if (override.displayName) {
          modified.globalName = override.displayName;
        }
        if (override.bannerUrl) {
          modified.banner = override.bannerUrl;
        }
        return modified;
      });
      patches.push(userPatch);
    }

    // Patch UserProfileStore.getUserProfile
    if (UserProfileStore && typeof UserProfileStore.getUserProfile === "function") {
      const profilePatch = after("getUserProfile", UserProfileStore, (args, ret) => {
        if (!ret) return ret;
        const userId = args[0];
        const override = getOverride(userId);
        if (!override) return ret;

        const modified = { ...ret };
        if (override.bio) modified.bio = override.bio;
        if (override.pronouns) modified.pronouns = override.pronouns;
        return modified;
      });
      patches.push(profilePatch);
    }

    // Patch PresenceStore for status
    try {
      const PresenceStore = findByStoreName("PresenceStore");
      if (PresenceStore && typeof PresenceStore.getState === "function") {
        const statusPatch = after("getState", PresenceStore, (args, ret) => {
          if (!ret || typeof ret.getStatus !== "function") return ret;
          const orig = ret.getStatus;
          ret.getStatus = (userId: string) => {
            const override = getOverride(userId);
            if (override?.status) {
              const original = orig(userId);
              return { ...original, status: override.status, customStatus: { name: override.status } };
            }
            return orig(userId);
          };
          return ret;
        });
        patches.push(statusPatch);
      }
    } catch (e) {
      console.log("[FakeProfile] Status patch skipped:", e);
    }
  },

  onUnload: () => {
    patches.forEach(p => {
      try { p?.(); } catch (e) {}
    });
    patches = [];
  },

  settings: () => {
    const [overrides, setOverrides] = useState(storage.overrides || []);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [formData, setFormData] = useState({
      userId: "",
      avatarUrl: "",
      displayName: "",
      bio: "",
      status: "",
      bannerUrl: "",
      pronouns: ""
    });

    const saveToStorage = useCallback((newOverrides: any[]) => {
      storage.overrides = newOverrides;
      setOverrides(newOverrides);
    }, []);

    const handleAdd = useCallback(() => {
      if (!formData.userId) {
        showToast("User ID is required");
        return;
      }
      const newOverrides = [...overrides];
      if (editingIndex !== null) {
        newOverrides[editingIndex] = { ...formData };
      } else {
        newOverrides.push({ ...formData });
      }
      saveToStorage(newOverrides);
      setEditingIndex(null);
      setFormData({ userId: "", avatarUrl: "", displayName: "", bio: "", status: "", bannerUrl: "", pronouns: "" });
      showToast(editingIndex !== null ? "Profile updated!" : "Profile added!");
    }, [formData, editingIndex, overrides, saveToStorage]);

    const handleEdit = useCallback((index: number) => {
      setEditingIndex(index);
      setFormData({ ...overrides[index] });
    }, [overrides]);

    const handleRemove = useCallback((index: number) => {
      const newOverrides = overrides.filter((_: any, i: number) => i !== index);
      saveToStorage(newOverrides);
      if (editingIndex === index) {
        setEditingIndex(null);
        setFormData({ userId: "", avatarUrl: "", displayName: "", bio: "", status: "", bannerUrl: "", pronouns: "" });
      }
      showToast("Profile removed");
    }, [overrides, editingIndex, saveToStorage]);

    const handleCancel = useCallback(() => {
      setEditingIndex(null);
      setFormData({ userId: "", avatarUrl: "", displayName: "", bio: "", status: "", bannerUrl: "", pronouns: "" });
    }, []);

    // --- RENDER ---
    return React.createElement(ScrollView, { style: { flex: 1, backgroundColor: "#1e1f22" } },

      // --- ADD/EDIT FORM ---
      SectionTitle({ text: editingIndex !== null ? "Edit Profile Override" : "Add New Profile Override" }),

      React.createElement(View, { style: { paddingHorizontal: 16 } },
        // User ID
        React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4, marginTop: 8 } }, "User ID (required):"),
        React.createElement(TextInput, {
          style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
          placeholder: "123456789012345678",
          placeholderTextColor: "#72767d",
          value: formData.userId,
          onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, userId: text })),
          editable: editingIndex === null
        }),

        // Avatar URL
        React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Avatar URL:"),
        React.createElement(TextInput, {
          style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
          placeholder: "https://example.com/avatar.png",
          placeholderTextColor: "#72767d",
          value: formData.avatarUrl,
          onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, avatarUrl: text }))
        }),

        // Banner URL
        React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Banner URL:"),
        React.createElement(TextInput, {
          style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
          placeholder: "https://example.com/banner.png",
          placeholderTextColor: "#72767d",
          value: formData.bannerUrl,
          onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, bannerUrl: text }))
        }),

        // Display Name
        React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Display Name:"),
        React.createElement(TextInput, {
          style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
          placeholder: "Custom Display Name",
          placeholderTextColor: "#72767d",
          value: formData.displayName,
          onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, displayName: text }))
        }),

        // Bio
        React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Bio / About Me:"),
        React.createElement(TextInput, {
          style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, height: 80, textAlignVertical: "top", marginBottom: 12 },
          placeholder: "Custom bio text...",
          placeholderTextColor: "#72767d",
          value: formData.bio,
          onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, bio: text })),
          multiline: true,
          numberOfLines: 4
        }),

        // Status
        React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Custom Status:"),
        React.createElement(TextInput, {
          style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
          placeholder: "Playing something...",
          placeholderTextColor: "#72767d",
          value: formData.status,
          onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, status: text }))
        }),

        // Pronouns
        React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Pronouns:"),
        React.createElement(TextInput, {
          style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
          placeholder: "they/them",
          placeholderTextColor: "#72767d",
          value: formData.pronouns,
          onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, pronouns: text }))
        }),

        // Buttons
        React.createElement(View, { style: { flexDirection: "row", gap: 8, marginTop: 8 } },
          React.createElement(Btn, { text: editingIndex !== null ? "Save Changes" : "Add Profile", color: "#5865f2", onPress: handleAdd, style: { flex: 1 } }),
          editingIndex !== null && React.createElement(Btn, { text: "Cancel", color: "#ed4245", onPress: handleCancel, style: { flex: 1 } })
        )
      ),

      // --- LIST OF OVERRIDES ---
      SectionTitle({ text: `Active Overrides (${overrides.length})` }),

      overrides.length === 0
        ? React.createElement(Text, { style: { color: "#72767d", textAlign: "center", padding: 24, fontSize: 14 } },
            "No profile overrides yet. Add one above!"
          )
        : React.createElement(View, { style: { marginHorizontal: 16 } },
            overrides.map((override: any, index: number) =>
              React.createElement(View, { key: index, style: { marginBottom: 8 } },
                Row({
                  label: `${override.displayName || "Unknown"}`,
                  subLabel: override.userId,
                  leading: override.avatarUrl && Image
                    ? React.createElement(Image, { source: { uri: override.avatarUrl }, style: { width: 40, height: 40, borderRadius: 20 } })
                    : React.createElement(View, { style: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#36393f", justifyContent: "center", alignItems: "center" } },
                        React.createElement(Text, { style: { color: "#72767d", fontSize: 16 } }, "?")
                      ),
                  trailing: React.createElement(View, { style: { flexDirection: "row", gap: 8 } },
                    React.createElement(Btn, { text: "Edit", color: "#5865f2", onPress: () => handleEdit(index) }),
                    React.createElement(Btn, { text: "Remove", color: "#ed4245", onPress: () => handleRemove(index) })
                  )
                })
              )
            )
          ),

      React.createElement(View, { style: { height: 40 } })
    );
  }
};
