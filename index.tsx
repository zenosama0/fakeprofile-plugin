import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

// --- Safely get React Native components ---
const RN = findByProps("ScrollView", "View") || {};
const ScrollView = RN.ScrollView;
const View = RN.View;
const Text = (findByProps("Text") || {}).Text;
const TextInput = (findByProps("TextInput") || {}).TextInput;
const Image = (findByProps("Image") || RN).Image;

// --- Safely get Form components ---
const Forms = findByProps("FormSection", "FormRow") || {};
const FormSection = Forms.FormSection;
const FormRow = Forms.FormRow;
const FormDivider = Forms.FormDivider;

// --- Safely get Button ---
let Button: any;
try {
  const btnMod = findByProps("Button") || {};
  Button = btnMod.Button || btnMod.default || btnMod;
} catch (e) {
  Button = null;
}

// --- Safely get assets/toasts ---
const Assets = findByProps("getAssetIDByName") || {};
const getAssetIDByName = Assets.getAssetIDByName || (() => null);

const Toasts = findByProps("showToast") || {};
const showToast = Toasts.showToast || ((msg: string) => console.log("[FakeProfile]", msg));

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

export default {
  onLoad: () => {
    // Patch UserStore.getUser
    if (UserStore && UserStore.getUser) {
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
    if (UserProfileStore && UserProfileStore.getUserProfile) {
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
      if (PresenceStore && PresenceStore.getState) {
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
        showToast("User ID is required", getAssetIDByName("ic_warning_24px"));
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
      showToast(editingIndex !== null ? "Profile updated!" : "Profile added!", getAssetIDByName("ic_check_24px"));
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
      showToast("Profile removed", getAssetIDByName("ic_trash_24px"));
    }, [overrides, editingIndex, saveToStorage]);

    const handleCancel = useCallback(() => {
      setEditingIndex(null);
      setFormData({ userId: "", avatarUrl: "", displayName: "", bio: "", status: "", bannerUrl: "", pronouns: "" });
    }, []);

    // If critical components are missing, show error
    if (!ScrollView || !View || !Text || !TextInput) {
      return React.createElement(View, { style: { flex: 1, padding: 20, justifyContent: "center", alignItems: "center" } },
        React.createElement(Text, { style: { color: "#ed4245", fontSize: 16, textAlign: "center" } },
          "Error: Could not load UI components.\nThe plugin may not be compatible with this version of Kettu."
        )
      );
    }

    return React.createElement(ScrollView, { style: { flex: 1 } },
      React.createElement(FormSection, { title: editingIndex !== null ? "Edit Profile Override" : "Add New Profile Override" },
        React.createElement(View, { style: { padding: 16 } },
          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "User ID (required):"),
          React.createElement(TextInput, {
            style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
            placeholder: "123456789012345678",
            placeholderTextColor: "#72767d",
            value: formData.userId,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, userId: text })),
            editable: editingIndex === null
          }),

          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Avatar URL:"),
          React.createElement(TextInput, {
            style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
            placeholder: "https://example.com/avatar.png",
            placeholderTextColor: "#72767d",
            value: formData.avatarUrl,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, avatarUrl: text }))
          }),

          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Banner URL:"),
          React.createElement(TextInput, {
            style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
            placeholder: "https://example.com/banner.png",
            placeholderTextColor: "#72767d",
            value: formData.bannerUrl,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, bannerUrl: text }))
          }),

          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Display Name:"),
          React.createElement(TextInput, {
            style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
            placeholder: "Custom Display Name",
            placeholderTextColor: "#72767d",
            value: formData.displayName,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, displayName: text }))
          }),

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

          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Custom Status:"),
          React.createElement(TextInput, {
            style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
            placeholder: "Playing something...",
            placeholderTextColor: "#72767d",
            value: formData.status,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, status: text }))
          }),

          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Pronouns:"),
          React.createElement(TextInput, {
            style: { backgroundColor: "#2f3136", color: "#dcddde", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
            placeholder: "they/them",
            placeholderTextColor: "#72767d",
            value: formData.pronouns,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, pronouns: text }))
          }),

          Button && React.createElement(View, { style: { flexDirection: "row", gap: 8, marginTop: 8 } },
            React.createElement(View, { style: { flex: 1 } },
              React.createElement(Button, {
                text: editingIndex !== null ? "Save Changes" : "Add Profile",
                color: "#5865f2",
                onPress: handleAdd
              })
            ),
            editingIndex !== null && React.createElement(View, { style: { flex: 1 } },
              React.createElement(Button, {
                text: "Cancel",
                color: "#ed4245",
                onPress: handleCancel
              })
            )
          )
        )
      ),

      FormDivider && React.createElement(FormDivider),

      FormSection && React.createElement(FormSection, { title: `Active Overrides (${overrides.length})` },
        overrides.length === 0
          ? React.createElement(Text, { style: { color: "#72767d", textAlign: "center", padding: 24, fontSize: 14 } },
              "No profile overrides yet. Add one above!"
            )
          : overrides.map((override: any, index: number) =>
              React.createElement(View, { key: index },
                FormRow && React.createElement(FormRow, {
                  label: `${override.displayName || "Unknown"} (${override.userId})`,
                  subLabel: [
                    override.avatarUrl && "Avatar",
                    override.bannerUrl && "Banner",
                    override.bio && "Bio",
                    override.status && "Status",
                    override.pronouns && "Pronouns"
                  ].filter(Boolean).join(", ") || "No modifications",
                  leading: override.avatarUrl && Image
                    ? React.createElement(Image, { source: { uri: override.avatarUrl }, style: { width: 40, height: 40, borderRadius: 20 } })
                    : React.createElement(View, { style: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#36393f", justifyContent: "center", alignItems: "center" } },
                        React.createElement(Text, { style: { color: "#72767d", fontSize: 16 } }, "?")
                      ),
                  trailing: Button && React.createElement(View, { style: { flexDirection: "row", gap: 8 } },
                    React.createElement(Button, { text: "Edit", size: "small", color: "#5865f2", onPress: () => handleEdit(index) }),
                    React.createElement(Button, { text: "Remove", size: "small", color: "#ed4245", onPress: () => handleRemove(index) })
                  )
                }),
                FormDivider && index < overrides.length - 1 && React.createElement(FormDivider)
              )
            )
      ),

      React.createElement(View, { style: { height: 40 } })
    );
  }
};
