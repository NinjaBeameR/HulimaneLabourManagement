import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { formatBalance } from "../utils/balance";

export default function BalanceCard({ balance = 0 }) {
  const prevBalance = useRef(balance);
  const colorAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Animate on balance change
  useEffect(() => {
    if (prevBalance.current !== balance) {
      // Fade out, then in
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.5, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true })
      ]).start();
      // Color flash
      Animated.sequence([
        Animated.timing(colorAnim, { toValue: 1, duration: 120, useNativeDriver: false }),
        Animated.timing(colorAnim, { toValue: 0, duration: 180, useNativeDriver: false })
      ]).start();
      prevBalance.current = balance;
    }
  }, [balance]);

  // Theme-aware color logic
  const isPositive = Number(balance) >= 0;
  const isZero = Number(balance) === 0;
  
  let baseColor, flashColor;
  if (isZero) {
    baseColor = '#757575';
    flashColor = '#757575';
  } else if (isPositive) {
    baseColor = '#4CAF50';
    flashColor = '#4CAF50';
  } else {
    baseColor = '#F44336';
    flashColor = '#F44336';
  }
  const animatedColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [baseColor, flashColor]
  });

  // Responsive width
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = Math.min(screenWidth - 40, 400);

  return (
    <Animated.View style={[
      styles.card, 
      { 
        width: cardWidth, 
        height: 90, 
        backgroundColor: '#fff',
        shadowColor: '#000',
        opacity: fadeAnim 
      }
    ]}> 
      <Text style={[styles.title, { color: '#333' }]}>Current Balance</Text>
      <Animated.Text style={[styles.amount, { color: animatedColor }]}>
        {formatBalance(balance)}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
