import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { useState, useCallback } from "react";
import { 
  Forms, 
  TextInput, 
  Button, 
  ScrollView, 
  View, 
  Text,
  ReactNative as RN 
} from "@vendetta/ui/components";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";

const { FormSection, FormRow, FormSwitch, FormDivider } = Forms;
const { TextInput: FormTextInput } = TextInput;

// Default storage structure
const defaultStorage = {
  overrides: [] as Array<{
    userId: string;
    avatarUrl: string;
    displayName: string;
    bio: string;
    status: string;
    bannerUrl: string;
    pronouns: string;
  }>
};

// Initialize storage if empty
if (!storage.overrides) {
  storage.overrides = defaultStorage.overrides;
}

// Get UserStore to patch user data
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

      // Create modified user object
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

    // Patch getUserStatus if available for custom status
    try {
      const StatusStore = findByStoreName("PresenceStore");
      const statusPatch = after("getState", StatusStore, (args, ret) => {
        // This is a more complex patch - we modify the state object
        const originalGetStatus = ret.getStatus;
        if (originalGetStatus) {
          ret.getStatus = (userId: string) => {
            const override = getOverride(userId);
            if (override?.status) {
              return {
                ...originalGetStatus(userId),
                status: override.status,
                customStatus: { name: override.status }
              };
            }
            return originalGetStatus(userId);
          };
        }
        return ret;
      });
      patches.push(statusPatch);
    } catch (e) {
      console.log("[FakeProfile] Status patch failed:", e);
    }

    patches.push(userPatch, profilePatch);
  },

  onUnload: () => {
    // Unpatch everything
    patches.forEach(p => p?.());
    patches = [];
  },

  // Settings page component
  settings: () => {
    const [overrides, setOverrides] = useState(storage.overrides || []);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    
    // Temporary state for new/edit entry
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
        // Edit existing
        newOverrides[editingIndex] = { ...formData };
      } else {
        // Add new
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
      const newOverrides = overrides.filter((_, i) => i !== index);
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

    return (
      <ScrollView style={{ flex: 1 }}>
        {/* Form Section */}
        <FormSection title={editingIndex !== null ? "Edit Profile Override" : "Add New Profile Override"}>
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={{ color: "#b9bbbe", fontSize: 12, marginBottom: 4 }}>
              User ID (required):
            </Text>
            <RN.TextInput
              style={{
                backgroundColor: "#2f3136",
                color: "#dcddde",
                padding: 12,
                borderRadius: 8,
                fontSize: 14
              }}
              placeholder="123456789012345678"
              placeholderTextColor="#72767d"
              value={formData.userId}
              onChangeText={(text: string) => setFormData(prev => ({ ...prev, userId: text }))}
              editable={editingIndex === null}
            />

            <Text style={{ color: "#b9bbbe", fontSize: 12, marginBottom: 4 }}>
              Avatar URL:
            </Text>
            <RN.TextInput
              style={{
                backgroundColor: "#2f3136",
                color: "#dcddde",
                padding: 12,
                borderRadius: 8,
                fontSize: 14
              }}
              placeholder="https://example.com/avatar.png"
              placeholderTextColor="#72767d"
              value={formData.avatarUrl}
              onChangeText={(text: string) => setFormData(prev => ({ ...prev, avatarUrl: text }))}
            />

            <Text style={{ color: "#b9bbbe", fontSize: 12, marginBottom: 4 }}>
              Banner URL:
            </Text>
            <RN.TextInput
              style={{
                backgroundColor: "#2f3136",
                color: "#dcddde",
                padding: 12,
                borderRadius: 8,
                fontSize: 14
              }}
              placeholder="https://example.com/banner.png"
              placeholderTextColor="#72767d"
              value={formData.bannerUrl}
              onChangeText={(text: string) => setFormData(prev => ({ ...prev, bannerUrl: text }))}
            />

            <Text style={{ color: "#b9bbbe", fontSize: 12, marginBottom: 4 }}>
              Display Name:
            </Text>
            <RN.TextInput
              style={{
                backgroundColor: "#2f3136",
                color: "#dcddde",
                padding: 12,
                borderRadius: 8,
                fontSize: 14
              }}
              placeholder="Custom Display Name"
              placeholderTextColor="#72767d"
              value={formData.displayName}
              onChangeText={(text: string) => setFormData(prev => ({ ...prev, displayName: text }))}
            />

            <Text style={{ color: "#b9bbbe", fontSize: 12, marginBottom: 4 }}>
              Bio / About Me:
            </Text>
            <RN.TextInput
              style={{
                backgroundColor: "#2f3136",
                color: "#dcddde",
                padding: 12,
                borderRadius: 8,
                fontSize: 14,
                height: 80,
                textAlignVertical: "top"
              }}
              placeholder="Custom bio text..."
              placeholderTextColor="#72767d"
              value={formData.bio}
              onChangeText={(text: string) => setFormData(prev => ({ ...prev, bio: text }))}
              multiline
              numberOfLines={4}
            />

            <Text style={{ color: "#b9bbbe", fontSize: 12, marginBottom: 4 }}>
              Custom Status:
            </Text>
            <RN.TextInput
              style={{
                backgroundColor: "#2f3136",
                color: "#dcddde",
                padding: 12,
                borderRadius: 8,
                fontSize: 14
              }}
              placeholder="Playing something..."
              placeholderTextColor="#72767d"
              value={formData.status}
              onChangeText={(text: string) => setFormData(prev => ({ ...prev, status: text }))}
            />

            <Text style={{ color: "#b9bbbe", fontSize: 12, marginBottom: 4 }}>
              Pronouns:
            </Text>
            <RN.TextInput
              style={{
                backgroundColor: "#2f3136",
                color: "#dcddde",
                padding: 12,
                borderRadius: 8,
                fontSize: 14
              }}
              placeholder="they/them"
              placeholderTextColor="#72767d"
              value={formData.pronouns}
              onChangeText={(text: string) => setFormData(prev => ({ ...prev, pronouns: text }))}
            />

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  text={editingIndex !== null ? "Save Changes" : "Add Profile"}
                  color="#5865f2"
                  onPress={handleAdd}
                />
              </View>
              {editingIndex !== null && (
                <View style={{ flex: 1 }}>
                  <Button
                    text="Cancel"
                    color="#ed4245"
                    onPress={handleCancel}
                  />
                </View>
              )}
            </View>
          </View>
        </FormSection>

        <FormDivider />

        {/* List of existing overrides */}
        <FormSection title={`Active Overrides (${overrides.length})`}>
          {overrides.length === 0 ? (
            <Text style={{ 
              color: "#72767d", 
              textAlign: "center", 
              padding: 24,
              fontSize: 14 
            }}>
              No profile overrides yet. Add one above!
            </Text>
          ) : (
            overrides.map((override: any, index: number) => (
              <View key={index}>
                <FormRow
                  label={`${override.displayName || "Unknown"} (${override.userId})`}
                  subLabel={[
                    override.avatarUrl && "Avatar",
                    override.bannerUrl && "Banner", 
                    override.bio && "Bio",
                    override.status && "Status",
                    override.pronouns && "Pronouns"
                  ].filter(Boolean).join(", ") || "No modifications"}
                  leading={
                    override.avatarUrl ? (
                      <RN.Image
                        source={{ uri: override.avatarUrl }}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                      />
                    ) : (
                      <RN.View style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20,
                        backgroundColor: "#36393f",
                        justifyContent: "center",
                        alignItems: "center"
                      }}>
                        <Text style={{ color: "#72767d", fontSize: 16 }}>
                          ?
                        </Text>
                      </RN.View>
                    )
                  }
                  trailing={
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Button
                        text="Edit"
                        size="small"
                        color="#5865f2"
                        onPress={() => handleEdit(index)}
                      />
                      <Button
                        text="Remove"
                        size="small"
                        color="#ed4245"
                        onPress={() => handleRemove(index)}
                      />
                    </View>
                  }
                />
                {index < overrides.length - 1 && <FormDivider />}
              </View>
            ))
          )}
        </FormSection>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }
};
