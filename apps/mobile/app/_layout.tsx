import { TouchableOpacity, Text, View } from "react-native";
import { Link, Slot, useRouter, usePathname } from "expo-router";
import { useEffect } from "react";
import { useAppStore } from "../store";

const TABS = [
  { slug: "today", label: "Today" },
  { slug: "plan", label: "Plan" },
  { slug: "train", label: "Train" },
  { slug: "progress", label: "Progress" },
  { slug: "profile", label: "Profile" },
] as const;

export default function AppLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const authed = useAppStore((s) => s.authed);
  const onboarded = useAppStore((s) => s.onboarded);

  // Route guard: redirect to /auth or /onboarding based on state
  useEffect(() => {
    if (!authed && pathname !== "/auth" && pathname !== "/onboarding") {
      router.replace("/auth");
    } else if (authed && !onboarded && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [authed, onboarded, pathname]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0E1116" }}>
      <Slot />
      {/* Bottom tab bar */}
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderTopColor: "#1B1F26",
          backgroundColor: "#0E1116",
          paddingBottom: 6,
          paddingTop: 8,
        }}
      >
        {TABS.map((t) => {
          const active = pathname?.startsWith(`/${t.slug}`);
          return (
            <Link
              key={t.slug}
              href={`/${t.slug}`}
              style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
            >
              <Text
                style={{
                  color: active ? "#FFFFFF" : "#6B7280",
                  fontSize: 11,
                  fontWeight: active ? "700" : "500",
                }}
              >
                {t.label}
              </Text>
            </Link>
          );
        })}
      </View>
    </View>
  );
}
