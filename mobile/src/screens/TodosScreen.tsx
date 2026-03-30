import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Keyboard,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchTodoListsWithItems,
  createTodoList,
  createTodoItem,
  updateTodoItem,
  deleteTodoItem,
  deleteTodoList,
  TodoListWithItems,
  TodoItem,
} from '../lib/supabase';
import { NEON_COLORS } from '../lib/colors';

const BG = '#1a1a2e';
const SURFACE = '#16213e';
const SURFACE_LIGHT = '#1f2b47';
const TEXT_PRIMARY = '#e8e8f0';
const TEXT_SECONDARY = '#8888a8';
const DANGER = '#ff4060';

export default function TodosScreen() {
  const [lists, setLists] = useState<TodoListWithItems[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const activeList = lists.find(l => l.id === activeListId) || lists[0] || null;
  const activeColor = activeList
    ? NEON_COLORS[activeList.color_index % NEON_COLORS.length]
    : NEON_COLORS[0];

  const loadData = useCallback(async () => {
    try {
      const data = await fetchTodoListsWithItems();
      setLists(data);
      if (!activeListId && data.length > 0) {
        setActiveListId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load todos:', err);
    }
  }, [activeListId]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleAddList = () => {
    Alert.prompt(
      'New List',
      'Enter a name for the new list:',
      async (name) => {
        if (!name?.trim()) return;
        try {
          const colorIndex = lists.length % NEON_COLORS.length;
          const sortOrder = lists.length;
          const newList = await createTodoList({
            name: name.trim(),
            color_index: colorIndex,
            sort_order: sortOrder,
          });
          setActiveListId(newList.id);
          await loadData();
        } catch (err) {
          Alert.alert('Error', 'Failed to create list');
        }
      },
      'plain-text',
      '',
      'default',
    );
  };

  const handleDeleteList = () => {
    if (!activeList) return;
    Alert.alert(
      'Delete List',
      `Delete "${activeList.name}" and all its items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTodoList(activeList.id);
              setActiveListId(null);
              await loadData();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete list');
            }
          },
        },
      ],
    );
  };

  const handleAddItem = async () => {
    if (!newItemText.trim() || !activeList || addingItem) return;
    setAddingItem(true);
    try {
      const sortOrder = activeList.items.length;
      await createTodoItem({
        list_id: activeList.id,
        text: newItemText.trim(),
        status: 'todo',
        sort_order: sortOrder,
      });
      setNewItemText('');
      await loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setAddingItem(false);
    }
  };

  const handleToggleStatus = async (item: TodoItem) => {
    const next = item.status === 'done' ? 'todo' : 'done';
    try {
      await updateTodoItem(item.id, { status: next });
      await loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleToggleInflight = async (item: TodoItem) => {
    const next = item.status === 'inflight' ? 'todo' : 'inflight';
    try {
      await updateTodoItem(item.id, { status: next });
      await loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteTodoItem(id);
      await loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleClearDone = async () => {
    if (!activeList) return;
    const doneItems = activeList.items.filter(i => i.status === 'done');
    if (doneItems.length === 0) return;
    Alert.alert(
      'Clear Done',
      `Remove ${doneItems.length} completed item${doneItems.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(doneItems.map(i => deleteTodoItem(i.id)));
              await loadData();
            } catch (err) {
              Alert.alert('Error', 'Failed to clear items');
            }
          },
        },
      ],
    );
  };

  const todoCount = activeList?.items.filter(i => i.status === 'todo').length ?? 0;
  const inflightCount = activeList?.items.filter(i => i.status === 'inflight').length ?? 0;
  const doneCount = activeList?.items.filter(i => i.status === 'done').length ?? 0;

  const renderItem = ({ item }: { item: TodoItem }) => {
    const isDone = item.status === 'done';
    const isInflight = item.status === 'inflight';

    return (
      <View style={[styles.todoRow, { borderLeftColor: activeColor.dim }]}>
        <TouchableOpacity
          onPress={() => handleToggleStatus(item)}
          onLongPress={() => handleToggleInflight(item)}
          style={[
            styles.statusCircle,
            isDone && { backgroundColor: '#39ff85', borderColor: '#39ff85' },
            isInflight && { backgroundColor: '#ff9f1c', borderColor: '#ff9f1c' },
            !isDone && !isInflight && { borderColor: activeColor.dim },
          ]}
          activeOpacity={0.6}
        >
          {isDone && <Text style={styles.checkmark}>✓</Text>}
          {isInflight && <Text style={styles.inflightDot}>●</Text>}
        </TouchableOpacity>

        <Text
          style={[
            styles.todoText,
            isDone && styles.todoTextDone,
          ]}
          numberOfLines={2}
        >
          {item.text}
        </Text>

        <TouchableOpacity
          onPress={() => handleDeleteItem(item.id)}
          style={styles.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={NEON_COLORS[0].neon} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: activeColor.neon }]}>
          HomeBase
        </Text>
        <TouchableOpacity onPress={handleDeleteList} disabled={!activeList}>
          <Text style={[styles.headerAction, !activeList && { opacity: 0.3 }]}>
            Delete List
          </Text>
        </TouchableOpacity>
      </View>

      {/* List Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {lists.map(list => {
            const color = NEON_COLORS[list.color_index % NEON_COLORS.length];
            const isActive = list.id === (activeList?.id ?? null);
            return (
              <TouchableOpacity
                key={list.id}
                onPress={() => setActiveListId(list.id)}
                style={[
                  styles.tab,
                  isActive
                    ? { backgroundColor: color.neon, borderColor: color.neon }
                    : { backgroundColor: 'transparent', borderColor: color.dim },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    isActive
                      ? { color: '#0a0a15', fontWeight: '700' }
                      : { color: color.dim },
                  ]}
                  numberOfLines={1}
                >
                  {list.name}
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    { backgroundColor: isActive ? '#0a0a15' : color.dim },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      { color: isActive ? color.neon : '#0a0a15' },
                    ]}
                  >
                    {list.items.filter(i => i.status !== 'done').length}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity onPress={handleAddList} style={styles.addListBtn}>
            <Text style={styles.addListBtnText}>+</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Status Bar */}
      {activeList && (
        <View style={styles.statusBar}>
          <View style={styles.statusCounts}>
            <Text style={[styles.statusCount, { color: activeColor.dim }]}>
              {todoCount} todo
            </Text>
            <Text style={styles.statusDivider}>·</Text>
            <Text style={[styles.statusCount, { color: '#ff9f1c' }]}>
              {inflightCount} in progress
            </Text>
            <Text style={styles.statusDivider}>·</Text>
            <Text style={[styles.statusCount, { color: '#39ff85' }]}>
              {doneCount} done
            </Text>
          </View>
          {doneCount > 0 && (
            <TouchableOpacity onPress={handleClearDone}>
              <Text style={[styles.clearDoneText, { color: DANGER }]}>
                Clear done
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Items List */}
      {activeList ? (
        <FlatList
          data={activeList.items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={activeColor.neon}
              colors={[activeColor.neon]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No items yet</Text>
              <Text style={styles.emptySubtext}>
                Add your first item below
              </Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.emptyText}>No lists yet</Text>
          <Text style={styles.emptySubtext}>
            Tap + to create your first list
          </Text>
        </View>
      )}

      {/* Add Item Input */}
      {activeList && (
        <View
          style={[
            styles.inputContainer,
            { borderTopColor: activeColor.dim + '40' },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              { borderColor: activeColor.dim + '60' },
            ]}
            placeholder="Add a new item..."
            placeholderTextColor={TEXT_SECONDARY}
            value={newItemText}
            onChangeText={setNewItemText}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={handleAddItem}
            disabled={!newItemText.trim() || addingItem}
            style={[
              styles.addItemBtn,
              {
                backgroundColor: newItemText.trim()
                  ? activeColor.neon
                  : activeColor.dim + '40',
              },
            ]}
          >
            {addingItem ? (
              <ActivityIndicator size="small" color="#0a0a15" />
            ) : (
              <Text
                style={[
                  styles.addItemBtnText,
                  {
                    color: newItemText.trim() ? '#0a0a15' : TEXT_SECONDARY,
                  },
                ]}
              >
                Add
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerAction: {
    color: DANGER,
    fontSize: 14,
    fontWeight: '600',
  },

  // Tabs
  tabContainer: {
    paddingBottom: 8,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  tabText: {
    fontSize: 14,
    maxWidth: 120,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  addListBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: TEXT_SECONDARY,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addListBtnText: {
    color: TEXT_SECONDARY,
    fontSize: 20,
    fontWeight: '300',
    marginTop: -1,
  },

  // Status Bar
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SURFACE_LIGHT,
  },
  statusCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusDivider: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
  clearDoneText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },

  // Todo Row
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderLeftWidth: 3,
    gap: 12,
  },
  statusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#0a0a15',
    fontSize: 14,
    fontWeight: '800',
  },
  inflightDot: {
    color: '#0a0a15',
    fontSize: 10,
    marginTop: -1,
  },
  todoText: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 20,
  },
  todoTextDone: {
    textDecorationLine: 'line-through',
    color: TEXT_SECONDARY,
    opacity: 0.6,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SURFACE_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: DANGER,
    fontSize: 13,
    fontWeight: '600',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
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

  // Input
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    backgroundColor: SURFACE,
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: BG,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: TEXT_PRIMARY,
    fontSize: 15,
  },
  addItemBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
