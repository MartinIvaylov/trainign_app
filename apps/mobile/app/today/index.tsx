import { Text, View, ScrollView, Pressable } from "react-native";
import { useAppStore } from "../../store";
import { useEffect, useState } from "react";
import * as Haptics from "expo-haptics";
import * as KeepAwake from "expo-keep-awake";

export default function TodayScreen() {
  const profile = useAppStore((s) => s.profile);
  const activeMode = useAppStore((s) => s.activeMode);
  const upcoming = useAppStore((s) => s.upcomingCompetition);

  const daysToRace = upcoming?.date
    ? Math.max(0, Math.ceil((new Date(upcoming.date).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0E1116", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "800", marginTop: 24 }}>
        Welcome, {profile?.displayName ?? "athlete"}
      </Text>
      <Text style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>
        {activeMode.toUpperCase()} focus · ready to train
      </Text>

      {daysToRace !== null && (
        <View
          style={{
            backgroundColor: "#1B1F26",
            borderRadius: 12,
            padding: 16,
            marginTop: 20,
            borderLeftWidth: 3,
            borderLeftColor: modeColor(activeMode),
          }}
        >
          <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5 }}>
            NEXT COMPETITION
          </Text>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginTop: 4 }}>
            {upcoming?.name}
          </Text>
          <Text style={{ color: "#FFFFFF", fontSize: 40, fontWeight: "800", marginTop: 12 }}>
            {daysToRace}
            <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "500" }}> days</Text>
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <StatTile label="Sessions / wk" value="4" />
        <StatTile label="PRs" value="0" />
        <StatTile label="Avg RPE" value="7.1" />
      </View>

      <View style={{ backgroundColor: "#1B1F26", borderRadius: 12, padding: 16, marginTop: 16 }}>
        <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5 }}>
          TODAY'S SESSION
        </Text>
        <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginTop: 8 }}>
          Easy Run + Mobility
        </Text>
        <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
          Z2 effort. 5-8 km easy pace.
        </Text>
        <Pressable
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
          style={{
            backgroundColor: "#FFFFFF",
            padding: 12,
            borderRadius: 8,
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <Text style={{ color: "#0E1116", fontWeight: "700" }}>Start session</Text>
        </Pressable>
      </View>

      <View style={{ backgroundColor: "#1B1F26", borderRadius: 12, padding: 16, marginTop: 16 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>
          AI coaching insight
        </Text>
        <Text style={{ color: "#6B7280", fontSize: 12, lineHeight: 18 }}>
          Your 5 km pace improved 4 sec/km in the last 4 weeks. Sled Pull remains your weakest station — keep posterior-chain strength focus.
        </Text>
      </View>
    </ScrollView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: "#1B1F26",
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
    }}>
      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 6 }}>
        {value}
      </Text>
    </View>
  );
}

function modeColor(mode: string): string {
  switch (mode) {
    case "hyrox": return "#E76F51";
    case "athx": return "#4ECDC4";
    case "crossfit": return "#F4A261";
    case "maintenance": return "#06A77D";
    default: return "#FFFFFF";
  }
}
