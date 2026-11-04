import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Kicker, Pill } from '../components/Controls';
import { ManeuverIcon } from '../components/ManeuverIcon';
import { Tap } from '../components/Tap';
import { formatDistance, formatDuration, formatSaved, shortLabel } from '../lib/format';
import { useTrip } from '../state/TripProvider';
import { colors, fonts, radius, shadow } from '../theme';
import type { Maneuver, RouteLine } from '../types';

export default function DetailsScreen() {
  const insets = useSafeAreaInsets();
  const { routes, mode, destination, activeRoute, setActiveRoute } = useTrip();

  if (!routes) return <Redirect href="/" />;

  const shortest = routes.shortest;
  const fastest = routes.fastest;
  const isFastest = activeRoute === 'fastest';
  const route: RouteLine = isFastest ? fastest : shortest;
  const saved = Math.max(0, fastest.distanceMeters - shortest.distanceMeters);
  const sourceLabel = routes.source === 'valhalla' ? 'Valhalla routing' : 'Live OSM graph';

  const shareRoute = () => {
    void Share.share({
      message: `Short Cut: ${formatDistance(route.distanceMeters)} · ${formatDuration(
        route.durationSeconds,
      )} to ${destination ? shortLabel(destination.label, 2) : 'my destination'}.`,
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Tap
          style={styles.headerButton}
          onPress={() => router.back()}
          haptic="light"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={19} color={colors.ink} />
        </Tap>
        <View style={styles.headerCopy}>
          <Kicker>Route details</Kicker>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {destination ? shortLabel(destination.label, 2) : 'Your route'}
          </Text>
        </View>
        <Tap
          style={styles.headerButton}
          onPress={shareRoute}
          haptic="light"
          accessibilityLabel="Share route summary"
        >
          <Ionicons name="share-outline" size={18} color={colors.ink} />
        </Tap>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 116 }]}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Kicker color={colors.mintBright}>
              {isFastest ? 'Fastest route' : 'Shortest route'}
            </Kicker>
            <View style={styles.heroPill}>
              <View style={styles.heroPillDot} />
              <Text style={styles.heroPillText}>
                {isFastest ? 'Time-first' : 'Distance-first'}
              </Text>
            </View>
          </View>

          <View style={styles.heroMetrics}>
            <View style={styles.heroDistance}>
              <Text style={styles.heroValue}>
                {formatDistance(route.distanceMeters).replace(/\s?(km|m)$/, '')}
                <Text style={styles.heroUnit}>
                  {' '}
                  {route.distanceMeters < 1000 ? 'm' : 'km'}
                </Text>
              </Text>
              <Text style={styles.heroCaption}>total distance</Text>
            </View>
            <View style={styles.heroTime}>
              <Text style={styles.heroTimeValue}>{formatDuration(route.durationSeconds)}</Text>
              <Text style={styles.heroCaption}>estimated time</Text>
            </View>
          </View>

          <View style={styles.heroRule} />

          <View style={styles.heroStats}>
            <HeroStat
              label={isFastest ? 'Shortest' : 'Fastest'}
              value={formatDistance(isFastest ? shortest.distanceMeters : fastest.distanceMeters)}
            />
            <View style={styles.heroStatRule} />
            <HeroStat
              label={saved >= 25 ? (isFastest ? 'Extra' : 'You save') : 'Difference'}
              value={saved >= 25 ? formatSaved(saved) : 'Optimal'}
              accent={!isFastest && saved >= 25}
            />
            <View style={styles.heroStatRule} />
            <HeroStat label="Mode" value={mode === 'riding' ? 'Ride' : 'Walk'} />
          </View>
        </View>

        <View style={styles.switcher}>
          <RouteTab
            active={!isFastest}
            label="Shortest"
            distance={shortest.distanceMeters}
            color={colors.coral}
            onPress={() => setActiveRoute('shortest')}
          />
          <RouteTab
            active={isFastest}
            label="Fastest"
            distance={fastest.distanceMeters}
            color={colors.teal}
            onPress={() => setActiveRoute('fastest')}
          />
        </View>

        {isFastest ? (
          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={14} color={colors.muted} />
            <Text style={styles.noteText}>
              This route is {formatSaved(saved)} longer but quicker on mapped streets. Times
              exclude live traffic.
            </Text>
          </View>
        ) : (
          <View style={styles.noteRow}>
            <Ionicons name="git-commit-outline" size={14} color={colors.muted} />
            <Text style={styles.noteText}>
              Distance-first route. Mapped one-way and access rules are applied.
            </Text>
          </View>
        )}

        {route.warnings.length ? (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle" size={16} color={colors.amber} />
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Road notes</Text>
              {route.warnings.map((warning) => (
                <Text key={warning} style={styles.warningText}>
                  {warning}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Kicker color={colors.muted}>Turn by turn</Kicker>
          <View style={styles.rule} />
          <Pill
            label={`${route.maneuvers.length} steps`}
            background={colors.surfaceAlt}
            color={colors.muted}
          />
        </View>

        <View style={styles.stepsCard}>
          {route.maneuvers.map((maneuver, index) => (
            <ManeuverItem
              key={maneuver.key}
              maneuver={maneuver}
              distance={distanceToNext(route, index)}
              last={index === route.maneuvers.length - 1}
            />
          ))}
        </View>

        <View style={styles.sourceCard}>
          <View style={styles.sourceRow}>
            <Ionicons name="git-network-outline" size={15} color={colors.teal} />
            <Text style={styles.sourceText}>{sourceLabel}</Text>
            <Pill label="OSM" background={colors.tealSoft} color={colors.teal} />
          </View>
          <Text style={styles.sourceNote}>
            Routes respect mapped one-way and access restrictions. Map coverage varies; report
            missing connections so Short Cut can improve.
          </Text>
          <Tap
            haptic="none"
            onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}
            accessibilityLabel="Open map data attribution"
          >
            <Text style={styles.sourceLink}>© OpenStreetMap contributors</Text>
          </Tap>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Tap
          style={styles.cta}
          onPress={() => router.push('/navigate')}
          haptic="medium"
          accessibilityLabel="Start navigation"
        >
          <Ionicons name="navigate" size={18} color={colors.white} />
          <Text style={styles.ctaText}>Start navigation</Text>
          <View style={styles.ctaArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.coral} />
          </View>
        </Tap>
      </View>
    </View>
  );
}

function HeroStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={[styles.heroStatValue, accent && styles.heroStatAccent]}>{value}</Text>
    </View>
  );
}

function RouteTab({
  active,
  label,
  distance,
  color,
  onPress,
}: {
  active: boolean;
  label: string;
  distance: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <Tap
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Show ${label.toLowerCase()} route`}
    >
      <View style={[styles.tabDot, { backgroundColor: color, opacity: active ? 1 : 0.4 }]} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      <Text style={[styles.tabDistance, active && styles.tabDistanceActive]}>
        {formatDistance(distance)}
      </Text>
    </Tap>
  );
}

function ManeuverItem({
  maneuver,
  distance,
  last,
}: {
  maneuver: Maneuver;
  distance: number;
  last: boolean;
}) {
  const detail = maneuver.detail?.trim();
  const redundant =
    Boolean(detail) &&
    detail!.replace(/[.\s]/g, '').toLowerCase() ===
      maneuver.instruction.replace(/[.\s]/g, '').toLowerCase();
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRail}>
        <View style={[styles.stepDotWrap, maneuver.type === 'arrive' && styles.stepDotWrapEnd]}>
          <ManeuverIcon
            maneuver={maneuver}
            size={15}
            containerSize={34}
            color={maneuver.type === 'arrive' ? colors.white : colors.coral}
            background={maneuver.type === 'arrive' ? colors.ink : colors.coralSoft}
          />
        </View>
        {!last ? <View style={styles.stepLine} /> : null}
      </View>
      <View style={[styles.stepCopy, !last && styles.stepCopyBorder]}>
        <Text style={styles.stepTitle}>{maneuver.instruction}</Text>
        {detail && !redundant ? (
          <Text style={styles.stepDetail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={styles.stepDistance}>{last ? 'End' : formatDistance(distance)}</Text>
    </View>
  );
}

function distanceToNext(route: RouteLine, index: number): number {
  const current = route.maneuvers[index];
  const next = route.maneuvers[index + 1];
  if (!next) return 0;
  return Math.max(0, next.distanceFromStart - current.distanceFromStart);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadow.tiny,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 18,
    letterSpacing: -0.6,
    color: colors.ink,
  },
  scroll: {
    paddingHorizontal: 18,
  },
  hero: {
    padding: 17,
    borderRadius: radius.xl,
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroPillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.mintBright,
  },
  heroPillText: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    letterSpacing: 0.4,
    color: 'rgba(240,242,233,0.8)',
  },
  heroMetrics: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  heroDistance: {
    flex: 1,
  },
  heroValue: {
    fontFamily: fonts.displayBold,
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: -3,
    color: colors.paper,
  },
  heroUnit: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.8,
    color: 'rgba(240,242,233,0.78)',
  },
  heroCaption: {
    marginTop: 1,
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: 'rgba(240,242,233,0.68)',
  },
  heroTime: {
    alignItems: 'flex-end',
    paddingBottom: 3,
  },
  heroTimeValue: {
    fontFamily: fonts.displaySemibold,
    fontSize: 21,
    letterSpacing: -0.6,
    color: colors.paper,
  },
  heroRule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
    backgroundColor: 'rgba(240,242,233,0.12)',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    flex: 1,
    gap: 3,
  },
  heroStatRule: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: 'rgba(240,242,233,0.12)',
    marginHorizontal: 10,
  },
  heroStatLabel: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: 'rgba(240,242,233,0.62)',
  },
  heroStatValue: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
    letterSpacing: -0.3,
    color: colors.paper,
  },
  heroStatAccent: {
    color: colors.mintBright,
  },
  switcher: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadow.tiny,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tabLabel: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.muted,
  },
  tabLabelActive: {
    color: colors.ink,
  },
  tabDistance: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: colors.muted,
  },
  tabDistanceActive: {
    color: colors.inkSoft,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 11,
    paddingHorizontal: 3,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 10,
    lineHeight: 14.5,
    color: colors.muted,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.amberSoft,
  },
  warningCopy: {
    flex: 1,
    gap: 2,
  },
  warningTitle: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.amber,
  },
  warningText: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 20,
    marginBottom: 9,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  stepsCard: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepRail: {
    alignItems: 'center',
    width: 34,
  },
  stepDotWrap: {
    marginTop: 10,
  },
  stepDotWrapEnd: {
    marginTop: 10,
  },
  stepLine: {
    width: 1.5,
    flex: 1,
    minHeight: 18,
    marginVertical: 3,
    backgroundColor: colors.line,
  },
  stepCopy: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 9,
    gap: 2,
  },
  stepCopyBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  stepTitle: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.ink,
  },
  stepDetail: {
    fontFamily: fonts.sans,
    fontSize: 10,
    lineHeight: 14,
    color: colors.muted,
  },
  stepDistance: {
    paddingTop: 13,
    fontFamily: fonts.semibold,
    fontSize: 9.5,
    color: colors.teal,
  },
  sourceCard: {
    marginTop: 16,
    padding: 13,
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
    gap: 7,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sourceText: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: colors.teal,
  },
  sourceNote: {
    fontFamily: fonts.sans,
    fontSize: 9.5,
    lineHeight: 13.5,
    color: colors.muted,
  },
  sourceLink: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.teal,
    textDecorationLine: 'underline',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: 'rgba(240,242,233,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.coral,
    shadowColor: colors.coralDeep,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: colors.white,
  },
  ctaArrow: {
    position: 'absolute',
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
