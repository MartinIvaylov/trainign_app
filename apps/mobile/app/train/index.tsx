import { Text, View, Pressable, ScrollView } from "react-native";
import { useAppStore } from "../../store";
import { useEffect, useState, useRef } from "react";
import * as Haptics from "expo-haptics";
import * as KeepAwake from "expo-keep-awake";
import { useKeepAwake } from "expo-keep-awake";

type TimerKind = "for_time" | "amrap" | "emom" | "tabata" | "intervals" | "strength";

export default function TrainScreen() {
  const [active, setActive] = useState<{ kind: TimerKind } | null>(null);
  useKeepAwake();

  if (active) {
    return <ActiveTimer kind={active.kind} onExit={() => setActive(null)} />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0E1116", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "800", marginTop: 24 }}>
        Train
      </Text>
      <Text style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>
        Distraction-free timers. Screen stays awake during workout.
      </Text>

      <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 24 }}>
        QUICK START
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {([
          { kind: "for_time", label: "For Time" },
          { kind: "amrap", label: "AMRAP" },
          { kind: "emom", label: "EMOM" },
          { kind: "tabata", label: "Tabata" },
          { kind: "intervals", label: "Intervals" },
          { kind: "strength", label: "Strength" },
        ] as { kind: TimerKind; label: string }[]).map((t) => (
          <Pressable
            key={t.kind}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActive({ kind: t.kind });
            }}
            style={{
              backgroundColor: "#1B1F26",
              borderRadius: 10,
              padding: 14,
              minWidth: 100,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>
              {t.label}
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 10, marginTop: 2 }}>
              Tap to start
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function ActiveTimer({ kind, onExit }: { kind: TimerKind; onExit: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  function formatHMS(s: number): string {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? "0" : ""}${r}`;
  }

  function toggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunning((r) => !r);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0E1116", padding: 24, justifyContent: "center", alignItems: "center" }}>
      <Pressable
        onPress={onExit}
        style={{
          position: "absolute", top: 40, right: 16,
          padding: 8,
        }}
      >
        <Text style={{ color: "#6B7280", fontSize: 12 }}>Exit</Text>
      </Pressable>

      <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "600", letterSpacing: 1.5 }}>
        {kind.toUpperCase().replace("_", " ")}
      </Text>
      <Text style={{ color: "#FFFFFF", fontSize: 72, fontWeight: "800", fontVariant: ["tabular-nums"], marginTop: 16 }}>
        {formatHMS(elapsed)}
      </Text>

      <Pressable
        onPress={toggle}
        style={{
          backgroundColor: "#FFFFFF",
          width: 80, height: 80, borderRadius: 40,
          alignItems: "center", justifyContent: "center",
          marginTop: 32,
        }}
      >
        <Text style={{ color: "#0E1116", fontWeight: "800", fontSize: 16 }}>
          {running ? "PAUSE" : "START"}
        </Text>
      </Pressable>

      <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 24, textAlign: "center" }}>
        Haptic feedback on every transition.{"\n"}Screen stays awake.
      </Text>
    </View>
  );
}
