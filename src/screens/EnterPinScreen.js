import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, ActivityIndicator, KeyboardAvoidingView, Alert, SafeAreaView } from 'react-native';
import { verifyPin, hasPin, clearAllDataForReset, isBiometricAvailable, useBiometric } from '../utils/auth';

const PIN_LENGTH = 4;

export default function EnterPinScreen({ navigation }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  React.useEffect(() => {
    (async () => {
      setBiometricAvailable(await isBiometricAvailable());
    })();
  }, []);

  const handleKeyPress = (digit) => {
    if (pin.length < PIN_LENGTH) {
      setPin(pin + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleSubmit = async () => {
    if (pin.length !== PIN_LENGTH) return;
    setLoading(true);
    const valid = await verifyPin(pin);
    setLoading(false);
    if (valid) {
      navigation.replace('MainTabs');
    } else {
      Vibration.vibrate(100);
      setError('Incorrect PIN');
      setPin('');
    }
  };

  const handleBiometric = async () => {
    setLoading(true);
    const success = await useBiometric();
    setLoading(false);
    if (success) {
      navigation.replace('MainTabs');
    }
  };

  const handleForgotPin = () => {
    Alert.alert(
      'Reset App',
      'Resetting will erase all local app data. Type RESET to confirm.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: () => {
            Alert.prompt('Type RESET to confirm', '', async (text) => {
              if (text === 'RESET') {
                await clearAllDataForReset();
                navigation.replace('CreatePin');
              }
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        <Text style={styles.title}>Enter PIN</Text>
        <Text style={styles.subtitle}>Unlock your app</Text>
        <View style={styles.pinRow}>
          {[...Array(PIN_LENGTH)].map((_, i) => (
            <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotFilled]} />
          ))}
        </View>
        <View style={styles.keypad}>
          {[1,2,3,4,5,6,7,8,9].map((n) => (
            <TouchableOpacity key={n} style={styles.key} onPress={() => handleKeyPress(n.toString())}>
              <Text style={styles.keyText}>{n}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.key} onPress={handleBackspace}>
            <Text style={styles.keyText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('0')}>
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={handleSubmit} disabled={pin.length !== PIN_LENGTH}>
            <Text style={[styles.keyText, pin.length === PIN_LENGTH ? styles.submitEnabled : styles.submitDisabled]}>{pin.length === PIN_LENGTH ? 'OK' : 'OK'}</Text>
          </TouchableOpacity>
        </View>
        {biometricAvailable && (
          <TouchableOpacity style={styles.bioButton} onPress={handleBiometric}>
            <Text style={styles.bioText}>Use Biometric</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPin}>
          <Text style={styles.forgotText}>Forgot PIN?</Text>
        </TouchableOpacity>
        {loading && <ActivityIndicator style={{ marginTop: 16 }} color="#2196F3" />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, color: '#000' },
  subtitle: { fontSize: 16, marginBottom: 24, color: '#666' },
  pinRow: { flexDirection: 'row', marginBottom: 24 },
  pinDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ddd', marginHorizontal: 8, backgroundColor: '#fff' },
  pinDotFilled: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 220, justifyContent: 'center' },
  key: { width: 60, height: 60, margin: 6, backgroundColor: '#e9ecef', borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  keyText: { fontSize: 24, color: '#333' },
  submitEnabled: { color: '#2196F3', fontWeight: 'bold' },
  submitDisabled: { color: '#aaa' },
  bioButton: { marginTop: 16, backgroundColor: '#2196F3', padding: 10, borderRadius: 8 },
  bioText: { color: '#fff', fontSize: 16 },
  forgotButton: { marginTop: 16 },
  forgotText: { color: '#d9534f', fontSize: 16 },
  error: { marginTop: 12, fontSize: 16, color: '#f44336' },
});
