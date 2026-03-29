/**
 * App tab layout — configures the bottom tab navigator with the dark design
 * that matches the Pulse web app.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/** Solid dark background component used as the tab bar background. */
function TabBarBackground(): React.ReactElement {
  return <View style={styles.tabBarBackground} />;
}

/**
 * Root layout for all authenticated (app) screens.
 *
 * Renders a bottom tab navigator with four tabs: Home, Chat, Labs, and
 * Profile. Visual styling mirrors the web app's dark theme:
 *   - Background:    #04090f
 *   - Active tint:   #38bdf8
 *   - Inactive tint: rgba(255,255,255,0.3)
 *   - Top border:    rgba(56,189,248,0.12), 1px
 *   - Height:        60, paddingBottom 8
 */
export default function AppLayout(): React.ReactElement {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          backgroundColor: '#04090f',
          borderTopColor: 'rgba(56,189,248,0.12)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Ask Sana Health',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="chatbubble-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="heart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="labs"
        options={{
          title: 'Labs',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="flask-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
      {/* visit-prep is a full-screen modal pushed from home — hide from tab bar */}
      <Tabs.Screen
        name="visit-prep"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  /** Fills the tab bar area with the solid dark background colour. */
  tabBarBackground: {
    flex: 1,
    backgroundColor: '#04090f',
  },
});
