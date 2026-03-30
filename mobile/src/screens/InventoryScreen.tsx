import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const BG = '#1a1a2e';
const SURFACE = '#16213e';
const SURFACE_LIGHT = '#1f2b47';
const TEXT_PRIMARY = '#e8e8f0';
const TEXT_SECONDARY = '#8888a8';
const ACCENT = '#00e5ff';

type InventoryItem = {
  id: string;
  item_name: string;
  item_location: string | null;
  room_name: string;
  room_icon: string;
  zone_label: string | null;
};

type SearchResult = {
  item_name: string;
  item_location: string | null;
  room_name: string;
  room_icon: string;
};

export default function InventoryScreen() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAllItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          name,
          location,
          frames!inner (
            rooms!inner (
              name,
              icon,
              id
            ),
            zone_label
          )
        `)
        .order('name');

      if (error) throw error;

      const mapped: InventoryItem[] = (data || []).map((item: any) => ({
        id: item.id,
        item_name: item.name,
        item_location: item.location,
        room_name: item.frames?.rooms?.name ?? 'Unknown',
        room_icon: item.frames?.rooms?.icon ?? '?',
        zone_label: item.frames?.zone_label ?? null,
      }));

      setItems(mapped);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  }, []);

  const searchItems = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearching(false);
      await fetchAllItems();
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_items', {
        query: searchQuery.trim(),
      });

      if (error) throw error;

      const mapped: InventoryItem[] = (data || []).map((item: SearchResult, index: number) => ({
        id: `search-${index}`,
        item_name: item.item_name,
        item_location: item.item_location,
        room_name: item.room_name,
        room_icon: item.room_icon,
        zone_label: null,
      }));

      setItems(mapped);
    } catch (err) {
      console.error('Search failed:', err);
      // Fallback to client-side filter
      await fetchAllItems();
    } finally {
      setSearching(false);
    }
  }, [fetchAllItems]);

  useEffect(() => {
    setLoading(true);
    fetchAllItems().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchItems(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchItems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (query.trim()) {
      await searchItems(query);
    } else {
      await fetchAllItems();
    }
    setRefreshing(false);
  }, [query, searchItems, fetchAllItems]);

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <View style={styles.itemRow}>
      <View style={styles.iconContainer}>
        <Text style={styles.roomIcon}>{item.room_icon}</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.item_name}
        </Text>
        <Text style={styles.itemMeta} numberOfLines={1}>
          {item.room_name}
          {item.zone_label ? ` / ${item.zone_label}` : ''}
          {item.item_location ? ` - ${item.item_location}` : ''}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <Text style={styles.headerCount}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>&#x1F50D;</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor={TEXT_SECONDARY}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searching && (
            <ActivityIndicator size="small" color={ACCENT} style={styles.searchSpinner} />
          )}
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>&#x1F4E6;</Text>
            <Text style={styles.emptyText}>
              {query.trim() ? 'No items found' : 'No items in inventory'}
            </Text>
            <Text style={styles.emptySubtext}>
              {query.trim()
                ? 'Try a different search term'
                : 'Items will appear here once cataloged'}
            </Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: TEXT_SECONDARY,
    fontSize: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: ACCENT,
  },
  headerCount: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SURFACE_LIGHT,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 15,
    height: 48,
  },
  searchSpinner: {
    marginLeft: 8,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Item Row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SURFACE_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomIcon: {
    fontSize: 18,
  },
  itemInfo: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
  },
  itemMeta: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtext: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
});
