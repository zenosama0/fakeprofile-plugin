import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

// --- React Native components (for any minimal UI if needed) ---
const RN = (typeof ReactNative !== "undefined" ? ReactNative : {}) as any;
const { View, Text } = RN;

// --- Toasts ---
let showToast: any;
try {
  const toasts = findByProps("showToast");
  showToast = toasts?.showToast || ((msg: string) => console.log("[FakeProfile]", msg));
} catch (e) {
  showToast = (msg: string) => console.log("[FakeProfile]", msg);
}

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

function saveOverrides(overrides: any[]) {
  storage.overrides = overrides;
}

let patches: any[] = [];
let commandPatches: any[] = [];

// --- Slash command registration ---
function registerCommands() {
  try {
    const Commands = findByProps("getBuiltInCommands");
    const { registerCommand } = findByProps("registerCommand") || {};
    
    if (!registerCommand) {
      console.log("[FakeProfile] registerCommand not found, trying alternative");
      return;
    }

    // /profile config command
    const configCmd = registerCommand({
      id: "fakeprofile-config",
      name: "profile",
      displayName: "profile",
      description: "Configure fake profile override for a user",
      displayDescription: "Configure fake profile override for a user",
      type: 1, // CHAT_INPUT
      options: [
        {
          name: "config",
          displayName: "config",
          description: "Add or update a profile override",
          displayDescription: "Add or update a profile override",
          type: 1, // SUB_COMMAND
          options: [
            {
              name: "user",
              displayName: "user",
              description: "User ID to override",
              displayDescription: "User ID to override",
              type: 3, // STRING
              required: true
            },
            {
              name: "display_name",
              displayName: "display_name",
              description: "Custom display name",
              displayDescription: "Custom display name",
              type: 3, // STRING
              required: false
            },
            {
              name: "avatar",
              displayName: "avatar",
              description: "Avatar image URL",
              displayDescription: "Avatar image URL",
              type: 3, // STRING
              required: false
            },
            {
              name: "banner",
              displayName: "banner",
              description: "Banner image URL",
              displayDescription: "Banner image URL",
              type: 3, // STRING
              required: false
            },
            {
              name: "bio",
              displayName: "bio",
              description: "Custom bio / about me",
              displayDescription: "Custom bio / about me",
              type: 3, // STRING
              required: false
            },
            {
              name: "status",
              displayName: "status",
              description: "Custom status text",
              displayDescription: "Custom status text",
              type: 3, // STRING
              required: false
            },
            {
              name: "pronouns",
              displayName: "pronouns",
              description: "Custom pronouns",
              displayDescription: "Custom pronouns",
              type: 3, // STRING
              required: false
            }
          ]
        },
        {
          name: "remove",
          displayName: "remove",
          description: "Remove a profile override",
          displayDescription: "Remove a profile override",
          type: 1, // SUB_COMMAND
          options: [
            {
              name: "user",
              displayName: "user",
              description: "User ID to remove override from",
              displayDescription: "User ID to remove override from",
              type: 3, // STRING
              required: true
            }
          ]
        },
        {
          name: "list",
          displayName: "list",
          description: "List all active overrides",
          displayDescription: "List all active overrides",
          type: 1, // SUB_COMMAND
          options: []
        },
        {
          name: "clear",
          displayName: "clear",
          description: "Clear all overrides",
          displayDescription: "Clear all overrides",
          type: 1, // SUB_COMMAND
          options: []
        }
          ]
        }
      ],
      execute: async (args: any, ctx: any) => {
        const subcommand = args[0]?.name;
        
        if (subcommand === "config") {
          const userId = args[0].options?.find((o: any) => o.name === "user")?.value;
          const displayName = args[0].options?.find((o: any) => o.name === "display_name")?.value;
          const avatarUrl = args[0].options?.find((o: any) => o.name === "avatar")?.value;
          const bannerUrl = args[0].options?.find((o: any) => o.name === "banner")?.value;
          const bio = args[0].options?.find((o: any) => o.name === "bio")?.value;
          const status = args[0].options?.find((o: any) => o.name === "status")?.value;
          const pronouns = args[0].options?.find((o: any) => o.name === "pronouns")?.value;

          if (!userId) {
            return { content: "❌ User ID is required." };
          }

          const overrides = [...storage.overrides];
          const existingIndex = overrides.findIndex((o: any) => o.userId === userId);

          const newOverride: any = {
            userId,
            avatarUrl: avatarUrl || "",
            displayName: displayName || "",
            bio: bio || "",
            status: status || "",
            bannerUrl: bannerUrl || "",
            pronouns: pronouns || ""
          };

          if (existingIndex >= 0) {
            overrides[existingIndex] = newOverride;
          } else {
            overrides.push(newOverride);
          }

          saveOverrides(overrides);
          showToast(`Profile override ${existingIndex >= 0 ? "updated" : "added"} for ${userId}`);
          return { content: `✅ Profile override ${existingIndex >= 0 ? "updated" : "added"} for user \`${userId}\`.` };
        }

        if (subcommand === "remove") {
          const userId = args[0].options?.find((o: any) => o.name === "user")?.value;
          if (!userId) {
            return { content: "❌ User ID is required." };
          }

          const newOverrides = storage.overrides.filter((o: any) => o.userId !== userId);
          const removed = newOverrides.length < storage.overrides.length;
          saveOverrides(newOverrides);

          if (removed) {
            showToast(`Profile override removed for ${userId}`);
            return { content: `✅ Profile override removed for user \`${userId}\`.` };
          } else {
            return { content: `⚠️ No override found for user \`${userId}\`.` };
          }
        }

        if (subcommand === "list") {
          const overrides = storage.overrides || [];
          if (overrides.length === 0) {
            return { content: "📋 No active profile overrides." };
          }

          const list = overrides.map((o: any, i: number) => {
            const fields = [
              o.displayName && `Name: ${o.displayName}`,
              o.avatarUrl && `Avatar: ${o.avatarUrl.substring(0, 30)}...`,
              o.bannerUrl && `Banner: ${o.bannerUrl.substring(0, 30)}...`,
              o.bio && `Bio: ${o.bio.substring(0, 30)}...`,
              o.status && `Status: ${o.status}`,
              o.pronouns && `Pronouns: ${o.pronouns}`
            ].filter(Boolean).join(", ") || "No fields set";

            return `${i + 1}. \`${o.userId}\` — ${fields}`;
          }).join("\n");

          return { content: `📋 **Active Overrides (${overrides.length}):**\n${list}` };
        }

        if (subcommand === "clear") {
          const count = storage.overrides.length;
          saveOverrides([]);
          showToast("All profile overrides cleared");
          return { content: `🗑️ Cleared ${count} profile override(s).` };
        }

        return { content: "❌ Unknown subcommand." };
      }
    });

    commandPatches.push(() => {
      try {
        // Unregister command if possible
      } catch (e) {}
    });

  } catch (e) {
    console.log("[FakeProfile] Command registration failed:", e);
  }
}

// --- Alternative: Patch message send to intercept our own command syntax ---
function patchMessageSend() {
  try {
    const MessageActions = findByProps("sendMessage", "receiveMessage");
    if (!MessageActions || !MessageActions.sendMessage) return;

    const msgPatch = after("sendMessage", MessageActions, (args, ret) => {
      const channelId = args[0];
      const message = args[1];
      
      if (!message || !message.content) return ret;
      
      const content = message.content.trim();
      
      // /profile config user:123456789 display_name:Test avatar:url...
      if (content.startsWith("/profile ")) {
        // Prevent the message from actually sending
        // We can't easily cancel here, so we'll send a follow-up and delete the original
        // Actually, let's just process it and let it send as a normal message
        // The slash command approach above is better
        
        // For now, just log
        console.log("[FakeProfile] Command detected:", content);
      }
      
      return ret;
    });

    patches.push(msgPatch);
  } catch (e) {
    console.log("[FakeProfile] Message patch failed:", e);
  }
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

    // Register slash commands
    registerCommands();
  },

  onUnload: () => {
    patches.forEach(p => {
      try { p?.(); } catch (e) {}
    });
    patches = [];
    
    commandPatches.forEach(p => {
      try { p?.(); } catch (e) {}
    });
    commandPatches = [];
  },

  // Minimal settings page - just shows instructions
  settings: () => {
    return React.createElement(View, { style: { flex: 1, padding: 20, justifyContent: "center", alignItems: "center" } },
      React.createElement(Text, { style: { color: "#dcddde", fontSize: 16, textAlign: "center", marginBottom: 12 } },
        "FakeProfile Plugin"
      ),
      React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 14, textAlign: "center" } },
        "Use slash commands to configure:\n\n" +
        "/profile config user:ID [options]\n" +
        "/profile remove user:ID\n" +
        "/profile list\n" +
        "/profile clear\n\n" +
        "Options: display_name, avatar, banner, bio, status, pronouns"
      )
    );
  }
};
