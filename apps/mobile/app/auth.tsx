import { Text, View, Pressable } from "react-native";
import { Link } from "expo-router";
import { useAppStore } from "../store";

export default function AuthScreen() {
  const setAuthed = useAppStore((s) => s.setAuthed);
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0E1116" }}>
      <View style={{ alignItems: "center", marginBottom: 32 }}>
        <View style={{
          width: 56, height: 56, borderRadius: 12,
          backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ color: "#0E1116", fontWeight: "800", fontSize: 28 }}>H</Text>
        </View>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "700", marginTop: 16 }}>
          HYBRID
        </Text>
        <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
          PERFORMANCE OS
        </Text>
      </View>
      <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "700", marginBottom: 4 }}>
        Build your athlete profile
      </Text>
      <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 24 }}>
        5-minute onboarding. No credit card required.
      </Text>
      <LabeledInput label="Email" placeholder="you@example.com" />
      <LabeledInput label="Password" placeholder="••••••••" secure />
      <Pressable
        onPress={() => setAuthed("athlete@hybrid.app")}
        style={{
          backgroundColor: "#FFFFFF",
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
          marginTop: 16,
        }}
      >
        <Text style={{ color: "#0E1116", fontWeight: "700" }}>Create account</Text>
      </Pressable>
      <Text style={{ color: "#6B7280", fontSize: 12, textAlign: "center", marginTop: 24 }}>
        Demo build — auth is mocked locally. Production wires to Supabase Auth.
      </Text>
    </View>
  );
}

function LabeledInput({ label, placeholder, secure }: { label: string; placeholder: string; secure?: boolean }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "500", marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{
        borderWidth: 1, borderColor: "#1B1F26", borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 12, backgroundColor: "#13171F",
      }}>
        <Text style={{ color: "#FFFFFF", fontSize: 14 }}>{placeholder}</Text>
      </View>
    </View>
  );
}
