import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

// Get React Native components via metro
const { ScrollView, View, Text, TextInput, Image } = findByProps("ScrollView", "View", "Text", "TextInput");
const { FormSection, FormRow, FormDivider } = findByProps("FormSection", "FormRow", "FormDivider");
const { FormSwitch } = findByProps("FormSwitch");
const Button = findByProps("Button")?.Button || findByProps("Button");
const { getAssetIDByName } = findByProps("getAssetIDByName");
const { showToast } = findByProps("showToast");

const { useState, useCallback } = React;

// Default storage structure
if (!storage.overrides) {
  storage.overrides = [];
}

// Get stores to patch user data
const UserStore = findByStoreName("UserStore");
const UserProfileStore = findByStoreName("UserProfileStore");

// Helper to get override for a user
function getOverride(userId: string) {
  return storage.overrides.find((o: any) => o.userId === userId);
}

// Main plugin export
let patches: any[] = [];

export default {
  onLoad: () => {
    // Patch UserStore.getUser to return modified user data
    const userPatch = after("getUser", UserStore, (args, ret) => {
      if (!ret) return ret;
      
      const override = getOverride(ret.id);
      if (!override) return ret;

      const modified = { ...ret };
      
      if (override.avatarUrl) {
        modified.avatar = override.avatarUrl;
        modified.avatarDecoration = null;
      }
      
      if (override.displayName) {
        modified.globalName = override.displayName;
        modified.username = override.displayName;
      }
      
      if (override.bannerUrl) {
        modified.banner = override.bannerUrl;
      }

      return modified;
    });

    // Patch UserProfileStore to modify profile data (bio, pronouns, etc.)
    const profilePatch = after("getUserProfile", UserProfileStore, (args, ret) => {
      if (!ret) return ret;
      
      const userId = args[0];
      const override = getOverride(userId);
      if (!override) return ret;

      const modified = { ...ret };
      
      if (override.bio) {
        modified.bio = override.bio;
      }
      
      if (override.pronouns) {
        modified.pronouns = override.pronouns;
      }

      return modified;
    });

    // Try to patch PresenceStore for custom status
    try {
      const PresenceStore = findByStoreName("PresenceStore");
      const statusPatch = after("getState", PresenceStore, (args, ret) => {
        if (!ret || !ret.getStatus) return ret;
        
        const originalGetStatus = ret.getStatus;
        ret.getStatus = (userId: string) => {
          const override = getOverride(userId);
          if (override?.status) {
            const original = originalGetStatus(userId);
            return {
              ...original,
              status: override.status,
              customStatus: { name: override.status }
            };
          }
          return originalGetStatus(userId);
        };
        return ret;
      });
      patches.push(statusPatch);
    } catch (e) {
      console.log("[FakeProfile] Status patch failed:", e);
    }

    patches.push(userPatch, profilePatch);
  },

  onUnload: () => {
    patches.forEach(p => p?.());
    patches = [];
  },

  // Settings page component
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
      setFormData({
        userId: "",
        avatarUrl: "",
        displayName: "",
        bio: "",
        status: "",
        bannerUrl: "",
        pronouns: ""
      });
      
      showToast(
        editingIndex !== null ? "Profile updated!" : "Profile added!", 
        getAssetIDByName("ic_check_24px")
      );
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
        setFormData({
          userId: "",
          avatarUrl: "",
          displayName: "",
          bio: "",
          status: "",
          bannerUrl: "",
          pronouns: ""
        });
      }
      
      showToast("Profile removed", getAssetIDByName("ic_trash_24px"));
    }, [overrides, editingIndex, saveToStorage]);

    const handleCancel = useCallback(() => {
      setEditingIndex(null);
      setFormData({
        userId: "",
        avatarUrl: "",
        displayName: "",
        bio: "",
        status: "",
        bannerUrl: "",
        pronouns: ""
      });
    }, []);

    return React.createElement(ScrollView, { style: { flex: 1 } },
      // Form Section
      React.createElement(FormSection, { title: editingIndex !== null ? "Edit Profile Override" : "Add New Profile Override" },
        React.createElement(View, { style: { padding: 16, gap: 12 } },
          // User ID
          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "User ID (required):"),
          React.createElement(TextInput, {
            style: {
              backgroundColor: "#2f3136",
              color: "#dcddde",
              padding: 12,
              borderRadius: 8,
              fontSize: 14
            },
            placeholder: "123456789012345678",
            placeholderTextColor: "#72767d",
            value: formData.userId,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, userId: text })),
            editable: editingIndex === null
          }),

          // Avatar URL
          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Avatar URL:"),
          React.createElement(TextInput, {
            style: {
              backgroundColor: "#2f3136",
              color: "#dcddde",
              padding: 12,
              borderRadius: 8,
              fontSize: 14
            },
            placeholder: "https://example.com/avatar.png",
            placeholderTextColor: "#72767d",
            value: formData.avatarUrl,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, avatarUrl: text }))
          }),

          // Banner URL
          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Banner URL:"),
          React.createElement(TextInput, {
            style: {
              backgroundColor: "#2f3136",
              color: "#dcddde",
              padding: 12,
              borderRadius: 8,
              fontSize: 14
            },
            placeholder: "https://example.com/banner.png",
            placeholderTextColor: "#72767d",
            value: formData.bannerUrl,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, bannerUrl: text }))
          }),

          // Display Name
          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Display Name:"),
          React.createElement(TextInput, {
            style: {
              backgroundColor: "#2f3136",
              color: "#dcddde",
              padding: 12,
              borderRadius: 8,
              fontSize: 14
            },
            placeholder: "Custom Display Name",
            placeholderTextColor: "#72767d",
            value: formData.displayName,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, displayName: text }))
          }),

          // Bio
          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Bio / About Me:"),
          React.createElement(TextInput, {
            style: {
              backgroundColor: "#2f3136",
              color: "#dcddde",
              padding: 12,
              borderRadius: 8,
              fontSize: 14,
              height: 80,
              textAlignVertical: "top"
            },
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
            style: {
              backgroundColor: "#2f3136",
              color: "#dcddde",
              padding: 12,
              borderRadius: 8,
              fontSize: 14
            },
            placeholder: "Playing something...",
            placeholderTextColor: "#72767d",
            value: formData.status,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, status: text }))
          }),

          // Pronouns
          React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 12, marginBottom: 4 } }, "Pronouns:"),
          React.createElement(TextInput, {
            style: {
              backgroundColor: "#2f3136",
              color: "#dcddde",
              padding: 12,
              borderRadius: 8,
              fontSize: 14
            },
            placeholder: "they/them",
            placeholderTextColor: "#72767d",
            value: formData.pronouns,
            onChangeText: (text: string) => setFormData((prev: any) => ({ ...prev, pronouns: text }))
          }),

          // Buttons
          React.createElement(View, { style: { flexDirection: "row", gap: 8, marginTop: 8 } },
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

      React.createElement(FormDivider),

      // List of existing overrides
      React.createElement(FormSection, { title: `Active Overrides (${overrides.length})` },
        overrides.length === 0
          ? React.createElement(Text, {
              style: {
                color: "#72767d",
                textAlign: "center",
                padding: 24,
                fontSize: 14
              }
            }, "No profile overrides yet. Add one above!")
          : overrides.map((override: any, index: number) =>
              React.createElement(View, { key: index },
                React.createElement(FormRow, {
                  label: `${override.displayName || "Unknown"} (${override.userId})`,
                  subLabel: [
                    override.avatarUrl && "Avatar",
                    override.bannerUrl && "Banner",
                    override.bio && "Bio",
                    override.status && "Status",
                    override.pronouns && "Pronouns"
                  ].filter(Boolean).join(", ") || "No modifications",
                  leading: override.avatarUrl
                    ? React.createElement(Image, {
                        source: { uri: override.avatarUrl },
                        style: { width: 40, height: 40, borderRadius: 20 }
                      })
                    : React.createElement(View, {
                        style: {
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "#36393f",
                          justifyContent: "center",
                          alignItems: "center"
                        }
                      }, React.createElement(Text, { style: { color: "#72767d", fontSize: 16 } }, "?")),
                  trailing: React.createElement(View, { style: { flexDirection: "row", gap: 8 } },
                    React.createElement(Button, {
                      text: "Edit",
                      size: "small",
                      color: "#5865f2",
                      onPress: () => handleEdit(index)
                    }),
                    React.createElement(Button, {
                      text: "Remove",
                      size: "small",
                      color: "#ed4245",
                      onPress: () => handleRemove(index)
                    })
                  )
                }),
                index < overrides.length - 1 && React.createElement(FormDivider)
              )
            )
      ),

      React.createElement(View, { style: { height: 40 } })
    );
  }
};
