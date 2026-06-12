import { findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";

const UserStore = findByStoreName("UserStore");
const UserProfileStore = findByStoreName("UserProfileStore");
const PresenceStore = findByStoreName("PresenceStore");
const NoteStore = findByStoreName("NoteStore");

let patches: any[] = [];

// Parse note format: override::Display Name|Bio|PFP Link|Status
function getOverride(userId: string) {
    if (!NoteStore) return null;
    
    const note = NoteStore.getNote(userId);
    if (!note || !note.startsWith("override::")) return null;

    // Remove "override::" prefix and split by |
    const content = note.slice("override::".length);
    const parts = content.split("|").map((p: string) => p.trim());

    return {
        displayName: parts[0] || null,
        bio: parts[1] || null,
        pfp: parts[2] || null,
        status: parts[3] || null,
    };
}

export default {
    onLoad: () => {
        // Patch UserStore.getUser - modifies avatar and display name
        if (UserStore && typeof UserStore.getUser === "function") {
            patches.push(
                after("getUser", UserStore, (args, user) => {
                    if (!user || !user.id) return user;
                    
                    const override = getOverride(user.id);
                    if (!override) return user;

                    // Override display name (globalName is the display name in new Discord)
                    if (override.displayName) {
                        user.globalName = override.displayName;
                    }

                    // Override avatar - set the avatar property directly
                    if (override.pfp) {
                        user.avatar = override.pfp;
                        // Also try to override getAvatarURL if it exists
                        if (user.getAvatarURL) {
                            const original = user.getAvatarURL.bind(user);
                            user.getAvatarURL = function(...args: any[]) {
                                return override.pfp;
                            };
                        }
                    }

                    return user;
                })
            );
        }

        // Patch UserProfileStore.getUserProfile - modifies bio
        if (UserProfileStore && typeof UserProfileStore.getUserProfile === "function") {
            patches.push(
                after("getUserProfile", UserProfileStore, (args, profile) => {
                    if (!profile) return profile;
                    
                    const userId = args[0];
                    const override = getOverride(userId);
                    if (!override || !override.bio) return profile;

                    profile.bio = override.bio;
                    return profile;
                })
            );
        }

        // Patch PresenceStore.getPresence - modifies custom status
        if (PresenceStore && typeof PresenceStore.getPresence === "function") {
            patches.push(
                after("getPresence", PresenceStore, (args, presence) => {
                    const userId = args[0];
                    const override = getOverride(userId);
                    
                    if (!override || !override.status) return presence;

                    // Ensure presence object exists
                    if (!presence) presence = { activities: [] };
                    if (!presence.activities) presence.activities = [];

                    // Find or create custom status activity (type 4)
                    let customStatus = presence.activities.find((a: any) => a.type === 4);
                    if (!customStatus) {
                        customStatus = { type: 4, name: "Custom Status", id: "custom" };
                        presence.activities.push(customStatus);
                    }
                    
                    customStatus.state = override.status;
                    return presence;
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

    // Minimal settings page - just shows instructions
    settings: () => {
        return React.createElement(
            (ReactNative as any).View,
            { style: { flex: 1, padding: 20, backgroundColor: "#1e1f22" } },
            React.createElement(
                (ReactNative as any).Text,
                { style: { color: "#dcddde", fontSize: 18, fontWeight: "bold", marginBottom: 16 } },
                "FakeProfile"
            ),
            React.createElement(
                (ReactNative as any).Text,
                { style: { color: "#b9bbbe", fontSize: 14, lineHeight: 22 } },
                "Add a note to any user with this format:\n\n" +
                "override::Display Name|Bio text here|https://image.url|Custom status\n\n" +
                "Example:\n" +
                "override::Cool Name|Hello world|https://i.imgur.com/abc.png|Playing games\n\n" +
                "Leave fields empty if not needed:\n" +
                "override::|Bio only||\n\n" +
                "All changes are client-side only."
            )
        );
    }
};
