import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CAREER_DOMAINS,
  DOMAIN_LABELS,
  generateNicheCatalog,
  runAssessment,
  type CareerDomain,
  type SkillItem,
  type SkillLevel,
} from '@/api/assessment';
import { BrandButton } from '@/components/brand/BrandControls';
import { ChevronGlyph, PlusGlyph } from '@/components/glyphs/TabGlyphs';
import { useCareer } from '@/career/useCareer';
import { haptics } from '@/ui/haptics';
import { brandLight, elevation, fontFamily, radius, space } from '@/theme/tokens';

/**
 * Career assessment — Language A (brand).
 *
 * A five-step wizard. The steps are ordered so the cheapest answer comes first
 * and the most demanding (free-text goals) last, which matters because a
 * student who abandons halfway has still given something usable.
 *
 * Two server facts shape the interaction:
 *  - The request costs TWO model calls and is budgeted at 5 per user per hour,
 *    so submitting is an explicit, confirmed action — never fired on a stray tap
 *    and never retried automatically.
 *  - A failed request must keep every answer on screen. The web app learned this
 *    the hard way (scripts/check-hud-progress.mjs): a progress overlay that kept
 *    running after a failure parked on its last step with no error visible.
 *    Here the error is shown and the answers survive.
 */
type Step = 'domain' | 'interests' | 'subjects' | 'goals' | 'skills';

const STEP_ORDER: Step[] = ['domain', 'interests', 'subjects', 'goals', 'skills'];

const STEP_TITLES: Record<Step, string> = {
  domain: 'What field are you aiming at?',
  interests: 'What interests you?',
  subjects: 'What have you studied?',
  goals: 'What do you want to reach?',
  skills: 'What can you already do?',
};

const STEP_HINTS: Record<Step, string> = {
  domain: 'Pick the closest one. You can choose Other if nothing fits.',
  interests: 'Tap a few. These steer the recommendation, so be honest rather than aspirational.',
  subjects: 'Subjects you have actually taken — coursework counts.',
  goals: 'In your own words. A sentence or two is plenty.',
  skills: 'Add what you can demonstrably do, and how well.',
};

/** Sensible starting points per domain so no step begins as a blank box. */
const SUGGESTIONS: Record<CareerDomain, { interests: string[]; subjects: string[] }> = {
  technology: {
    interests: ['Building things', 'Problem solving', 'Open source', 'AI', 'Web apps'],
    subjects: ['Programming', 'Data Structures', 'Databases', 'Mathematics'],
  },
  healthcare: {
    interests: ['Helping people', 'Biology', 'Public health', 'Research'],
    subjects: ['Biology', 'Chemistry', 'Anatomy', 'Public Health'],
  },
  business: {
    interests: ['Markets', 'Entrepreneurship', 'Finance', 'Strategy'],
    subjects: ['Economics', 'Accounting', 'Marketing', 'Statistics'],
  },
  design: {
    interests: ['Visual design', 'User experience', 'Illustration', 'Typography'],
    subjects: ['Design Principles', 'Typography', 'Human-Computer Interaction'],
  },
  law: {
    interests: ['Policy', 'Debate', 'Rights', 'Governance'],
    subjects: ['Political Science', 'Constitutional Law', 'Economics'],
  },
  education: {
    interests: ['Teaching', 'Curriculum', 'Child development', 'EdTech'],
    subjects: ['Pedagogy', 'Psychology', 'Subject Specialism'],
  },
  science: {
    interests: ['Research', 'Experiments', 'Theory', 'Publication'],
    subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],
  },
  engineering: {
    interests: ['Machines', 'Systems', 'Materials', 'Infrastructure'],
    subjects: ['Mechanics', 'Thermodynamics', 'Circuits', 'Mathematics'],
  },
  other: {
    interests: [],
    subjects: [],
  },
};

const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];

export default function AssessmentScreen() {
  const insets = useSafeAreaInsets();
  const { reload } = useCareer();

  const [step, setStep] = useState<Step>('domain');
  const [domain, setDomain] = useState<CareerDomain | null>(null);
  const [niche, setNiche] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [goals, setGoals] = useState('');
  const [skills, setSkills] = useState<SkillItem[]>([]);

  // suggestion pools, replaced by the niche catalog when one is generated
  const [suggestedInterests, setSuggestedInterests] = useState<string[]>([]);
  const [suggestedSubjects, setSuggestedSubjects] = useState<string[]>([]);
  const [nicheBusy, setNicheBusy] = useState(false);
  const [nicheError, setNicheError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);

  const toggle = (list: string[], set: (next: string[]) => void, value: string) => {
    haptics.tap();
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const chooseDomain = useCallback((next: CareerDomain) => {
    haptics.tap();
    setDomain(next);
    setSuggestedInterests(SUGGESTIONS[next].interests);
    setSuggestedSubjects(SUGGESTIONS[next].subjects);
    // Selections from a previous domain would otherwise leak into the new one.
    setInterests([]);
    setSubjects([]);
    setNicheError(null);
  }, []);

  /** Ask the server for suggestions tailored to a niche it does not know. */
  const fetchNicheCatalog = useCallback(async () => {
    const value = niche.trim();
    if (!value) return;
    setNicheBusy(true);
    setNicheError(null);
    try {
      const catalog = await generateNicheCatalog(value);
      if (!catalog.interests.length && !catalog.subjects.length) {
        setNicheError('No suggestions came back for that. Add your own below.');
      } else {
        setSuggestedInterests(catalog.interests);
        setSuggestedSubjects(catalog.subjects);
        setInterests([]);
        setSubjects([]);
      }
    } catch (err) {
      setNicheError(err instanceof Error ? err.message : 'Could not generate suggestions.');
    } finally {
      setNicheBusy(false);
    }
  }, [niche]);

  const canAdvance =
    (step === 'domain' && domain !== null) ||
    (step === 'interests' && interests.length > 0) ||
    (step === 'subjects' && subjects.length > 0) ||
    (step === 'goals' && goals.trim().length >= 20) ||
    (step === 'skills' && skills.length > 0);

  async function submit() {
    if (!domain || busy) return;
    setBusy(true);
    setError(null);
    try {
      await runAssessment({
        careerDomain: domain,
        careerNiche: domain === 'other' ? niche : niche.trim() || undefined,
        interests,
        goals: goals.trim(),
        subjects,
        skills,
      });
      // Refresh so the Career tab reflects the new recommendations immediately.
      await reload();
      haptics.confirm();
      router.replace('/(tabs)/career');
    } catch (err) {
      // Answers are intentionally NOT cleared: the server budgets this call, so
      // losing them would cost the user one of five attempts for nothing.
      haptics.warn();
      setError(err instanceof Error ? err.message : 'The assessment failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.s3 }]}>
        <Pressable
          onPress={() => (stepIndex === 0 ? router.back() : setStep(STEP_ORDER[stepIndex - 1]!))}
          accessibilityRole="button"
          accessibilityLabel={stepIndex === 0 ? 'Close assessment' : 'Previous step'}
          hitSlop={10}
          style={styles.back}
        >
          <View style={styles.backIcon}>
            <ChevronGlyph color={brandLight.foreground} size={20} />
          </View>
        </Pressable>

        <View style={styles.progress}>
          {STEP_ORDER.map((s, i) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                {
                  backgroundColor:
                    i <= stepIndex ? brandLight.primary : brandLight.muted,
                },
              ]}
            />
          ))}
        </View>

        <Text style={styles.stepCount}>
          {stepIndex + 1}/{STEP_ORDER.length}
        </Text>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s8 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{STEP_TITLES[step]}</Text>
        <Text style={styles.hint}>{STEP_HINTS[step]}</Text>

        {step === 'domain' ? (
          <View style={styles.stack}>
            {CAREER_DOMAINS.map((d) => (
              <Pressable
                key={d}
                onPress={() => chooseDomain(d)}
                accessibilityRole="radio"
                accessibilityLabel={DOMAIN_LABELS[d]}
                accessibilityState={{ selected: domain === d }}
                style={[styles.option, domain === d ? styles.optionOn : null]}
              >
                <Text style={styles.optionText}>{DOMAIN_LABELS[d]}</Text>
                {domain === d ? <View style={styles.tick} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 'domain' && domain === 'other' ? (
          <View style={styles.nicheBlock}>
            <Text style={styles.fieldLabel}>Describe the path</Text>
            <TextInput
              value={niche}
              onChangeText={setNiche}
              placeholder="e.g. Hotel management, commercial pilot, organic farming"
              placeholderTextColor="#8b9179"
              accessibilityLabel="Niche description"
              style={styles.input}
            />
            <View style={{ height: space.s3 }} />
            <BrandButton
              label="Suggest interests"
              variant="ghost"
              onPress={fetchNicheCatalog}
              loading={nicheBusy}
              disabled={niche.trim().length < 3}
            />
            {nicheError ? <Text style={styles.nicheError}>{nicheError}</Text> : null}
          </View>
        ) : null}

        {step === 'interests' || step === 'subjects' ? (
          <ChipStep
            suggestions={step === 'interests' ? suggestedInterests : suggestedSubjects}
            selected={step === 'interests' ? interests : subjects}
            onToggle={(v) =>
              toggle(
                step === 'interests' ? interests : subjects,
                step === 'interests' ? setInterests : setSubjects,
                v,
              )
            }
          />
        ) : null}

        {step === 'goals' ? (
          <View>
            <TextInput
              value={goals}
              onChangeText={setGoals}
              placeholder="I want to become a backend developer at a product company within a year, and I am willing to spend about ten hours a week."
              placeholderTextColor="#8b9179"
              multiline
              accessibilityLabel="Your goals"
              style={[styles.input, styles.textarea]}
            />
            {/* A minimum length is enforced because the model is asked to reason
                from this text; a three-word answer produces a generic result. */}
            <Text style={styles.counter}>
              {goals.trim().length < 20
                ? `${20 - goals.trim().length} more characters needed`
                : `${goals.trim().length} characters`}
            </Text>
          </View>
        ) : null}

        {step === 'skills' ? <SkillStep skills={skills} setSkills={setSkills} domain={domain} /> : null}

        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {step === 'skills' ? (
            <>
              <BrandButton label="Get my recommendations" onPress={submit} loading={busy} disabled={!canAdvance} />
              <Text style={styles.costNote}>
                This uses two AI calls from your hourly allowance.
              </Text>
            </>
          ) : (
            <BrandButton
              label="Continue"
              onPress={() => setStep(STEP_ORDER[stepIndex + 1]!)}
              disabled={!canAdvance}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Multi-select chips with a free-text escape hatch. */
function ChipStep({
  suggestions,
  selected,
  onToggle,
}: {
  suggestions: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [custom, setCustom] = useState('');

  // Anything the user typed is shown alongside the suggestions, so a custom
  // entry does not vanish the moment the list re-renders.
  const customEntries = selected.filter((v) => !suggestions.includes(v));
  const all = [...suggestions, ...customEntries];

  function addCustom() {
    const value = custom.trim();
    if (!value) return;
    if (!selected.includes(value)) onToggle(value);
    setCustom('');
  }

  return (
    <View>
      <View style={styles.chips}>
        {all.map((value) => {
          const on = selected.includes(value);
          return (
            <Pressable
              key={value}
              onPress={() => onToggle(value)}
              accessibilityRole="checkbox"
              accessibilityLabel={value}
              accessibilityState={{ checked: on }}
              style={[styles.chip, on ? styles.chipOn : null]}
            >
              <Text style={styles.chipText}>{value}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.addRow}>
        <TextInput
          value={custom}
          onChangeText={setCustom}
          placeholder="Add your own…"
          placeholderTextColor="#8b9179"
          onSubmitEditing={addCustom}
          returnKeyType="done"
          accessibilityLabel="Add your own"
          style={[styles.input, styles.addInput]}
        />
        <Pressable
          onPress={addCustom}
          disabled={!custom.trim()}
          accessibilityRole="button"
          accessibilityLabel="Add"
          style={[styles.addButton, !custom.trim() ? styles.addButtonOff : null]}
        >
          <PlusGlyph color={brandLight.foreground} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

function SkillStep({
  skills,
  setSkills,
  domain,
}: {
  skills: SkillItem[];
  setSkills: (next: SkillItem[]) => void;
  domain: CareerDomain | null;
}) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<SkillLevel>('intermediate');

  function add() {
    const value = name.trim();
    if (!value) return;
    if (skills.some((s) => s.name.toLowerCase() === value.toLowerCase())) {
      setName('');
      return;
    }
    haptics.tap();
    setSkills([...skills, { name: value, level }]);
    setName('');
  }

  return (
    <View>
      {skills.length === 0 ? (
        <Text style={styles.emptySkills}>
          No skills added yet. Even one is enough to start.
        </Text>
      ) : (
        <View style={styles.stack}>
          {skills.map((skill) => (
            <View key={skill.name} style={styles.skillRow}>
              <View style={styles.flex}>
                <Text style={styles.skillName}>{skill.name}</Text>
                <Text style={styles.skillLevel}>{skill.level}</Text>
              </View>
              <Pressable
                onPress={() => setSkills(skills.filter((s) => s.name !== skill.name))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${skill.name}`}
                hitSlop={10}
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.addRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={domain ? `e.g. ${SUGGESTIONS[domain].subjects[0] ?? 'JavaScript'}` : 'e.g. JavaScript'}
          placeholderTextColor="#8b9179"
          onSubmitEditing={add}
          returnKeyType="done"
          accessibilityLabel="Skill name"
          style={[styles.input, styles.addInput]}
        />
        <Pressable
          onPress={add}
          disabled={!name.trim()}
          accessibilityRole="button"
          accessibilityLabel="Add skill"
          style={[styles.addButton, !name.trim() ? styles.addButtonOff : null]}
        >
          <PlusGlyph color={brandLight.foreground} size={18} />
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>Level</Text>
      <View style={styles.levels}>
        {SKILL_LEVELS.map((l) => (
          <Pressable
            key={l}
            onPress={() => setLevel(l)}
            accessibilityRole="radio"
            accessibilityLabel={l}
            accessibilityState={{ selected: level === l }}
            style={[styles.level, level === l ? styles.levelOn : null]}
          >
            <Text style={styles.levelText}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const b = brandLight;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s4,
    paddingBottom: space.s3,
  },
  back: { padding: 4 },
  backIcon: { transform: [{ rotate: '180deg' }] },
  progress: { flex: 1, flexDirection: 'row', gap: 4 },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  stepCount: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 12,
    color: b.mutedForeground,
  },

  body: { paddingHorizontal: space.s4 },
  title: {
    fontFamily: 'Anybody_800ExtraBold',
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -1,
    color: b.foreground,
    marginTop: space.s2,
  },
  hint: {
    fontSize: 14,
    lineHeight: 21,
    color: b.mutedForeground,
    marginTop: space.s2,
    marginBottom: space.s5,
  },

  stack: { gap: space.s2, marginBottom: space.s4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: space.s4,
    borderWidth: 2,
    borderColor: b.border,
    borderRadius: radius.brand,
    backgroundColor: b.card,
  },
  optionOn: { backgroundColor: b.primary },
  optionText: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 15,
    color: b.foreground,
  },
  tick: {
    width: 8,
    height: 14,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: b.foreground,
    transform: [{ rotate: '40deg' }, { translateY: -2 }],
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.s4 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: b.border,
    borderRadius: radius.brand,
    backgroundColor: b.card,
  },
  chipOn: { backgroundColor: b.primary },
  chipText: { fontFamily: fontFamily.sansMedium, fontSize: 14, color: b.foreground },

  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addInput: { flex: 1, marginBottom: 0 },
  addButton: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: b.border,
    borderRadius: radius.brand,
    backgroundColor: b.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.brandSmall,
  },
  addButtonOff: { opacity: 0.45 },

  fieldLabel: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: b.foreground,
    marginTop: space.s5,
    marginBottom: 7,
  },
  input: {
    minHeight: 50,
    borderWidth: 2,
    borderColor: b.border,
    backgroundColor: b.card,
    borderRadius: radius.brand,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fontFamily.sansMedium,
    fontSize: 15,
    color: b.foreground,
  },
  textarea: { minHeight: 150, textAlignVertical: 'top' },
  counter: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: b.mutedForeground,
    marginTop: 6,
    textAlign: 'right',
  },

  nicheBlock: { marginBottom: space.s5 },
  nicheError: { fontSize: 12.5, color: b.destructive, marginTop: 10 },

  emptySkills: {
    fontSize: 13.5,
    color: b.mutedForeground,
    marginBottom: space.s3,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    borderWidth: 2,
    borderColor: b.border,
    borderRadius: radius.brand,
    backgroundColor: b.card,
    paddingHorizontal: space.s3,
    paddingVertical: 12,
  },
  skillName: { fontFamily: fontFamily.sansSemiBold, fontSize: 14.5, color: b.foreground },
  skillLevel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: b.mutedForeground,
    marginTop: 2,
  },
  remove: {
    fontFamily: fontFamily.monoBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: b.destructive,
  },
  levels: { flexDirection: 'row', gap: 8 },
  level: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: b.border,
    borderRadius: radius.brand,
    backgroundColor: b.card,
  },
  levelOn: { backgroundColor: b.primary },
  levelText: { fontFamily: fontFamily.monoMedium, fontSize: 12, color: b.foreground },

  error: {
    marginTop: space.s4,
    borderWidth: 2,
    borderColor: b.destructive,
    borderRadius: radius.brand,
    padding: space.s3,
    backgroundColor: '#fdf3f3',
  },
  errorText: { fontSize: 13.5, lineHeight: 19, color: b.destructive },

  actions: { marginTop: space.s6 },
  costNote: {
    fontSize: 12,
    color: b.mutedForeground,
    textAlign: 'center',
    marginTop: 10,
  },
});
