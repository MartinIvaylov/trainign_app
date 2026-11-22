import { Text, View, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "../store";

export default function OnboardingScreen() {
  const router = useRouter();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  function finish() {
    completeOnboarding();
    router.replace("/today");
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0E1116", padding: 24 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginTop: 32 }}>
        Welcome to HYBRID
      </Text>
      <Text style={{ color: "#6B7280", fontSize: 14, marginTop: 8, marginBottom: 24 }}>
        Build your athlete profile. We'll generate a starting training plan based on your benchmarks and goals.
      </Text>
      <Section title="Tell us about you">
        <PillRow items={["Beginner", "Intermediate", "Advanced", "Elite"]} selected="Intermediate" />
      </Section>
      <Section title="Training background">
        <PillRow items={["CrossFit", "HYROX", "ATHX", "Running", "Gym", "General"]} selected="HYROX" />
      </Section>
      <Section title="Sessions per week">
        <PillRow items={["2", "3", "4", "5", "6"]} selected="4" />
      </Section>
      <Section title="Primary goal">
        <PillRow
          items={["First race", "PR time", "Strength", "Endurance", "Overall", "Elite"]}
          selected="Overall"
        />
      </Section>
      <Pressable
        onPress={finish}
        style={{
          backgroundColor: "#FFFFFF",
          padding: 16,
          borderRadius: 10,
          alignItems: "center",
          marginVertical: 32,
        }}
      >
        <Text style={{ color: "#0E1116", fontWeight: "700" }}>Build profile</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function PillRow({ items, selected }: { items: string[]; selected: string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {items.map((it) => {
        const active = it === selected;
        return (
          <View
            key={it}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: active ? "#FFFFFF" : "#1B1F26",
              backgroundColor: active ? "#1B1F26" : "transparent",
            }}
          >
            <Text style={{ color: active ? "#FFFFFF" : "#6B7280", fontSize: 12, fontWeight: "500" }}>
              {it}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
