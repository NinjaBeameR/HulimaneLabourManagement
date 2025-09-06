import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, ActivityIndicator, KeyboardAvoidingView, Alert, SafeAreaView, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { verifyPin, hasPin, clearAllDataForReset, isBiometricAvailable, useBiometric } from '../utils/auth';

const PIN_LENGTH = 4;
const { width, height } = Dimensions.get('window');

export default function EnterPinScreen({ navigation }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Animation values
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(0.9)).current;
  const dotAnimations = useRef(Array(PIN_LENGTH).fill(0).map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    (async () => {
      setBiometricAvailable(await isBiometricAvailable());
    })();
  }, []);

  // Initial entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimation, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Animate PIN dots
  useEffect(() => {
    dotAnimations.forEach((anim, index) => {
      if (index < pin.length) {
        Animated.spring(anim, {
          toValue: 1,
          tension: 150,
          friction: 4,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(anim, {
          toValue: 0,
          tension: 150,
          friction: 4,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [pin.length]);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

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
      shakeError();
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
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.safeArea}
    >
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnimation,
            transform: [
              { scale: scaleAnimation },
              { translateX: shakeAnimation }
            ]
          }
        ]}
      >
        <KeyboardAvoidingView style={styles.innerContainer} behavior="padding">
          <View style={styles.header}>
            <Text style={styles.title}>Enter PIN</Text>
            <Text style={styles.subtitle}>Unlock your app securely</Text>
          </View>
          
          <View style={styles.pinContainer}>
            <View style={styles.pinRow}>
              {[...Array(PIN_LENGTH)].map((_, i) => (
                <Animated.View 
                  key={i} 
                  style={[
                    styles.pinDot, 
                    pin.length > i && styles.pinDotFilled,
                    {
                      transform: [
                        {
                          scale: dotAnimations[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1.2],
                          })
                        }
                      ]
                    }
                  ]} 
                />
              ))}
            </View>
          </View>

          <View style={styles.keypadContainer}>
            <View style={styles.keypad}>
              {[1,2,3,4,5,6,7,8,9].map((n) => (
                <TouchableOpacity 
                  key={n} 
                  style={styles.key} 
                  onPress={() => handleKeyPress(n.toString())}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#ffffff', '#f8f9fa']}
                    style={styles.keyGradient}
                  >
                    <Text style={styles.keyText}>{n}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                style={styles.key} 
                onPress={handleBackspace}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#ffffff', '#f8f9fa']}
                  style={styles.keyGradient}
                >
                  <Text style={styles.keyText}>←</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.key} 
                onPress={() => handleKeyPress('0')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#ffffff', '#f8f9fa']}
                  style={styles.keyGradient}
                >
                  <Text style={styles.keyText}>0</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.key, styles.submitKey]} 
                onPress={handleSubmit} 
                disabled={pin.length !== PIN_LENGTH}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={pin.length === PIN_LENGTH ? ['#4CAF50', '#45a049'] : ['#cccccc', '#999999']}
                  style={styles.keyGradient}
                >
                  <Text style={[styles.keyText, styles.submitText, pin.length === PIN_LENGTH ? styles.submitEnabled : styles.submitDisabled]}>
                    ✓
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actionsContainer}>
            {biometricAvailable && (
              <TouchableOpacity style={styles.bioButton} onPress={handleBiometric} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#2196F3', '#1976D2']}
                  style={styles.bioGradient}
                >
                  <Text style={styles.bioText}>🔒 Use Biometric</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPin}>
              <Text style={styles.forgotText}>Forgot PIN?</Text>
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
          
          {error ? (
            <Animated.View style={styles.errorContainer}>
              <Text style={styles.error}>{error}</Text>
            </Animated.View>
          ) : null}
        </KeyboardAvoidingView>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1,
  },
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    margin: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    marginBottom: 8, 
    color: '#2c3e50',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: { 
    fontSize: 18, 
    color: '#7f8c8d',
    fontWeight: '300',
  },
  pinContainer: {
    marginBottom: 50,
  },
  pinRow: { 
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinDot: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    borderWidth: 3, 
    borderColor: '#bdc3c7', 
    marginHorizontal: 12, 
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pinDotFilled: { 
    backgroundColor: '#3498db', 
    borderColor: '#2980b9',
    shadowColor: '#3498db',
    shadowOpacity: 0.3,
  },
  keypadContainer: {
    marginBottom: 30,
  },
  keypad: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    width: 280, 
    justifyContent: 'center',
  },
  key: { 
    width: 70, 
    height: 70, 
    margin: 8,
    borderRadius: 35,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  keyGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: { 
    fontSize: 24, 
    fontWeight: '600',
    color: '#2c3e50',
  },
  submitKey: {
    shadowColor: '#27ae60',
  },
  submitText: {
    fontSize: 20,
  },
  submitEnabled: { 
    color: '#ffffff',
    fontWeight: 'bold',
  },
  submitDisabled: { 
    color: '#95a5a6',
  },
  actionsContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  bioButton: { 
    marginBottom: 16,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bioGradient: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bioText: { 
    color: '#ffffff', 
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: { 
    padding: 8,
  },
  forgotText: { 
    color: '#e74c3c', 
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 20,
  },
  errorContainer: {
    marginTop: 16,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  error: { 
    fontSize: 16, 
    color: '#e74c3c',
    fontWeight: '500',
    textAlign: 'center',
  },
});
