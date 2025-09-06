import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Text, Button, TextInput, Title } from "react-native-paper";
import { getItem, setItem } from "../utils/storage";

export default function LoginScreen({ navigation }) {
  const [pin, setPin] = useState("");
  const [storedPin, setStoredPin] = useState(null);
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getItem("auth_pin");
      setStoredPin(p);
      setIsSetup(!!p);
    })();
  }, []);

  const handleSetPin = async () => {
    if (pin.length < 4) return alert("PIN must be at least 4 digits");
    await setItem("auth_pin", pin);
    navigation.replace("Dashboard");
  };

  const handleLogin = async () => {
    if (pin === storedPin) navigation.replace("Dashboard");
    else alert("Incorrect PIN");
  };

  return (
    <View style={styles.container}>
      <Title style={{ marginBottom: 12 }}>House Labour Manager</Title>
      <Text style={{ marginBottom: 6 }}>{isSetup ? "Enter your PIN" : "Set a 4-digit PIN for app lock"}</Text>
      <TextInput
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        style={{ width: "60%", marginBottom: 12 }}
      />
      <Button mode="contained" onPress={isSetup ? handleLogin : handleSetPin}>
        {isSetup ? "Unlock" : "Set PIN & Continue"}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f6f7fb" }
});
