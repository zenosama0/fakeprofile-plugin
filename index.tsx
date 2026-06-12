import { metro } from "@vendetta";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/storage";
import Settings from "./Settings";

const UserStore = metro.findByStoreName("UserStore");
const UserProfileStore = metro.findByStoreName("UserProfileStore");
const PresenceStore = metro.findByStoreName("PresenceStore");

let patches = [];

export default {
    onLoad: () => {
        storage.mutatedProfiles = storage.mutatedProfiles || [];

        if (UserStore) {
            patches.push(
                after("getUser", UserStore, ([id], user) => {
                    if (!user) return user;
                    const match = storage.mutatedProfiles.find(p => p.id === id);
                    if (match) {
                        if (match.displayName) user.globalName = match.displayName;
                        if (match.pfp) user.getAvatarURL = () => match.pfp;
                    }
                    return user;
                })
            );
        }

        if (UserProfileStore) {
            patches.push(
                after("getUserProfile", UserProfileStore, ([id], profile) => {
                    if (!profile) return profile;
                    const match = storage.mutatedProfiles.find(p => p.id === id);
                    if (match && match.bio) profile.bio = match.bio;
                    return profile;
                })
            );
        }

        if (PresenceStore) {
            patches.push(
                after("getPresence", PresenceStore, ([id], presence) => {
                    const match = storage.mutatedProfiles.find(p => p.id === id);
                    if (match && match.status) {
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
    },
    settingsTab: {
        page: Settings
    }
};
