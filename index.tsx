import { findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";

const UserStore = findByStoreName("UserStore");
const UserProfileStore = findByStoreName("UserProfileStore");
const PresenceStore = findByStoreName("PresenceStore");
const NoteStore = findByStoreName("NoteStore");

let patches: any[] = [];

function getOverride(userId: string) {
    try {
        if (!NoteStore || typeof NoteStore.getNote !== "function") return null;
        
        const note = NoteStore.getNote(userId);
        if (!note || typeof note !== "string" || !note.startsWith("override::")) return null;

        const content = note.slice("override::".length);
        const parts = content.split("|").map((p: string) => p.trim());

        return {
            displayName: parts[0] || null,
            bio: parts[1] || null,
            pfp: parts[2] || null,
            status: parts[3] || null,
        };
    } catch (e) {
        console.log("[FakeProfile] getOverride error:", e);
        return null;
    }
}

export default {
    onLoad: () => {
        // Patch UserStore.getUser - display name only (avatar handled separately)
        if (UserStore && typeof UserStore.getUser === "function") {
            patches.push(
                after("getUser", UserStore, (args, user) => {
                    try {
                        if (!user || !user.id) return user;
                        
                        const override = getOverride(user.id);
                        if (!override) return user;

                        if (override.displayName) {
                            user.globalName = override.displayName;
                        }

                        // Set avatar hash to URL - Discord RN may use it directly in some places
                        if (override.pfp) {
                            user.avatar = override.pfp;
                        }

                        return user;
                    } catch (e) {
                        console.log("[FakeProfile] getUser patch error:", e);
                        return user;
                    }
                })
            );
        }

        // Patch UserProfileStore.getUserProfile - bio
        if (UserProfileStore && typeof UserProfileStore.getUserProfile === "function") {
            patches.push(
                after("getUserProfile", UserProfileStore, (args, profile) => {
                    try {
                        if (!profile) return profile;
                        
                        const userId = args[0];
                        const override = getOverride(userId);
                        if (!override || !override.bio) return profile;

                        profile.bio = override.bio;
                        return profile;
                    } catch (e) {
                        console.log("[FakeProfile] getUserProfile patch error:", e);
                        return profile;
                    }
                })
            );
        }

        // Patch PresenceStore.getPresence - custom status
        if (PresenceStore && typeof PresenceStore.getPresence === "function") {
            patches.push(
                after("getPresence", PresenceStore, (args, presence) => {
                    try {
                        const userId = args[0];
                        const override = getOverride(userId);
                        
                        if (!override || !override.status) return presence;

                        if (!presence) presence = { activities: [] };
                        if (!presence.activities) presence.activities = [];

                        let customStatus = presence.activities.find((a: any) => a.type === 4);
                        if (!customStatus) {
                            customStatus = { type: 4, name: "Custom Status", id: "custom" };
                            presence.activities.push(customStatus);
                        }
                        
                        customStatus.state = override.status;
                        return presence;
                    } catch (e) {
                        console.log("[FakeProfile] getPresence patch error:", e);
                        return presence;
                    }
                })
            );
        }
    },

    onUnload: () => {
        for (const unpatch of patches) {
            try { unpatch(); } catch (e) {}
        }
        patches = [];
    },

    settings: () => {
        const RN = (typeof ReactNative !== "undefined" ? ReactNative : {}) as any;
        const { View, Text } = RN;
        
        if (!View || !Text) return null;

        return React.createElement(View, { style: { flex: 1, padding: 20, backgroundColor: "#1e1f22" } },
            React.createElement(Text, { style: { color: "#dcddde", fontSize: 18, fontWeight: "bold", marginBottom: 16 } }, "FakeProfile"),
            React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 14, lineHeight: 22 } },
                "Add a note to any user with this format:\n\n" +
                "override::Display Name|Bio|PFP URL|Status\n\n" +
                "Example:\n" +
                "override::Cool Name|Hello world|https://i.imgur.com/abc.png|Playing games\n\n" +
                "Leave fields empty if not needed:\n" +
                "override::|Bio only||\n\n" +
                "All changes are client-side only."
            )
        );
    }
};
