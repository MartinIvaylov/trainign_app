import { Text, View, ScrollView } from "react-native";
import { useAppStore } from "../../store";

export default function ProgressScreen() {
  const logs = useAppStore((s) => s.logs);
  const prs = useAppStore((s) => s.prs);
  const hyroxSims = useAppStore((s) => s.hyroxSimulations);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0E1116", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "800", marginTop: 24 }}>
        Progress
      </Text>
      <Text style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>
        {logs.length} sessions · {prs.length} PRs · {hyroxSims.length} simulations
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 24 }}>
        <StatTile label="Sessions" value={logs.length.toString()} />
        <StatTile label="Volume" value={formatHMS(logs.reduce((a, b) => a + (b.durationSec ?? 0), 0))} />
        <StatTile label="PRs" value={prs.length.toString()} />
      </View>

      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 32 }}>
        PERFORMANCE DIMENSIONS
      </Text>
      <View style={{ backgroundColor: "#1B1F26", borderRadius: 12, padding: 16, marginTop: 8 }}>
        <DimBar label="Running" value={62} />
        <DimBar label="Strength" value={48} />
        <DimBar label="Erg" value={71} />
        <DimBar label="MetCon" value={58} />
      </View>

      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 24 }}>
        RECENT SESSIONS
      </Text>
      <View style={{ marginTop: 8 }}>
        {logs.length === 0 ? (
          <Text style={{ color: "#6B7280", fontSize: 12 }}>No sessions logged yet.</Text>
        ) : (
          logs.slice(0, 5).map((l) => (
            <View key={l.id} style={{
              backgroundColor: "#1B1F26",
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
            }}>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>{l.title}</Text>
              <Text style={{ color: "#6B7280", fontSize: 11, marginTop: 2 }}>
                {new Date(l.date).toLocaleDateString()} · {l.result ?? "—"}
              </Text>
            </View>
          ))
        )}
      </View>

      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 24 }}>
        PERSONAL RECORDS
      </Text>
      <View style={{ marginTop: 8, marginBottom: 32 }}>
        {prs.length === 0 ? (
          <Text style={{ color: "#6B7280", fontSize: 12 }}>No PRs recorded yet.</Text>
        ) : (
          prs.slice(0, 5).map((p, i) => (
            <View key={i} style={{
              flexDirection: "row",
              justifyContent: "space-between",
              backgroundColor: "#1B1F26",
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
            }}>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>{p.movement}</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>{p.value} {p.unit}</Text>
            </View>
          ))
        )}
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
      <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginTop: 6 }}>{value}</Text>
    </View>
  );
}

function DimBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "500" }}>{label}</Text>
        <Text style={{ color: value < 50 ? "#E76F51" : value < 70 ? "#F4A261" : "#06A77D", fontSize: 12, fontWeight: "600" }}>
          {value}/100
        </Text>
      </View>
      <View style={{ height: 4, backgroundColor: "#13171F", borderRadius: 2, marginTop: 4 }}>
        <View style={{
          height: "100%",
          width: `${value}%`,
          backgroundColor: value < 50 ? "#E76F51" : value < 70 ? "#F4A261" : "#06A77D",
          borderRadius: 2,
        }} />
      </View>
    </View>
  );
}

function formatHMS(s: number): string {
  if (!s) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}
