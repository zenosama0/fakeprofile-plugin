import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

const RN = (typeof ReactNative !== "undefined" ? ReactNative : {}) as any;
const { View, Text } = RN;

let showToast: any;
try {
  const toasts = findByProps("showToast");
  showToast = toasts?.showToast || ((msg: string) => console.log("[FakeProfile]", msg));
} catch (e) {
  showToast = (msg: string) => console.log("[FakeProfile]", msg);
}

if (!storage.overrides) {
  storage.overrides = [];
}

const UserStore = findByStoreName("UserStore");
const UserProfileStore = findByStoreName("UserProfileStore");

function getOverride(userId: string) {
  return storage.overrides.find((o: any) => o.userId === userId);
}

function saveOverrides(overrides: any[]) {
  storage.overrides = overrides;
}

let patches: any[] = [];

// Parse command args from string like: user:123 name:Test avatar:url
function parseArgs(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(\w+):([^ ]+)/g;
  let match;
  while ((match = regex.exec(input)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}

export default {
  onLoad: () => {
    // --- Patch UserStore.getUser ---
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

    // --- Patch UserProfileStore.getUserProfile ---
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

    // --- Patch PresenceStore for status ---
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

    // --- Intercept message send for /profile commands ---
    try {
      const MessageActions = findByProps("sendMessage", "receiveMessage");
      if (MessageActions && MessageActions.sendMessage) {
        const msgPatch = after("sendMessage", MessageActions, (args, ret) => {
          const message = args[1];
          if (!message?.content) return ret;

          const content = message.content.trim();
          if (!content.startsWith("/profile ")) return ret;

          // Cancel the original message
          try {
            const { deleteMessage } = findByProps("deleteMessage");
            if (deleteMessage) {
              setTimeout(() => deleteMessage(args[0], message.id), 100);
            }
          } catch (e) {}

          const commandPart = content.slice(9).trim(); // remove "/profile "
          const spaceIdx = commandPart.indexOf(" ");
          const subcommand = spaceIdx > 0 ? commandPart.slice(0, spaceIdx) : commandPart;
          const argsStr = spaceIdx > 0 ? commandPart.slice(spaceIdx + 1) : "";
          const parsed = parseArgs(argsStr);

          // Handle commands
          if (subcommand === "config" || subcommand === "add") {
            const userId = parsed.user || parsed.id;
            if (!userId) {
              showToast("Usage: /profile config user:ID name:Name avatar:URL");
              return ret;
            }

            const overrides = [...storage.overrides];
            const existingIndex = overrides.findIndex((o: any) => o.userId === userId);

            const newOverride: any = {
              userId,
              avatarUrl: parsed.avatar || parsed.pfp || "",
              displayName: parsed.name || parsed.display_name || "",
              bio: parsed.bio || parsed.about || "",
              status: parsed.status || "",
              bannerUrl: parsed.banner || "",
              pronouns: parsed.pronouns || ""
            };

            if (existingIndex >= 0) {
              overrides[existingIndex] = newOverride;
              showToast(`Updated override for ${userId}`);
            } else {
              overrides.push(newOverride);
              showToast(`Added override for ${userId}`);
            }
            saveOverrides(overrides);
          }

          else if (subcommand === "remove" || subcommand === "delete") {
            const userId = parsed.user || parsed.id;
            if (!userId) {
              showToast("Usage: /profile remove user:ID");
              return ret;
            }

            const newOverrides = storage.overrides.filter((o: any) => o.userId !== userId);
            const removed = newOverrides.length < storage.overrides.length;
            saveOverrides(newOverrides);

            if (removed) {
              showToast(`Removed override for ${userId}`);
            } else {
              showToast(`No override found for ${userId}`);
            }
          }

          else if (subcommand === "list") {
            const overrides = storage.overrides || [];
            if (overrides.length === 0) {
              showToast("No active overrides");
            } else {
              const names = overrides.map((o: any) => o.displayName || o.userId).join(", ");
              showToast(`${overrides.length} override(s): ${names}`);
            }
          }

          else if (subcommand === "clear") {
            const count = storage.overrides.length;
            saveOverrides([]);
            showToast(`Cleared ${count} override(s)`);
          }

          else {
            showToast("Unknown command. Use: config, remove, list, clear");
          }

          return ret;
        });
        patches.push(msgPatch);
      }
    } catch (e) {
      console.log("[FakeProfile] Message interception failed:", e);
    }
  },

  onUnload: () => {
    patches.forEach(p => {
      try { p?.(); } catch (e) {}
    });
    patches = [];
  },

  // Simple settings page with instructions
  settings: () => {
    return React.createElement(View, { style: { flex: 1, padding: 20 } },
      React.createElement(Text, { style: { color: "#dcddde", fontSize: 18, fontWeight: "bold", marginBottom: 16 } },
        "FakeProfile Plugin"
      ),
      React.createElement(Text, { style: { color: "#b9bbbe", fontSize: 14, lineHeight: 22 } },
        "Type these commands in any chat:\n\n" +
        "/profile config user:123456789 name:Test avatar:https://... banner:https://... bio:Hello status:Playing pronouns:they/them\n\n" +
        "/profile remove user:123456789\n\n" +
        "/profile list\n\n" +
        "/profile clear\n\n" +
        "The message will auto-delete and the command will execute."
      )
    );
  }
};
