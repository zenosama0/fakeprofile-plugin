import { metro } from "@vendetta";
import { after } from "@vendetta/patcher";

const UserStore = metro.findByStoreName("UserStore");
const UserProfileStore = metro.findByStoreName("UserProfileStore");
const PresenceStore = metro.findByStoreName("PresenceStore");
const NoteStore = metro.findByStoreName("NoteStore");

let patches = [];

// Extracts your secret note format
function getOverride(id) {
    if (!NoteStore) return null;
    const note = NoteStore.getNote(id);
    if (!note || !note.startsWith("override::")) return null;

    const parts = note.replace("override::", "").split("|");
    return {
        displayName: parts[0]?.trim() || null,
        bio: parts[1]?.trim() || null,
        pfp: parts[2]?.trim() || null,
        status: parts[3]?.trim() || null,
    };
}

export default {
    onLoad: () => {
        if (UserStore) {
            patches.push(
                after("getUser", UserStore, ([id], user) => {
                    if (!user) return user;
                    const match = getOverride(id);
                    if (match) {
                        if (match.displayName && match.displayName !== "") user.globalName = match.displayName;
                        if (match.pfp && match.pfp !== "") user.getAvatarURL = () => match.pfp;
                    }
                    return user;
                })
            );
        }

        if (UserProfileStore) {
            patches.push(
                after("getUserProfile", UserProfileStore, ([id], profile) => {
                    if (!profile) return profile;
                    const match = getOverride(id);
                    if (match && match.bio && match.bio !== "") profile.bio = match.bio;
                    return profile;
                })
            );
        }

        if (PresenceStore) {
            patches.push(
                after("getPresence", PresenceStore, ([id], presence) => {
                    const match = getOverride(id);
                    if (match && match.status && match.status !== "") {
                        if (!presence) presence = { activities: [] };
                        let customStatus = presence.activities?.find(a => a.type === 4);
                        if (!customStatus) {
                            customStatus = { type: 4, name: "Custom Status", id: "custom" };
                            presence.activities = presence.activities || [];
                            presence.activities.push(customStatus);
                        }
                        customStatus.state = match.status;
                    }
                    return presence;
                })
            );
        }
    },
    onUnload: () => {
        for (const unpatch of patches) unpatch();
        patches = [];
    }
};
