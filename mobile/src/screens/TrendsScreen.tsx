import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboarding } from '../context/OnboardingContext';
import { getMedicationHistory } from '../api/medications';
import type { HistoryLog } from '../api/medications';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type DayGroup = {
  date: string;
  label: string;
  logs: HistoryLog[];
  isMissed: boolean;
};

type MedStat = {
  medication_id: number;
  medication_name: string;
  dosage: string;
  dosage_metric: string;
  daysLogged: number;
  activeDays: number;
};

const DATE_RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
];

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildDayGroups(logs: HistoryLog[], days: number, startDate: string | null): DayGroup[] {
  const logsByDate = new Map<string, HistoryLog[]>();
  for (const log of logs) {
    const d = log.log_date;
    if (!logsByDate.has(d)) logsByDate.set(d, []);
    logsByDate.get(d)!.push(log);
  }
  const groups: DayGroup[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLogs = logsByDate.get(dateStr) ?? [];
    const isToday = i === 0;
    // Only flag as missed if the patient already had at least one active medication on that day
    const medicationExisted = !startDate || dateStr >= startDate;
    groups.push({
      date: dateStr,
      label: isToday ? 'Today' : formatDateLabel(dateStr),
      logs: dayLogs,
      isMissed: !isToday && dayLogs.length === 0 && medicationExisted,
    });
  }
  return groups;
}

function computeStreak(groups: DayGroup[]): number {
  let streak = 0;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (i === 0 && g.logs.length === 0) continue;
    if (g.logs.length > 0) streak++;
    else break;
  }
  return streak;
}

function adherenceMessage(pct: number): string {
  if (pct === 100) return 'Perfect record!';
  if (pct >= 90) return 'Great job!';
  if (pct >= 70) return 'Keep it up!';
  if (pct >= 50) return 'Room to improve';
  return "Let's get back on track";
}

function getPctColor(pct: number): string {
  if (pct >= 80) return Colors.PRIMARY;
  if (pct >= 50) return '#D97706';
  return Colors.ERROR;
}

// groups are [today, yesterday, ...]; returns stats with activeDays computed from first to last log
function buildMedStats(groups: DayGroup[]): MedStat[] {
  const medMap = new Map<number, { stat: Omit<MedStat, 'activeDays'>; oldestIdx: number }>();
  for (let i = 0; i < groups.length; i++) {
    const seenOnDay = new Set<number>();
    for (const log of groups[i].logs) {
      if (seenOnDay.has(log.medication_id)) continue;
      seenOnDay.add(log.medication_id);
      if (!medMap.has(log.medication_id)) {
        medMap.set(log.medication_id, {
          stat: {
            medication_id: log.medication_id,
            medication_name: log.medication_name,
            dosage: log.dosage,
            dosage_metric: log.dosage_metric,
            daysLogged: 0,
          },
          oldestIdx: i,
        });
      }
      const entry = medMap.get(log.medication_id)!;
      entry.stat.daysLogged++;
      entry.oldestIdx = i;
    }
  }
  return Array.from(medMap.values())
    .map(({ stat, oldestIdx }) => ({ ...stat, activeDays: oldestIdx + 1 }))
    .sort((a, b) => b.daysLogged - a.daysLogged);
}

// 7-day dot row
function DotCalendar({ groups }: { groups: DayGroup[] }) {
  const reversed = [...groups].reverse();
  return (
    <View style={calStyles.container}>
      <Text style={calStyles.heading}>Dose Calendar</Text>
      <View style={calStyles.row}>
        {reversed.map(g => {
          const isToday = g.label === 'Today';
          const logged = g.logs.length > 0;
          const missed = g.isMissed;
          return (
            <View key={g.date} style={{ flex: 1, alignItems: 'center', paddingBottom: 6 }}>
              <View
                style={[
                  calStyles.dot,
                  logged && calStyles.dotLogged,
                  missed && calStyles.dotMissed,
                  !logged && !missed && calStyles.dotPending,
                  isToday && logged && calStyles.dotTodayLogged,
                  isToday && !logged && calStyles.dotToday,
                ]}
              />
              <Text style={calStyles.dayInitial}>
                {new Date(g.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={calStyles.legend}>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendDot, calStyles.dotLogged]} />
          <Text style={calStyles.legendLabel}>Logged</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendDot, calStyles.dotMissed]} />
          <Text style={calStyles.legendLabel}>Missed</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendDot, calStyles.dotPending]} />
          <Text style={calStyles.legendLabel}>Pending</Text>
        </View>
      </View>
    </View>
  );
}

// 30-day calendar grid with proper week alignment and date numbers
function CalendarGrid({ groups }: { groups: DayGroup[] }) {
  const ordered = [...groups].reverse(); // oldest first
  if (ordered.length === 0) return null;

  const firstDate = new Date(ordered[0].date + 'T00:00:00');
  const startDayOfWeek = firstDate.getDay(); // 0=Sun

  const cells: (DayGroup | null)[] = [
    ...Array<null>(startDayOfWeek).fill(null),
    ...ordered,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (DayGroup | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View style={gridStyles.container}>
      <Text style={gridStyles.heading}>30-Day Calendar</Text>
      <View style={gridStyles.row}>
        {WEEKDAY_HEADERS.map((d, i) => (
          <View key={i} style={gridStyles.cell}>
            <Text style={gridStyles.weekdayHeader}>{d}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={[gridStyles.row, { marginBottom: 5 }]}>
          {row.map((g, cellIdx) => {
            if (!g) {
              return <View key={`e-${rowIdx}-${cellIdx}`} style={gridStyles.cell} />;
            }
            const isToday = g.label === 'Today';
            const logged = g.logs.length > 0;
            const missed = g.isMissed;
            const dayNum = new Date(g.date + 'T00:00:00').getDate();
            return (
              <View key={g.date} style={gridStyles.cell}>
                <View
                  style={[
                    gridStyles.calCell,
                    logged && gridStyles.cellLogged,
                    missed && gridStyles.cellMissed,
                    isToday && logged && gridStyles.cellTodayLogged,
                    isToday && !logged && gridStyles.cellToday,
                  ]}
                >
                  <Text
                    style={[
                      gridStyles.cellDayNum,
                      logged && gridStyles.numLogged,
                      missed && gridStyles.numMissed,
                    ]}
                  >
                    {dayNum}
                  </Text>
                </View>
                {isToday && <View style={gridStyles.todayDot} />}
              </View>
            );
          })}
        </View>
      ))}
      <View style={gridStyles.legend}>
        <View style={gridStyles.legendItem}>
          <View style={[gridStyles.legendSwatch, { backgroundColor: Colors.PRIMARY }]} />
          <Text style={gridStyles.legendLabel}>Logged</Text>
        </View>
        <View style={gridStyles.legendItem}>
          <View style={[gridStyles.legendSwatch, { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: Colors.ERROR }]} />
          <Text style={gridStyles.legendLabel}>Missed</Text>
        </View>
        <View style={gridStyles.legendItem}>
          <View style={[gridStyles.legendSwatch, { borderWidth: 1, borderColor: Colors.DISABLED }]} />
          <Text style={gridStyles.legendLabel}>Pending</Text>
        </View>
      </View>
    </View>
  );
}

// Week-by-week adherence bars (30-day only)
function WeeklyTrend({ groups }: { groups: DayGroup[] }) {
  const ordered = [...groups].reverse(); // oldest first
  const weeks: { pct: number; logged: number; active: number; isCurrent: boolean }[] = [];

  for (let i = 0; i < ordered.length; i += 7) {
    const week = ordered.slice(i, Math.min(i + 7, ordered.length));
    const activeDays = week.filter(g => g.logs.length > 0 || g.isMissed).length;
    const loggedDays = week.filter(g => g.logs.length > 0).length;
    const pct = activeDays > 0 ? Math.round((loggedDays / activeDays) * 100) : 0;
    const isCurrent = i + 7 >= ordered.length;
    weeks.push({ pct, logged: loggedDays, active: activeDays, isCurrent });
  }

  return (
    <View style={trendStyles.container}>
      <Text style={trendStyles.heading}>Week by Week</Text>
      {weeks.map((w, i) => {
        const color = getPctColor(w.pct);
        const label = w.isCurrent ? 'This wk' : `Wk ${i + 1}`;
        return (
          <View key={i} style={trendStyles.row}>
            <Text style={trendStyles.weekLabel}>{label}</Text>
            <View style={trendStyles.track}>
              <View
                style={[
                  trendStyles.fill,
                  { width: `${w.pct}%` as any, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={[trendStyles.pctLabel, { color }]}>{w.pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

// Per-medication breakdown (30-day only)
function MedBreakdown({ groups }: { groups: DayGroup[] }) {
  const stats = buildMedStats(groups);
  if (stats.length === 0) return null;

  return (
    <View style={medStyles.container}>
      <Text style={medStyles.heading}>By Medication</Text>
      {stats.map(med => {
        const pct = Math.min(100, Math.round((med.daysLogged / med.activeDays) * 100));
        const color = getPctColor(pct);
        return (
          <View key={med.medication_id} style={medStyles.row}>
            <View style={medStyles.medInfo}>
              <Text style={medStyles.medName} numberOfLines={1}>{med.medication_name}</Text>
              <Text style={medStyles.medDose}>{med.dosage} {med.dosage_metric}</Text>
            </View>
            <View style={medStyles.rightCol}>
              <View style={medStyles.track}>
                <View
                  style={[medStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]}
                />
              </View>
              <Text style={[medStyles.dayCount, { color }]}>
                {med.daysLogged}d / {med.activeDays}d
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

type TrendsNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function TrendsScreen() {
  const navigation = useNavigation<TrendsNavProp>();
  const { patientId } = useOnboarding();
  const [selectedDays, setSelectedDays] = useState(7);
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [adherencePct, setAdherencePct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { logs, startDate: sd, adherencePercent = 0 } = await getMedicationHistory(patientId, selectedDays);
      setStartDate(sd);
      setGroups(buildDayGroups(logs, selectedDays, sd));
      setAdherencePct(adherencePercent);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [patientId, selectedDays]);

  useFocusEffect(useCallback(() => { fetchHistory(); }, [fetchHistory]));
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const hasAnyLogs = groups.some(g => g.logs.length > 0);
  const streak = groups.length > 0 ? computeStreak(groups) : 0;
  const is30Day = selectedDays === 30;

  function renderLogEntry(log: HistoryLog, isToday: boolean) {
    const time = new Date(log.logged_at).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    return (
      <View key={log.id} style={styles.logEntry}>
        {isToday ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('Survey')}
            accessibilityRole="button"
            accessibilityLabel={`Edit check-in for ${log.medication_name}`}
          >
            <Text style={[styles.logMedName, styles.logMedNameTappable]}>
              {log.medication_name}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.logMedName}>{log.medication_name}</Text>
        )}
        <Text style={styles.logDetail}>
          {log.dosage} {log.dosage_metric}  ·  {time}
        </Text>
      </View>
    );
  }

  function renderDayGroup({ item }: { item: DayGroup }) {
    const isToday = item.label === 'Today';
    const accentColor =
      item.logs.length > 0 ? Colors.PRIMARY
      : item.isMissed ? Colors.ERROR
      : Colors.DISABLED;

    return (
      <View style={styles.dayGroup}>
        <View style={[styles.dayAccent, { backgroundColor: accentColor }]} />
        <View style={styles.dayContent}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayLabel}>{item.label}</Text>
            {item.isMissed && <Text style={styles.missedBadge}>Missed</Text>}
            {item.logs.length > 0 && (
              <Text style={styles.loggedBadge}>
                {item.logs.length} dose{item.logs.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          {item.logs.length > 0
            ? item.logs.map(log => renderLogEntry(log, isToday))
            : (
              <Text style={styles.noLogsText}>
                {item.isMissed ? 'No doses logged' : 'No doses yet today'}
              </Text>
            )}
        </View>
      </View>
    );
  }

  const filterRow = (
    <View style={styles.filterRow}>
      {DATE_RANGES.map(r => (
        <TouchableOpacity
          key={r.days}
          style={[styles.filterBtn, selectedDays === r.days && styles.filterBtnActive]}
          onPress={() => setSelectedDays(r.days)}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedDays === r.days }}
        >
          <Text style={[styles.filterBtnText, selectedDays === r.days && styles.filterBtnTextActive]}>
            {r.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const listHeader = (
    <>
      {filterRow}
      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <Text style={styles.adherencePct}>{adherencePct}%</Text>
          <Text style={styles.adherenceSubLabel}>adherence</Text>
          <Text style={styles.adherenceMsg}>{adherenceMessage(adherencePct)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${adherencePct}%` as any }]} />
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRight}>
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakLabel}>day{streak !== 1 ? 's' : ''}</Text>
          <Text style={styles.streakLabel}>in a row</Text>
        </View>
      </View>

      {is30Day ? (
        <>
          <CalendarGrid groups={groups} />
          <WeeklyTrend groups={groups} />
          <MedBreakdown groups={groups} />
        </>
      ) : (
        <DotCalendar groups={groups} />
      )}

      <Text style={styles.sectionTitle}>History</Text>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trends</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={Colors.PRIMARY} />
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Could not load history. Pull to retry.</Text>
        </View>
      ) : !hasAnyLogs ? (
        <>
          {filterRow}
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No dose history yet — start logging to see your patterns
            </Text>
          </View>
        </>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={item => item.date}
          renderItem={renderDayGroup}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.list}
          onRefresh={fetchHistory}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
}

// 7-day dot calendar styles
const calStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    padding: 16,
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.BORDER,
    backgroundColor: 'transparent',
  },
  dotLogged: {
    backgroundColor: Colors.PRIMARY,
    borderColor: Colors.PRIMARY,
  },
  dotMissed: {
    backgroundColor: '#FEE2E2',
    borderColor: Colors.ERROR,
  },
  dotPending: {
    backgroundColor: 'transparent',
    borderColor: Colors.DISABLED,
    borderStyle: 'dashed',
  },
  dotToday: {
    borderWidth: 2.5,
    borderColor: Colors.PRIMARY,
  },
  dotTodayLogged: {
    borderWidth: 2.5,
    borderColor: Colors.PRIMARY_TEXT,
  },
  dayInitial: {
    fontSize: 10,
    color: Colors.TEXT_SECONDARY,
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.BORDER,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.BORDER,
  },
  legendLabel: {
    fontSize: 11,
    color: Colors.TEXT_SECONDARY,
  },
});

// 30-day calendar grid styles
const gridStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    padding: 16,
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.TEXT_SECONDARY,
    marginBottom: 6,
  },
  calCell: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cellLogged: {
    backgroundColor: Colors.PRIMARY,
  },
  cellMissed: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: Colors.ERROR,
  },
  // today + not yet logged: primary outline
  cellToday: {
    borderWidth: 2,
    borderColor: Colors.PRIMARY,
  },
  // today + already logged: cream outline on green bg
  cellTodayLogged: {
    borderWidth: 2,
    borderColor: Colors.PRIMARY_TEXT,
  },
  cellDayNum: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.TEXT_SECONDARY,
  },
  numLogged: {
    color: Colors.PRIMARY_TEXT,
    fontWeight: '700',
  },
  numMissed: {
    color: Colors.ERROR,
    fontWeight: '600',
  },
  // small dot below cell to mark today
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.PRIMARY,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.BORDER,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 11,
    color: Colors.TEXT_SECONDARY,
  },
});

// Week-by-week trend styles
const trendStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    padding: 16,
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.TEXT_SECONDARY,
    width: 52,
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.BORDER + '33',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 10,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  pctLabel: {
    fontSize: 12,
    fontWeight: '700',
    width: 38,
    textAlign: 'right',
  },
});

// Per-medication breakdown styles
const medStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    padding: 16,
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  medInfo: {
    width: 110,
    marginRight: 12,
  },
  medName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 1,
  },
  medDose: {
    fontSize: 11,
    color: Colors.TEXT_SECONDARY,
  },
  rightCol: {
    flex: 1,
  },
  track: {
    height: 8,
    backgroundColor: Colors.BORDER + '33',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  dayCount: {
    fontSize: 11,
    fontWeight: '600',
  },
});

// Main screen styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.BACKGROUND },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BORDER,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.TEXT_PRIMARY },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterBtn: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.BORDER,
  },
  filterBtnActive: {
    backgroundColor: Colors.PRIMARY,
    borderColor: Colors.PRIMARY,
  },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: Colors.TEXT_SECONDARY },
  filterBtnTextActive: { color: Colors.PRIMARY_TEXT },
  loader: { marginTop: 40 },
  list: { paddingBottom: 24 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.PRIMARY,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  summaryLeft: { flex: 1 },
  adherencePct: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.PRIMARY_TEXT,
    lineHeight: 48,
  },
  adherenceSubLabel: {
    fontSize: 13,
    color: 'rgba(253,251,237,0.7)',
    marginTop: 1,
    marginBottom: 4,
  },
  adherenceMsg: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.PRIMARY_TEXT,
    marginBottom: 10,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(253,251,237,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.PRIMARY_TEXT,
    borderRadius: 3,
  },
  summaryDivider: {
    width: 1,
    height: 64,
    backgroundColor: 'rgba(253,251,237,0.3)',
    marginHorizontal: 20,
  },
  summaryRight: { alignItems: 'center' },
  streakNum: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.PRIMARY_TEXT,
    lineHeight: 40,
  },
  streakLabel: {
    fontSize: 12,
    color: 'rgba(253,251,237,0.75)',
    textAlign: 'center',
  },

  // Section heading above history list
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  // Day group with colored left accent
  dayGroup: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  dayAccent: {
    width: 3,
    borderRadius: 2,
    marginRight: 12,
    minHeight: 36,
  },
  dayContent: { flex: 1 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.TEXT_PRIMARY,
  },
  missedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.ERROR,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  loggedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.PRIMARY_TEXT,
    backgroundColor: Colors.PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  logEntry: {
    backgroundColor: Colors.SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    padding: 12,
    marginBottom: 6,
  },
  logMedName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  logMedNameTappable: {
    color: Colors.PRIMARY,
    textDecorationLine: 'underline',
  },
  logDetail: {
    fontSize: 12,
    color: Colors.TEXT_SECONDARY,
  },
  noLogsText: {
    fontSize: 13,
    color: Colors.DISABLED,
    fontStyle: 'italic',
    paddingLeft: 4,
  },
});
