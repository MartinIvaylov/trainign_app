import { Text, View, ScrollView } from "react-native";
import { useAppStore } from "../../store";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PlanScreen() {
  const sessions = useAppStore((s) => s.sessions);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0E1116", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "800", marginTop: 24 }}>
        Plan
      </Text>
      <Text style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>
        This week's sessions
      </Text>

      <View style={{ flexDirection: "row", gap: 6, marginTop: 24 }}>
        {DOW.map((d, i) => {
          const hasSession = sessions.some((s) => s.dayOfWeek === i);
          return (
            <View
              key={d}
              style={{
                flex: 1,
                backgroundColor: hasSession ? "#1B1F26" : "transparent",
                borderRadius: 8,
                padding: 8,
                borderWidth: 1,
                borderColor: "#1B1F26",
                alignItems: "center",
                minHeight: 64,
              }}
            >
              <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600" }}>{d}</Text>
              {hasSession && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF", marginTop: 6 }} />
              )}
            </View>
          );
        })}
      </View>

      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 32 }}>
        BLOCK 1 — BASE (4 WEEKS)
      </Text>
      <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "500", marginTop: 8 }}>
        Aerobic base + general strength
      </Text>
      <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 8, lineHeight: 18 }}>
        2 easy runs, 1 strength day, 1 MetCon, 1 Z2 erg per week.
      </Text>

      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 24 }}>
        UPCOMING SESSIONS
      </Text>

      {sessions.length === 0 ? (
        <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 12 }}>
          No sessions scheduled yet. Generate from the web app or wait for the mobile generate feature.
        </Text>
      ) : (
        <View style={{ marginTop: 12 }}>
          {sessions.slice(0, 5).map((s) => (
            <View key={s.id} style={{
              backgroundColor: "#1B1F26",
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
              borderLeftWidth: 3,
              borderLeftColor: modeColor(s.mode),
            }}>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>{s.title}</Text>
              <Text style={{ color: "#6B7280", fontSize: 11, marginTop: 2 }}>
                {s.type.replace("_", " ")} · {s.durationMin ?? "—"} min
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
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
