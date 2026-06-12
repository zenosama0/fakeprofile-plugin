(function(){"use strict";(function(exports, metro, patcher, plugin){
const {findByStoreName} = metro;
const {after} = patcher;
const {storage} = plugin;
const {ReactNative} = metro.common;
const {Forms} = vendetta.ui.components;
const {getAssetIDByName} = vendetta.ui.assets;
const {useProxy} = vendetta.storage;

const {ScrollView, View, Text, TextInput, Image, TouchableOpacity} = ReactNative;
const {FormSection, FormRow, FormDivider} = Forms;
const React = window.React;

// Storage init
if (!storage.overrides) {
    storage.overrides = [];
}

function getOverride(userId) {
    return storage.overrides.find(function(o) { return o.userId === userId; });
}

var patches = [];

exports.default = {
    onLoad: function() {
        var UserStore = findByStoreName("UserStore");
        var UserProfileStore = findByStoreName("UserProfileStore");
        var PresenceStore = findByStoreName("PresenceStore");

        if (UserStore) {
            var userPatch = after("getUser", UserStore, function(args, ret) {
                if (!ret || !ret.id) return ret;
                var override = getOverride(ret.id);
                if (!override) return ret;
                var modified = Object.assign({}, ret);
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

        if (UserProfileStore) {
            var profilePatch = after("getUserProfile", UserProfileStore, function(args, ret) {
                if (!ret) return ret;
                var userId = args[0];
                var override = getOverride(userId);
                if (!override) return ret;
                var modified = Object.assign({}, ret);
                if (override.bio) modified.bio = override.bio;
                if (override.pronouns) modified.pronouns = override.pronouns;
                return modified;
            });
            patches.push(profilePatch);
        }

        if (PresenceStore) {
            try {
                var statusPatch = after("getState", PresenceStore, function(args, ret) {
                    if (!ret || typeof ret.getStatus !== "function") return ret;
                    var origGetStatus = ret.getStatus;
                    ret.getStatus = function(userId) {
                        var override = getOverride(userId);
                        if (override && override.status) {
                            var original = origGetStatus(userId);
                            if (original && typeof original === "object") {
                                return Object.assign({}, original, {status: override.status});
                            }
                            return {status: override.status};
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

    onUnload: function() {
        patches.forEach(function(p) {
            try { if (p) p(); } catch (e) {}
        });
        patches = [];
    },

    settings: function() {
        useProxy(storage);

        var _React_useState = React.useState;
        var editingIndexState = _React_useState(null);
        var editingIndex = editingIndexState[0];
        var setEditingIndex = editingIndexState[1];

        var formState = _React_useState({
            userId: "",
            avatarUrl: "",
            displayName: "",
            bio: "",
            status: "",
            bannerUrl: "",
            pronouns: ""
        });
        var formData = formState[0];
        var setFormData = formState[1];

        var overrides = storage.overrides || [];

        var updateForm = function(key, value) {
            setFormData(function(prev) {
                var next = Object.assign({}, prev);
                next[key] = value;
                return next;
            });
        };

        var clearForm = function() {
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

        var handleSave = function() {
            if (!formData.userId || !formData.userId.trim()) return;
            var newOverrides = overrides.slice();
            var entry = {
                userId: formData.userId.trim(),
                avatarUrl: (formData.avatarUrl || "").trim(),
                displayName: (formData.displayName || "").trim(),
                bio: (formData.bio || "").trim(),
                status: (formData.status || "").trim(),
                bannerUrl: (formData.bannerUrl || "").trim(),
                pronouns: (formData.pronouns || "").trim()
            };

            if (editingIndex !== null && editingIndex >= 0 && editingIndex < newOverrides.length) {
                newOverrides[editingIndex] = entry;
            } else {
                var existingIdx = newOverrides.findIndex(function(o) { return o.userId === entry.userId; });
                if (existingIdx >= 0) {
                    newOverrides[existingIdx] = entry;
                } else {
                    newOverrides.push(entry);
                }
            }
            storage.overrides = newOverrides;
            clearForm();
        };

        var handleEdit = function(index) {
            var o = overrides[index];
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

        var handleRemove = function(index) {
            var newOverrides = overrides.filter(function(_, i) { return i !== index; });
            storage.overrides = newOverrides;
            if (editingIndex === index) {
                clearForm();
            }
        };

        var inputStyle = {
            backgroundColor: "#2f3136",
            color: "#dcddde",
            padding: 12,
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 12
        };

        var labelStyle = {
            color: "#b9bbbe",
            fontSize: 12,
            marginBottom: 4
        };

        var btnStyle = {
            backgroundColor: "#5865f2",
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            marginRight: 8
        };

        var btnDangerStyle = {
            backgroundColor: "#ed4245",
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            flex: 1
        };

        var btnSmallStyle = {
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 6,
            marginLeft: 8
        };

        var isEditing = editingIndex !== null;

        // Build form section children
        var formChildren = [
            React.createElement(View, {key: "form-container", style: {padding: 16}}, [
                // User ID
                React.createElement(Text, {key: "label-uid", style: labelStyle}, "User ID (required):"),
                React.createElement(TextInput, {
                    key: "input-uid",
                    style: inputStyle,
                    placeholder: "123456789012345678",
                    placeholderTextColor: "#72767d",
                    value: formData.userId,
                    onChangeText: function(text) { updateForm("userId", text); },
                    editable: !isEditing
                }),
                // Avatar
                React.createElement(Text, {key: "label-avatar", style: labelStyle}, "Avatar URL:"),
                React.createElement(TextInput, {
                    key: "input-avatar",
                    style: inputStyle,
                    placeholder: "https://example.com/avatar.png",
                    placeholderTextColor: "#72767d",
                    value: formData.avatarUrl,
                    onChangeText: function(text) { updateForm("avatarUrl", text); }
                }),
                // Banner
                React.createElement(Text, {key: "label-banner", style: labelStyle}, "Banner URL:"),
                React.createElement(TextInput, {
                    key: "input-banner",
                    style: inputStyle,
                    placeholder: "https://example.com/banner.png",
                    placeholderTextColor: "#72767d",
                    value: formData.bannerUrl,
                    onChangeText: function(text) { updateForm("bannerUrl", text); }
                }),
                // Display Name
                React.createElement(Text, {key: "label-name", style: labelStyle}, "Display Name:"),
                React.createElement(TextInput, {
                    key: "input-name",
                    style: inputStyle,
                    placeholder: "Custom Display Name",
                    placeholderTextColor: "#72767d",
                    value: formData.displayName,
                    onChangeText: function(text) { updateForm("displayName", text); }
                }),
                // Bio
                React.createElement(Text, {key: "label-bio", style: labelStyle}, "Bio / About Me:"),
                React.createElement(TextInput, {
                    key: "input-bio",
                    style: Object.assign({}, inputStyle, {height: 80, textAlignVertical: "top"}),
                    placeholder: "Custom bio text...",
                    placeholderTextColor: "#72767d",
                    value: formData.bio,
                    onChangeText: function(text) { updateForm("bio", text); },
                    multiline: true,
                    numberOfLines: 4
                }),
                // Status
                React.createElement(Text, {key: "label-status", style: labelStyle}, "Custom Status:"),
                React.createElement(TextInput, {
                    key: "input-status",
                    style: inputStyle,
                    placeholder: "Playing something...",
                    placeholderTextColor: "#72767d",
                    value: formData.status,
                    onChangeText: function(text) { updateForm("status", text); }
                }),
                // Pronouns
                React.createElement(Text, {key: "label-pronouns", style: labelStyle}, "Pronouns:"),
                React.createElement(TextInput, {
                    key: "input-pronouns",
                    style: inputStyle,
                    placeholder: "they/them",
                    placeholderTextColor: "#72767d",
                    value: formData.pronouns,
                    onChangeText: function(text) { updateForm("pronouns", text); }
                }),
                // Buttons
                React.createElement(View, {key: "btn-row", style: {flexDirection: "row", marginTop: 8}}, [
                    React.createElement(TouchableOpacity, {
                        key: "btn-save",
                        style: btnStyle,
                        onPress: handleSave,
                        activeOpacity: 0.8
                    }, React.createElement(Text, {style: {color: "#fff", fontSize: 14, fontWeight: "600"}},
                        isEditing ? "Save Changes" : "Add Profile"
                    )),
                    isEditing ? React.createElement(TouchableOpacity, {
                        key: "btn-cancel",
                        style: btnDangerStyle,
                        onPress: clearForm,
                        activeOpacity: 0.8
                    }, React.createElement(Text, {style: {color: "#fff", fontSize: 14, fontWeight: "600"}}, "Cancel")) : null
                ])
            ])
        ];

        // Build overrides list
        var listChildren;
        if (overrides.length === 0) {
            listChildren = React.createElement(Text, {
                key: "empty",
                style: {color: "#72767d", textAlign: "center", padding: 24, fontSize: 14}
            }, "No profile overrides yet. Add one above!");
        } else {
            listChildren = overrides.map(function(override, index) {
                var activeFields = [
                    override.avatarUrl && "Avatar",
                    override.bannerUrl && "Banner",
                    override.displayName && "Display Name",
                    override.bio && "Bio",
                    override.status && "Status",
                    override.pronouns && "Pronouns"
                ].filter(Boolean).join(", ") || "No modifications";

                var leadingEl = override.avatarUrl
                    ? React.createElement(Image, {
                        source: {uri: override.avatarUrl},
                        style: {width: 40, height: 40, borderRadius: 20}
                    })
                    : React.createElement(View, {
                        style: {width: 40, height: 40, borderRadius: 20, backgroundColor: "#36393f", justifyContent: "center", alignItems: "center"}
                    }, React.createElement(Text, {style: {color: "#72767d", fontSize: 16}}, "?"));

                var trailingEl = React.createElement(View, {style: {flexDirection: "row"}}, [
                    React.createElement(TouchableOpacity, {
                        key: "btn-edit",
                        style: Object.assign({}, btnSmallStyle, {backgroundColor: "#5865f2"}),
                        onPress: function() { handleEdit(index); },
                        activeOpacity: 0.8
                    }, React.createElement(Text, {style: {color: "#fff", fontSize: 12}}, "Edit")),
                    React.createElement(TouchableOpacity, {
                        key: "btn-remove",
                        style: Object.assign({}, btnSmallStyle, {backgroundColor: "#ed4245"}),
                        onPress: function() { handleRemove(index); },
                        activeOpacity: 0.8
                    }, React.createElement(Text, {style: {color: "#fff", fontSize: 12}}, "Remove"))
                ]);

                return React.createElement(View, {key: index}, [
                    React.createElement(FormRow, {
                        key: "row",
                        label: (override.displayName || "Unknown") + " (" + override.userId + ")",
                        subLabel: activeFields,
                        leading: leadingEl,
                        trailing: trailingEl
                    }),
                    index < overrides.length - 1 ? React.createElement(FormDivider, {key: "div"}) : null
                ]);
            });
        }

        return React.createElement(ScrollView, {style: {flex: 1}}, [
            React.createElement(FormSection, {
                key: "form-section",
                title: isEditing ? "Edit Profile Override" : "Add New Profile Override"
            }, formChildren),
            React.createElement(FormDivider, {key: "div-main"}),
            React.createElement(FormSection, {
                key: "list-section",
                title: "Active Overrides (" + overrides.length + ")"
            }, listChildren),
            React.createElement(View, {key: "spacer", style: {height: 40}})
        ]);
    }
};

Object.defineProperty(exports, "__esModule", {value: true});
return exports;
})({}, vendetta.metro, vendetta.patcher, vendetta.plugin)})();
