import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const BG = '#1a1a2e';
const SURFACE = '#16213e';
const SURFACE_LIGHT = '#1f2b47';
const TEXT_PRIMARY = '#e8e8f0';
const TEXT_SECONDARY = '#8888a8';
const ACCENT = '#00e5ff';

const WEB_APP_URL = 'https://home-organization-puce.vercel.app';

export default function HomeScreen() {
  const [roomCount, setRoomCount] = useState<number | null>(null);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [roomsRes, itemsRes] = await Promise.all([
          supabase.from('rooms').select('id', { count: 'exact', head: true }),
          supabase.from('items').select('id', { count: 'exact', head: true }),
        ]);
        setRoomCount(roomsRes.count ?? 0);
        setItemCount(itemsRes.count ?? 0);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const openWebApp = () => {
    Linking.openURL(WEB_APP_URL);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="home" size={32} color={ACCENT} />
        <Text style={styles.headerTitle}>HomeBase</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="grid-outline" size={28} color="#b24dff" />
          {loading ? (
            <ActivityIndicator size="small" color="#b24dff" style={{ marginTop: 8 }} />
          ) : (
            <Text style={[styles.statNumber, { color: '#b24dff' }]}>
              {roomCount}
            </Text>
          )}
          <Text style={styles.statLabel}>Rooms</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="cube-outline" size={28} color="#39ff85" />
          {loading ? (
            <ActivityIndicator size="small" color="#39ff85" style={{ marginTop: 8 }} />
          ) : (
            <Text style={[styles.statNumber, { color: '#39ff85' }]}>
              {itemCount}
            </Text>
          )}
          <Text style={styles.statLabel}>Items</Text>
        </View>
      </View>

      {/* 3D House Link */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3D House Navigator</Text>
        <Text style={styles.sectionDesc}>
          View and explore your home in 3D with room-by-room inventory visualization.
        </Text>
        <TouchableOpacity style={styles.openButton} onPress={openWebApp} activeOpacity={0.7}>
          <Ionicons name="open-outline" size={20} color="#0a0a15" />
          <Text style={styles.openButtonText}>Open in Browser</Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={18} color={TEXT_SECONDARY} />
          <Text style={styles.infoText}>
            The 3D home view runs in your browser for the best experience.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: ACCENT,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginTop: 2,
  },

  // Section
  section: {
    marginHorizontal: 16,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: 16,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  openButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a0a15',
  },

  // Info
  infoSection: {
    marginHorizontal: 16,
    paddingHorizontal: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
});
