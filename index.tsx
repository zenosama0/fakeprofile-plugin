import { findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { React, ReactNative } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { getAssetIDByName } from "@vendetta/ui/assets";

const { ScrollView, View, Text, TextInput, Image, TouchableOpacity } = ReactNative;
const { FormSection, FormRow, FormDivider } = Forms;

// --- Storage init ---
if (!storage.overrides) {
    storage.overrides = [] as any[];
}

// Helper
function getOverride(userId: string) {
    return storage.overrides?.find((o: any) => o.userId === userId);
}

let patches: any[] = [];

export default {
    onLoad: () => {
        // Get stores inside onLoad to ensure they're available
        const UserStore = findByStoreName("UserStore");
        const UserProfileStore = findByStoreName("UserProfileStore");
        const PresenceStore = findByStoreName("PresenceStore");

        // Patch UserStore.getUser
        if (UserStore) {
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
        if (UserProfileStore) {
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
        if (PresenceStore) {
            try {
                const statusPatch = after("getState", PresenceStore, (args, ret) => {
                    if (!ret || typeof ret.getStatus !== "function") return ret;
                    const origGetStatus = ret.getStatus;
                    ret.getStatus = (userId: string) => {
                        const override = getOverride(userId);
                        if (override?.status) {
                            const original = origGetStatus(userId);
                            if (original && typeof original === "object") {
                                return { ...original, status: override.status };
                            }
                            return { status: override.status, customStatus: { name: override.status } };
                        }
                        return origGetStatus(userId);
                    };
                    return ret;
                });
                patches.push(statusPatch);
            } catch (e) {
                console.log("[FakeProfile] PresenceStore patch failed:", e);
            }
        }
    },

    onUnload: () => {
        patches.forEach((p) => {
            try { p?.(); } catch (e) { }
        });
        patches = [];
    },

    settings: () => {
        useProxy(storage);

        const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
        const [formData, setFormData] = React.useState({
            userId: "",
            avatarUrl: "",
            displayName: "",
            bio: "",
            status: "",
            bannerUrl: "",
            pronouns: ""
        });

        const overrides = storage.overrides || [];

        const updateForm = (key: string, value: string) => {
            setFormData((prev: any) => ({ ...prev, [key]: value }));
        };

        const clearForm = () => {
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
        };

        const handleSave = () => {
            if (!formData.userId?.trim()) return;

            const newOverrides = [...overrides];
            const entry = {
                userId: formData.userId.trim(),
                avatarUrl: formData.avatarUrl?.trim() || "",
                displayName: formData.displayName?.trim() || "",
                bio: formData.bio?.trim() || "",
                status: formData.status?.trim() || "",
                bannerUrl: formData.bannerUrl?.trim() || "",
                pronouns: formData.pronouns?.trim() || ""
            };

            if (editingIndex !== null && editingIndex >= 0 && editingIndex < newOverrides.length) {
                newOverrides[editingIndex] = entry;
            } else {
                // Check if userId already exists when adding new
                const existingIdx = newOverrides.findIndex((o: any) => o.userId === entry.userId);
                if (existingIdx >= 0) {
                    newOverrides[existingIdx] = entry;
                } else {
                    newOverrides.push(entry);
                }
            }

            storage.overrides = newOverrides;
            clearForm();
        };

        const handleEdit = (index: number) => {
            const o = overrides[index];
            if (!o) return;
            setEditingIndex(index);
            setFormData({
                userId: o.userId || "",
                avatarUrl: o.avatarUrl || "",
                displayName: o.displayName || "",
                bio: o.bio || "",
                status: o.status || "",
                bannerUrl: o.bannerUrl || "",
                pronouns: o.pronouns || ""
            });
        };

        const handleRemove = (index: number) => {
            const newOverrides = overrides.filter((_: any, i: number) => i !== index);
            storage.overrides = newOverrides;
            if (editingIndex === index) {
                clearForm();
            }
        };

        const inputStyle = {
            backgroundColor: "#2f3136",
            color: "#dcddde",
            padding: 12,
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 12
        };

        const labelStyle = {
            color: "#b9bbbe",
            fontSize: 12,
            marginBottom: 4
        };

        const btnStyle = {
            backgroundColor: "#5865f2",
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            alignItems: "center" as const,
            justifyContent: "center" as const,
            flex: 1,
            marginRight: 8
        };

        const btnDangerStyle = {
            ...btnStyle,
            backgroundColor: "#ed4245",
            marginRight: 0
        };

        const btnSmallStyle = {
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 6,
            marginLeft: 8
        };

        const isEditing = editingIndex !== null;

        return (
            <ScrollView style={{ flex: 1 }}>
                {/* Add/Edit Form */}
                <FormSection title={isEditing ? "Edit Profile Override" : "Add New Profile Override"}>
                    <View style={{ padding: 16 }}>
                        <Text style={labelStyle}>User ID (required):</Text>
                        <TextInput
                            style={inputStyle}
                            placeholder="123456789012345678"
                            placeholderTextColor="#72767d"
                            value={formData.userId}
                            onChangeText={(text: string) => updateForm("userId", text)}
                            editable={!isEditing}
                        />

                        <Text style={labelStyle}>Avatar URL:</Text>
                        <TextInput
                            style={inputStyle}
                            placeholder="https://example.com/avatar.png"
                            placeholderTextColor="#72767d"
                            value={formData.avatarUrl}
                            onChangeText={(text: string) => updateForm("avatarUrl", text)}
                        />

                        <Text style={labelStyle}>Banner URL:</Text>
                        <TextInput
                            style={inputStyle}
                            placeholder="https://example.com/banner.png"
                            placeholderTextColor="#72767d"
                            value={formData.bannerUrl}
                            onChangeText={(text: string) => updateForm("bannerUrl", text)}
                        />

                        <Text style={labelStyle}>Display Name:</Text>
                        <TextInput
                            style={inputStyle}
                            placeholder="Custom Display Name"
                            placeholderTextColor="#72767d"
                            value={formData.displayName}
                            onChangeText={(text: string) => updateForm("displayName", text)}
                        />

                        <Text style={labelStyle}>Bio / About Me:</Text>
                        <TextInput
                            style={[inputStyle, { height: 80, textAlignVertical: "top" }]}
                            placeholder="Custom bio text..."
                            placeholderTextColor="#72767d"
                            value={formData.bio}
                            onChangeText={(text: string) => updateForm("bio", text)}
                            multiline={true}
                            numberOfLines={4}
                        />

                        <Text style={labelStyle}>Custom Status:</Text>
                        <TextInput
                            style={inputStyle}
                            placeholder="Playing something..."
                            placeholderTextColor="#72767d"
                            value={formData.status}
                            onChangeText={(text: string) => updateForm("status", text)}
                        />

                        <Text style={labelStyle}>Pronouns:</Text>
                        <TextInput
                            style={inputStyle}
                            placeholder="they/them"
                            placeholderTextColor="#72767d"
                            value={formData.pronouns}
                            onChangeText={(text: string) => updateForm("pronouns", text)}
                        />

                        {/* Buttons */}
                        <View style={{ flexDirection: "row", marginTop: 8 }}>
                            <TouchableOpacity style={btnStyle} onPress={handleSave} activeOpacity={0.8}>
                                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                                    {isEditing ? "Save Changes" : "Add Profile"}
                                </Text>
                            </TouchableOpacity>
                            {isEditing && (
                                <TouchableOpacity style={btnDangerStyle} onPress={clearForm} activeOpacity={0.8}>
                                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                                        Cancel
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </FormSection>

                <FormDivider />

                {/* Active Overrides List */}
                <FormSection title={`Active Overrides (${overrides.length})`}>
                    {overrides.length === 0 ? (
                        <Text style={{ color: "#72767d", textAlign: "center", padding: 24, fontSize: 14 }}>
                            No profile overrides yet. Add one above!
                        </Text>
                    ) : (
                        overrides.map((override: any, index: number) => {
                            const activeFields = [
                                override.avatarUrl && "Avatar",
                                override.bannerUrl && "Banner",
                                override.displayName && "Display Name",
                                override.bio && "Bio",
                                override.status && "Status",
                                override.pronouns && "Pronouns"
                            ].filter(Boolean).join(", ") || "No modifications";

                            return (
                                <View key={index}>
                                    <FormRow
                                        label={`${override.displayName || "Unknown"} (${override.userId})`}
                                        subLabel={activeFields}
                                        leading={
                                            override.avatarUrl ? (
                                                <Image
                                                    source={{ uri: override.avatarUrl }}
                                                    style={{ width: 40, height: 40, borderRadius: 20 }}
                                                />
                                            ) : (
                                                <View style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 20,
                                                    backgroundColor: "#36393f",
                                                    justifyContent: "center",
                                                    alignItems: "center"
                                                }}>
                                                    <Text style={{ color: "#72767d", fontSize: 16 }}>?</Text>
                                                </View>
                                            )
                                        }
                                        trailing={
                                            <View style={{ flexDirection: "row" }}>
                                                <TouchableOpacity
                                                    style={[btnSmallStyle, { backgroundColor: "#5865f2" }]}
                                                    onPress={() => handleEdit(index)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={{ color: "#fff", fontSize: 12 }}>Edit</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[btnSmallStyle, { backgroundColor: "#ed4245" }]}
                                                    onPress={() => handleRemove(index)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={{ color: "#fff", fontSize: 12 }}>Remove</Text>
                                                </TouchableOpacity>
                                            </View>
                                        }
                                    />
                                    {index < overrides.length - 1 && <FormDivider />}
                                </View>
                            );
                        })
                    )}
                </FormSection>

                <View style={{ height: 40 }} />
            </ScrollView>
        );
    }
};
