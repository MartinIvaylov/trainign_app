import { Text, View, ScrollView, Pressable, Alert } from "react-native";
import { useAppStore } from "../../store";

export default function ProfileScreen() {
  const profile = useAppStore((s) => s.profile);
  const activeMode = useAppStore((s) => s.activeMode);
  const signOut = useAppStore((s) => s.signOut);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0E1116", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "800", marginTop: 24 }}>
        Profile
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24 }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ color: "#0E1116", fontSize: 20, fontWeight: "800" }}>
            {(profile?.displayName ?? "A").slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>
            {profile?.displayName ?? "Athlete"}
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>
            {activeMode.toUpperCase()} focus
          </Text>
        </View>
      </View>

      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 32 }}>
        ACTIVE TRAINING FOCUS
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {(["hyrox", "athx", "crossfit", "maintenance"] as const).map((m) => {
          const active = activeMode === m;
          return (
            <View
              key={m}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: active ? "#FFFFFF" : "#1B1F26",
                backgroundColor: active ? "#1B1F26" : "transparent",
              }}
            >
              <Text style={{ color: active ? "#FFFFFF" : "#6B7280", fontSize: 12, fontWeight: "600" }}>
                {m.toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 32 }}>
        SUBSCRIPTION
      </Text>
      <View style={{ backgroundColor: "#1B1F26", borderRadius: 12, padding: 16, marginTop: 8 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>Free tier</Text>
        <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
          Upgrade to PRO for adaptive training, AI coach, full analytics and HYROX/ATHX prep.
        </Text>
      </View>

      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 32 }}>
        WEARABLE INTEGRATIONS
      </Text>
      <View style={{ backgroundColor: "#1B1F26", borderRadius: 12, padding: 16, marginTop: 8 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>Apple Health</Text>
        <Text style={{ color: "#6B7280", fontSize: 11, marginTop: 2 }}>
          Connect to sync workouts and runs from Apple Health.
        </Text>
      </View>
      <View style={{ backgroundColor: "#1B1F26", borderRadius: 12, padding: 16, marginTop: 8 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>Strava</Text>
        <Text style={{ color: "#6B7280", fontSize: 11, marginTop: 2 }}>
          Sync outdoor runs and rides from Strava.
        </Text>
      </View>

      <Pressable
        onPress={() => {
          Alert.alert("Sign out", "Sign out of HYBRID?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: signOut },
          ]);
        }}
        style={{
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: "#E76F51",
          borderRadius: 10,
          padding: 14,
          alignItems: "center",
          marginTop: 32,
          marginBottom: 40,
        }}
      >
        <Text style={{ color: "#E76F51", fontWeight: "700" }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
