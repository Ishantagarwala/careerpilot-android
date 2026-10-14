import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ArrowRight, AlertCircle, Plus, Minus } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { Card } from '../src/components/primitives/Card';
import { radii, spacing, typography } from '../src/theme/tokens';
import { AtsAnalysisResult } from '../src/api/resume';

/**
 * Bucket weights are fixed by the rubric (only their labels vary per career
 * domain, and the mobile app has no domain rubric config), so neutral labels
 * are used and the scored domain is shown next to the score.
 */
const RUBRIC_BUCKETS = [
  { key: 'openSource', label: 'Community Impact', max: 35 },
  { key: 'selfProjects', label: 'Projects & Proof', max: 30 },
  { key: 'production', label: 'Relevant Experience', max: 25 },
  { key: 'technicalSkills', label: 'Domain Skills', max: 10 },
] as const;

export default function AtsResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    resultData?: string;
    sourceMode?: string;
    resumeId?: string;
    resumeTitle?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();

  const analysis: AtsAnalysisResult | null = useMemo(() => {
    if (!params.resultData) return null;
    try {
      return JSON.parse(params.resultData);
    } catch {
      return null;
    }
  }, [params.resultData]);

  if (!analysis) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="ATS result" isRoot={false} />
        <View style={styles.errorContainer}>
          <AlertCircle size={40} color={hub.danger} />
          <Text style={[styles.errorTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
            No analysis results available
          </Text>
          <Text style={[styles.errorSubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
            Please run an analysis from the ATS analyzer first.
          </Text>
          <Button
            label="Go to ATS analyzer"
            onPress={() => router.replace('/ats' as any)}
            variant="primary"
            style={{ marginTop: spacing.base }}
          />
        </View>
      </View>
    );
  }

  const score = typeof analysis.score === 'number' ? analysis.score : 0;
  const bonus = analysis.bonus || 0;
  const deductions = analysis.deductions || 0;
  const summary = analysis.summary || '';
  const strengths = analysis.strengths || [];
  const suggestions = analysis.suggestions || [];
  const bonusItems = analysis.bonusItems || [];
  const deductionItems = analysis.deductionItems || [];
  const evidence = analysis.evidence || {};

  const isSavedResume = params.sourceMode === 'saved' && Boolean(params.resumeId);

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="ATS result" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          AI RESUME ANALYSIS
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          A clearer path{'\n'}to a stronger resume.
        </Text>

        {/* Score Card matching mockup */}
        <Card style={styles.scoreCard}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNumber, { color: hub.text, fontFamily: typography.fontHeading }]}>
              {score}
            </Text>
            <Text style={[styles.scoreTotal, { color: hub.muted, fontFamily: typography.fontHeadingMedium }]}>
              /120
            </Text>
          </View>
          <Text style={[styles.scoreLabel, { color: hub.muted, fontFamily: typography.fontBody }]}>
            Career rubric score
          </Text>
          {analysis.tier ? (
            <View style={[styles.tierTag, { borderColor: hub.line }]}>
              <Text style={[styles.tierText, { color: hub.text, fontFamily: typography.fontMonoMedium }]}>
                {analysis.tier.toUpperCase()}
              </Text>
            </View>
          ) : null}
          {analysis.careerDomain ? (
            <Text style={[styles.scoreDomain, { color: hub.muted, fontFamily: typography.fontMono }]}>
              {analysis.careerDomain.toUpperCase()} RUBRIC
            </Text>
          ) : null}
        </Card>

        {/* Recruiter summary */}
        {Boolean(summary) && (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionHeading, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              Recruiter summary
            </Text>
            <Text style={[styles.sectionBody, { color: hub.muted, fontFamily: typography.fontBody }]}>
              {summary}
            </Text>
          </View>
        )}

        {/* Rubric breakdown with evidence */}
        <Card style={styles.breakdownCard}>
          <Text style={[styles.breakdownTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
            Rubric breakdown
          </Text>
          {RUBRIC_BUCKETS.map((bucket) => {
            const value = analysis[bucket.key] ?? 0;
            const bucketEvidence = evidence[bucket.key] || [];
            return (
              <View key={bucket.key} style={styles.breakdownGroup}>
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: hub.muted, fontFamily: typography.fontBody }]}>
                    {bucket.label}
                  </Text>
                  <Text style={[styles.breakdownVal, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                    {value}/{bucket.max}
                  </Text>
                </View>
                {bucketEvidence.slice(0, 2).map((line, idx) => (
                  <View key={idx} style={styles.editItem}>
                    <Text style={[styles.editNumber, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                      •
                    </Text>
                    <Text style={[styles.editText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
          {(bonus > 0 || deductions > 0) && (
            <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: hub.line, paddingTop: spacing.sm }]}>
              <Text style={[styles.breakdownLabel, { color: hub.muted, fontFamily: typography.fontBody }]}>
                Bonus / deductions
              </Text>
              <Text style={[styles.breakdownVal, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                +{bonus} / −{deductions}
              </Text>
            </View>
          )}
        </Card>

        {/* Bonus signals */}
        {bonusItems.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionTitleRow}>
              <Plus size={16} color={hub.text} />
              <Text
                style={[
                  styles.sectionHeading,
                  { marginBottom: 0, color: hub.text, fontFamily: typography.fontHeadingMedium },
                ]}
              >
                Bonus (+{bonus})
              </Text>
            </View>
            <View style={styles.editsList}>
              {bonusItems.map((item, idx) => (
                <View key={idx} style={styles.editItem}>
                  <Text style={[styles.editNumber, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                    +
                  </Text>
                  <Text style={[styles.editText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Deductions */}
        {deductionItems.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionTitleRow}>
              <Minus size={16} color={hub.text} />
              <Text
                style={[
                  styles.sectionHeading,
                  { marginBottom: 0, color: hub.text, fontFamily: typography.fontHeadingMedium },
                ]}
              >
                Deductions (−{deductions})
              </Text>
            </View>
            <View style={styles.editsList}>
              {deductionItems.map((item, idx) => (
                <View key={idx} style={styles.editItem}>
                  <Text style={[styles.editNumber, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                    −
                  </Text>
                  <Text style={[styles.editText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionHeading, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              Strengths
            </Text>
            <View style={styles.editsList}>
              {strengths.map((item, idx) => (
                <View key={idx} style={styles.editItem}>
                  <Check size={16} color={hub.text} style={{ marginTop: 3 }} />
                  <Text style={[styles.editText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Suggested improvements */}
        {suggestions.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionHeading, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              How to improve
            </Text>
            <View style={styles.editsList}>
              {suggestions.map((item, idx) => (
                <View key={idx} style={styles.editItem}>
                  <Text style={[styles.editNumber, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                    {idx + 1}.
                  </Text>
                  <Text style={[styles.editText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Button */}
        {isSavedResume ? (
          <Button
            label="Edit resume to improve match"
            onPress={() => {
              router.push({
                pathname: '/editor',
                params: { id: params.resumeId },
              });
            }}
            variant="primary"
            icon={<ArrowRight size={18} color={hub.bg} />}
            iconPosition="right"
            style={styles.actionBtn}
          />
        ) : (
          <Button
            label="Back to ATS analyzer"
            onPress={() => router.back()}
            variant="primary"
            icon={<ArrowRight size={18} color={hub.bg} />}
            iconPosition="right"
            style={styles.actionBtn}
          />
        )}

        {/* Advisory AI Language Disclaimer */}
        <Text style={[styles.disclaimerText, { color: hub.muted, fontFamily: typography.fontBody }]}>
          Advisory AI analysis: the score reflects a career rubric weighing open-source work, projects, production experience and demonstrated skills. It is an educational guide and does not guarantee interview callbacks or employer decisions.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  eyebrow: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.5,
    marginBottom: spacing.xxs,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  scoreCard: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  scoreNumber: {
    fontSize: 64,
    lineHeight: 70,
    fontWeight: '800',
  },
  scoreTotal: {
    fontSize: typography.sizes.heading,
    marginLeft: 4,
  },
  scoreLabel: {
    fontSize: typography.sizes.body,
  },
  tierTag: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tierText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.8,
  },
  scoreDomain: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  sectionContainer: {
    marginBottom: spacing.xl,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    fontSize: typography.sizes.heading,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
  editsList: {
    gap: spacing.sm,
  },
  editItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  editNumber: {
    fontSize: typography.sizes.body,
    width: 20,
  },
  editText: {
    flex: 1,
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
  breakdownCard: {
    padding: spacing.base,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  breakdownTitle: {
    fontSize: typography.sizes.body,
    marginBottom: spacing.xxs,
  },
  breakdownGroup: {
    gap: spacing.xxs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: typography.sizes.fine,
  },
  breakdownVal: {
    fontSize: typography.sizes.fine,
  },
  actionBtn: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  disclaimerText: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorTitle: {
    fontSize: typography.sizes.heading,
  },
  errorSubtitle: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
  },
});
