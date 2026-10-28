import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost } from '../api';

const inputCls = 'w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-lime-400/70 focus:ring-1 focus:ring-lime-400/20 transition';
const labelCls = 'text-[10px] text-zinc-500 block mb-1.5 font-bold tracking-widest uppercase';

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Biceps',
  'Triceps',
  'Shoulders',
  'Legs',
  'Core',
  'Cardio',
  'Full Body'
];

const EQUIPMENT_LIST = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Bands', 'Other'];

const DIFFICULTY_STYLES = {
  beginner: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  intermediate: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  advanced: 'bg-red-500/10 text-red-400 border-red-500/25'
};

const GOAL_STYLES = {
  'Muscle Gain': 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  'Fat Loss': 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  'Maintenance': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  'Ketogenic': 'bg-purple-500/10 text-purple-400 border-purple-500/25'
};

export default function FitnessPage() {
  const [activeTab, setActiveTab] = useState('exercises'); // 'exercises' | 'diet_catalog' | 'assign_studio'
  const [dietSubTab, setDietSubTab] = useState('plans'); // 'plans' | 'pantry'
  const [expandedPlanId, setExpandedPlanId] = useState(null);

  const [exercises, setExercises] = useState([]);
  const [dietCatalog, setDietCatalog] = useState({ foods: [], plans: [] });
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [foodSearchQuery, setFoodSearchQuery] = useState('');

  // Modals & Forms State
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [showDietPlanModal, setShowDietPlanModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Add Exercise Form
  const [exerciseForm, setExerciseForm] = useState({
    name: '',
    muscle_group: 'Chest',
    equipment: 'Barbell',
    difficulty: 'intermediate',
    description: '',
    video_url: ''
  });

  // Add Food Form
  const [foodForm, setFoodForm] = useState({
    name: '',
    serving_size: '100g',
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    fiber_g: ''
  });

  // Master Diet Plan Form
  const [dietPlanForm, setDietPlanForm] = useState({
    name: '',
    goal_type: 'Muscle Gain',
    daily_calories: 2200,
    protein_g: 150,
    carbs_g: 220,
    fat_g: 60,
    duration_days: 30,
    instructions: '',
    meals: [
      { meal_name: 'Breakfast', meal_time: '08:00', sequence_no: 1, foods: [] },
      { meal_name: 'Lunch', meal_time: '13:00', sequence_no: 2, foods: [] },
      { meal_name: 'Evening Snack', meal_time: '17:30', sequence_no: 3, foods: [] },
      { meal_name: 'Dinner', meal_time: '20:30', sequence_no: 4, foods: [] }
    ]
  });

  // Direct Member Assignment Studio Form
  const [studioForm, setStudioForm] = useState({
    member_id: '',
    assign_type: 'workout', // 'workout' | 'diet'
    diet_plan_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
    workout_days: [
      {
        day_number: 1,
        day_name: 'Day 1: Chest & Triceps',
        focus_area: 'Push Muscles',
        exercises: [{ exercise_id: '', sets: 3, reps: '10-12', target_weight_kg: 0, rest_seconds: 60 }]
      },
      {
        day_number: 2,
        day_name: 'Day 2: Back & Biceps',
        focus_area: 'Pull Muscles',
        exercises: [{ exercise_id: '', sets: 3, reps: '10-12', target_weight_kg: 0, rest_seconds: 60 }]
      },
      {
        day_number: 3,
        day_name: 'Day 3: Legs & Abs',
        focus_area: 'Lower Body & Core',
        exercises: [{ exercise_id: '', sets: 4, reps: '12-15', target_weight_kg: 0, rest_seconds: 90 }]
      }
    ]
  });

  // Selected Member Live Fitness State
  const [memberOverview, setMemberOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Load Base Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [exeRes, dietRes, memRes] = await Promise.all([
        apiGet('/api/v1/fitness/exercises'),
        apiGet('/api/v1/fitness/diet-catalog'),
        apiGet('/api/v1/members?limit=300')
      ]);

      if (exeRes?.success) setExercises(exeRes.data || []);
      if (dietRes?.success) setDietCatalog({ foods: dietRes.foods || [], plans: dietRes.plans || [] });
      if (memRes?.success) setMembers(memRes.data || []);
    } catch (err) {
      console.error('Fitness Library Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Member Overview When Member Selected in Studio
  const handleMemberChange = async (memberId) => {
    setStudioForm((prev) => ({ ...prev, member_id: memberId }));
    if (!memberId) {
      setMemberOverview(null);
      return;
    }
    setLoadingOverview(true);
    try {
      const res = await apiGet(`/api/v1/fitness/member/${memberId}/overview`);
      if (res?.success) {
        setMemberOverview(res.data);
      }
    } catch (err) {
      console.error('Failed to load member overview', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  // Filtered Exercises
  const filteredExercises = useMemo(() => {
    return exercises.filter((item) => {
      const itemGroup = String(item.muscle_group || '').toLowerCase().trim();
      const selectedGroup = selectedMuscleFilter.toLowerCase().trim();

      const matchesMuscle =
        selectedMuscleFilter === 'All' ||
        itemGroup === selectedGroup;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(item.name || '').toLowerCase().includes(q) ||
        String(item.equipment || '').toLowerCase().includes(q) ||
        String(item.description || '').toLowerCase().includes(q);

      return matchesMuscle && matchesSearch;
    });
  }, [exercises, selectedMuscleFilter, searchQuery]);

  // Filtered Food Pantry
  const filteredFoods = useMemo(() => {
    const q = foodSearchQuery.toLowerCase().trim();
    if (!q) return dietCatalog.foods || [];
    return (dietCatalog.foods || []).filter((f) =>
      String(f.name || '').toLowerCase().includes(q)
    );
  }, [dietCatalog.foods, foodSearchQuery]);

  // Create Exercise
  const handleCreateExercise = async (e) => {
    e.preventDefault();
    if (!exerciseForm.name.trim()) return;

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const res = await apiPost('/api/v1/fitness/exercises', exerciseForm);
    if (res?.success) {
      setMessage({ type: 'success', text: `"${exerciseForm.name}" exercise library me add ho gayi!` });
      setShowExerciseModal(false);
      setExerciseForm({
        name: '',
        muscle_group: 'Chest',
        equipment: 'Barbell',
        difficulty: 'intermediate',
        description: '',
        video_url: ''
      });
      loadData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Failed to add exercise.' });
    }
    setSubmitting(false);
  };

  // Create Food
  const handleCreateFood = async (e) => {
    e.preventDefault();
    if (!foodForm.name.trim() || !foodForm.calories) return;

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const res = await apiPost('/api/v1/fitness/foods', {
      ...foodForm,
      calories: parseFloat(foodForm.calories),
      protein_g: parseFloat(foodForm.protein_g || 0),
      carbs_g: parseFloat(foodForm.carbs_g || 0),
      fat_g: parseFloat(foodForm.fat_g || 0),
      fiber_g: parseFloat(foodForm.fiber_g || 0)
    });

    if (res?.success) {
      setMessage({ type: 'success', text: `"${foodForm.name}" food catalog me add ho gaya!` });
      setShowFoodModal(false);
      setFoodForm({ name: '', serving_size: '100g', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' });
      loadData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Failed to add food.' });
    }
    setSubmitting(false);
  };

  // Create Master Diet Plan
  const handleCreateDietPlan = async (e) => {
    e.preventDefault();
    if (!dietPlanForm.name.trim()) return;

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const res = await apiPost('/api/v1/fitness/diet-plans', {
      ...dietPlanForm,
      daily_calories: parseFloat(dietPlanForm.daily_calories),
      protein_g: parseFloat(dietPlanForm.protein_g || 0),
      carbs_g: parseFloat(dietPlanForm.carbs_g || 0),
      fat_g: parseFloat(dietPlanForm.fat_g || 0),
      duration_days: parseInt(dietPlanForm.duration_days, 10)
    });

    if (res?.success) {
      setMessage({ type: 'success', text: `Master Plan "${dietPlanForm.name}" successfully ban gaya!` });
      setShowDietPlanModal(false);
      loadData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Diet plan creation failed.' });
    }
    setSubmitting(false);
  };

  // Assign Workout Split to Member
  const handleAssignWorkoutPlan = async (e) => {
    e.preventDefault();
    if (!studioForm.member_id) {
      alert('Kripya pehle member select karein.');
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const payload = {
      member_id: parseInt(studioForm.member_id, 10),
      start_date: studioForm.start_date,
      end_date: studioForm.end_date || null,
      notes: studioForm.notes || null,
      days: studioForm.workout_days
    };

    const res = await apiPost('/api/v1/fitness/workout-plans', payload);
    if (res?.success) {
      setMessage({ type: 'success', text: 'Workout split plan member ko successfully assign ho gaya!' });
      handleMemberChange(studioForm.member_id);
    } else {
      setMessage({ type: 'error', text: res?.message || 'Workout plan assignment fail ho gaya.' });
    }
    setSubmitting(false);
  };

  // Assign Diet Plan to Member
  const handleAssignDietPlan = async (e) => {
    e.preventDefault();
    if (!studioForm.member_id || !studioForm.diet_plan_id) {
      alert('Member aur Diet Plan dono select karein.');
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const res = await apiPost('/api/v1/fitness/diet-plans/assign', {
      member_id: parseInt(studioForm.member_id, 10),
      diet_plan_id: parseInt(studioForm.diet_plan_id, 10),
      start_date: studioForm.start_date,
      end_date: studioForm.end_date || null,
      notes: studioForm.notes || null
    });

    if (res?.success) {
      setMessage({ type: 'success', text: 'Diet plan member ke profile par successfully activate ho gaya!' });
      handleMemberChange(studioForm.member_id);
    } else {
      setMessage({ type: 'error', text: res?.message || 'Diet assignment failed.' });
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* ═══════════ HEADER HUB ═══════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-lime-400">Fitness & Coaching Operating System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Workout Routine <span className="text-lime-400">&amp;</span> Diet Engine
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
              Exercise inventory, macro meal schedules aur member split routines ko professional speed ke saath curate aur assign karein.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setShowExerciseModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 text-xs font-bold rounded-xl transition-all"
            >
              <span className="text-lime-400 font-extrabold">+</span> Add Exercise
            </button>
            <button
              onClick={() => setShowFoodModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 text-xs font-bold rounded-xl transition-all"
            >
              <span className="text-lime-400 font-extrabold">+</span> Add Food Item
            </button>
            <button
              onClick={() => setShowDietPlanModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(163,230,53,0.3)]"
            >
              🥗 Master Diet Template
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ ALERTS ═══════════ */}
      {message.text && (
        <div
          className={`flex justify-between items-center gap-3 p-4 rounded-2xl text-xs font-bold border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}
        >
          <span>{message.type === 'success' ? '✓ ' : '⚠ '}{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="hover:text-white">✕</button>
        </div>
      )}

      {/* ═══════════ WORKSPACE TABS ═══════════ */}
      <div className="flex gap-2 p-1.5 bg-zinc-900/70 border border-zinc-800 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('exercises')}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'exercises'
              ? 'bg-lime-400 text-zinc-950 shadow-[0_4px_15px_rgba(163,230,53,0.35)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          🏋️ Exercise Database ({exercises.length})
        </button>
        <button
          onClick={() => setActiveTab('diet_catalog')}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'diet_catalog'
              ? 'bg-lime-400 text-zinc-950 shadow-[0_4px_15px_rgba(163,230,53,0.35)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          🥗 Nutrition & Templates ({dietCatalog.plans.length})
        </button>
        <button
          onClick={() => setActiveTab('assign_studio')}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'assign_studio'
              ? 'bg-lime-400 text-zinc-950 shadow-[0_4px_15px_rgba(163,230,53,0.35)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          🎯 Assign to Member (Studio)
        </button>
      </div>

      {/* ═══════════════════════ TAB 1: EXERCISE DATABASE ═══════════════════════ */}
      {activeTab === 'exercises' && (
        <div className="space-y-5">
          <div className="bg-zinc-900/60 border border-zinc-800 p-4 sm:p-5 rounded-3xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-96">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="Search exercise, equipment ya description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-lime-400"
                />
              </div>
              <span className="text-[11px] text-zinc-500 font-mono px-3 py-1.5 rounded-full bg-zinc-950 border border-zinc-800">
                <strong className="text-lime-400">{filteredExercises.length}</strong> / {exercises.length} Exercises
              </span>
            </div>

            {/* Muscle Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedMuscleFilter('All')}
                className={`px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all shrink-0 ${
                  selectedMuscleFilter === 'All'
                    ? 'bg-lime-400 text-zinc-950'
                    : 'bg-zinc-950/60 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                All ({exercises.length})
              </button>

              {MUSCLE_GROUPS.map((mg) => {
                const count = exercises.filter(
                  (e) => String(e.muscle_group || '').toLowerCase() === mg.toLowerCase()
                ).length;
                return (
                  <button
                    key={mg}
                    onClick={() => setSelectedMuscleFilter(mg)}
                    className={`px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all shrink-0 flex items-center gap-2 ${
                      selectedMuscleFilter.toLowerCase() === mg.toLowerCase()
                        ? 'bg-lime-400 text-zinc-950'
                        : 'bg-zinc-950/60 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <span>{mg}</span>
                    <span className="text-[10px] opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-zinc-500 text-xs">Loading exercises...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredExercises.map((ex) => (
                <div
                  key={ex.id}
                  className="bg-zinc-900 border border-zinc-800 hover:border-lime-400/40 transition-all rounded-3xl p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-lime-400">
                        {ex.muscle_group}
                      </span>
                      <span className={`capitalize text-[10px] px-2 py-0.5 rounded-lg border font-mono font-bold ${DIFFICULTY_STYLES[String(ex.difficulty || 'intermediate').toLowerCase()] || DIFFICULTY_STYLES.intermediate}`}>
                        {ex.difficulty || 'Intermediate'}
                      </span>
                    </div>

                    <h4 className="text-base font-extrabold text-white">{ex.name}</h4>
                    <p className="text-xs text-zinc-500 line-clamp-2">{ex.description || 'Standard instruction'}</p>
                  </div>

                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400 font-mono">⚙ {ex.equipment || 'Bodyweight'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ TAB 2: NUTRITION & MASTER DIET TEMPLATES ═══════════════════════ */}
      {activeTab === 'diet_catalog' && (
        <div className="space-y-6">
          <div className="flex gap-2 p-1 bg-zinc-900/70 border border-zinc-800 rounded-2xl w-fit">
            <button
              onClick={() => setDietSubTab('plans')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                dietSubTab === 'plans' ? 'bg-zinc-800 text-lime-400 border border-zinc-700' : 'text-zinc-400 hover:text-white'
              }`}
            >
              📋 Master Diet Templates ({dietCatalog.plans.length})
            </button>
            <button
              onClick={() => setDietSubTab('pantry')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                dietSubTab === 'pantry' ? 'bg-zinc-800 text-lime-400 border border-zinc-700' : 'text-zinc-400 hover:text-white'
              }`}
            >
              🥫 Food Catalog ({dietCatalog.foods.length})
            </button>
          </div>

          {dietSubTab === 'plans' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {dietCatalog.plans.map((p) => {
                const isExpanded = expandedPlanId === p.id;
                return (
                  <div
                    key={p.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`inline-block text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-lg border ${GOAL_STYLES[p.goal_type] || 'bg-zinc-800 text-zinc-400'}`}>
                            {p.goal_type}
                          </span>
                          <h4 className="text-lg font-extrabold text-white mt-1">{p.name}</h4>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-extrabold bg-lime-400/10 text-lime-400 border border-lime-400/25">
                          {p.daily_calories} kcal/day
                        </span>
                      </div>

                      {/* Macros Row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                          <span className="text-[9px] text-zinc-500 uppercase font-bold block">Protein</span>
                          <strong className="text-blue-400 font-mono text-sm">{p.protein_g}g</strong>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                          <span className="text-[9px] text-zinc-500 uppercase font-bold block">Carbs</span>
                          <strong className="text-amber-400 font-mono text-sm">{p.carbs_g}g</strong>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                          <span className="text-[9px] text-zinc-500 uppercase font-bold block">Fat</span>
                          <strong className="text-rose-400 font-mono text-sm">{p.fat_g}g</strong>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pt-3 border-t border-zinc-800 space-y-2">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase block">Daily Meals</span>
                          {p.meals?.map((m, idx) => (
                            <div key={idx} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs space-y-1">
                              <div className="flex justify-between text-lime-400 font-bold">
                                <span>{m.meal_name}</span>
                                <span className="text-zinc-500 font-mono text-[10px]">{m.meal_time}</span>
                              </div>
                              {m.foods?.map((f, fIdx) => (
                                <div key={fIdx} className="flex justify-between text-[11px] text-zinc-400">
                                  <span>• {f.food_name}</span>
                                  <span>{f.quantity} {f.unit}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-zinc-800 flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-mono">Duration: {p.duration_days} Days</span>
                      <button
                        onClick={() => setExpandedPlanId(isExpanded ? null : p.id)}
                        className="text-lime-400 font-bold hover:underline"
                      >
                        {isExpanded ? 'Hide Details ▲' : 'View Full Meals ▼'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {dietSubTab === 'pantry' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
              <input
                type="text"
                placeholder="Search food item (e.g. Oats, Egg, Chicken)..."
                value={foodSearchQuery}
                onChange={(e) => setFoodSearchQuery(e.target.value)}
                className="w-full sm:w-96 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-lime-400"
              />

              <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                <table className="w-full text-left text-xs text-zinc-300 font-mono">
                  <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Food Item</th>
                      <th className="p-3">Serving</th>
                      <th className="p-3">Calories</th>
                      <th className="p-3">Protein</th>
                      <th className="p-3">Carbs</th>
                      <th className="p-3">Fats</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredFoods.map((f) => (
                      <tr key={f.id} className="hover:bg-zinc-800/30">
                        <td className="p-3 font-sans font-bold text-white">{f.name}</td>
                        <td className="p-3 text-zinc-400">{f.serving_size}</td>
                        <td className="p-3 text-lime-400 font-bold">{f.calories} kcal</td>
                        <td className="p-3 text-blue-400">{f.protein_g}g</td>
                        <td className="p-3 text-amber-400">{f.carbs_g}g</td>
                        <td className="p-3 text-rose-400">{f.fat_g}g</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ TAB 3: COACH STUDIO (ASSIGN WORKOUT / DIET) ═══════════════════════ */}
      {activeTab === 'assign_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Member Selector & Status Card */}
          <div className="space-y-5 lg:col-span-1">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div>
                <label className={labelCls}>Select Gym Member *</label>
                <select
                  value={studioForm.member_id}
                  onChange={(e) => handleMemberChange(e.target.value)}
                  className={inputCls}
                >
                  <option value="">-- Choose Member --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.member_code} — {m.first_name} {m.last_name || ''} ({m.phone})
                    </option>
                  ))}
                </select>
              </div>

              {loadingOverview && (
                <p className="text-xs text-zinc-500 animate-pulse">Loading member profile & active plans...</p>
              )}

              {memberOverview && (
                <div className="space-y-3 pt-3 border-t border-zinc-800 text-xs">
                  <h4 className="font-bold text-white text-sm">Member Current Status</h4>

                  <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Active Workout Plan</span>
                    <strong className="text-lime-400">
                      {memberOverview.active_workout ? `Custom Plan (${memberOverview.active_workout.days?.length || 0} Days Split)` : 'None Assigned'}
                    </strong>
                  </div>

                  <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Active Diet Plan</span>
                    <strong className="text-lime-400">
                      {memberOverview.active_diet ? `${memberOverview.active_diet.plan_name} (${memberOverview.active_diet.daily_calories} kcal)` : 'None Assigned'}
                    </strong>
                  </div>

                  {memberOverview.latest_measurement && (
                    <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1 text-zinc-300">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">Latest Body Composition</span>
                      <p>Weight: <strong>{memberOverview.latest_measurement.weight_kg} kg</strong> · BMI: <strong>{memberOverview.latest_measurement.bmi || '—'}</strong></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Assignment Work Area */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
              <div className="flex gap-2 border-b border-zinc-800 pb-4">
                <button
                  type="button"
                  onClick={() => setStudioForm((p) => ({ ...p, assign_type: 'workout' }))}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    studioForm.assign_type === 'workout' ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  🏋️ Build & Assign Workout Split
                </button>
                <button
                  type="button"
                  onClick={() => setStudioForm((p) => ({ ...p, assign_type: 'diet' }))}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    studioForm.assign_type === 'diet' ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  🥗 Assign Diet Plan
                </button>
              </div>

              {/* SECTION A: WORKOUT SPLIT BUILDER */}
              {studioForm.assign_type === 'workout' && (
                <form onSubmit={handleAssignWorkoutPlan} className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Start Date *</label>
                      <input
                        type="date"
                        required
                        value={studioForm.start_date}
                        onChange={(e) => setStudioForm({ ...studioForm, start_date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>End Date (Optional)</label>
                      <input
                        type="date"
                        value={studioForm.end_date}
                        onChange={(e) => setStudioForm({ ...studioForm, end_date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Day-Wise Routine Builder */}
                  <div className="space-y-4">
                    <label className={labelCls}>Workout Routine Splits (Weekly Days)</label>

                    {studioForm.workout_days.map((day, dIdx) => (
                      <div key={dIdx} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <input
                            type="text"
                            value={day.day_name}
                            onChange={(e) => {
                              const updated = { ...studioForm };
                              updated.workout_days[dIdx].day_name = e.target.value;
                              setStudioForm(updated);
                            }}
                            className="bg-transparent text-sm font-extrabold text-lime-400 border-b border-zinc-800 pb-1 focus:outline-none focus:border-lime-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...studioForm };
                              updated.workout_days = updated.workout_days.filter((_, i) => i !== dIdx);
                              setStudioForm(updated);
                            }}
                            className="text-zinc-600 hover:text-red-400 text-xs"
                          >
                            Remove Day ✕
                          </button>
                        </div>

                        {/* Exercise Rows */}
                        <div className="space-y-2">
                          {day.exercises.map((exItem, exIdx) => (
                            <div key={exIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                              <div className="sm:col-span-5">
                                <select
                                  value={exItem.exercise_id}
                                  onChange={(e) => {
                                    const updated = { ...studioForm };
                                    updated.workout_days[dIdx].exercises[exIdx].exercise_id = e.target.value;
                                    setStudioForm(updated);
                                  }}
                                  className={inputCls}
                                >
                                  <option value="">-- Choose Exercise --</option>
                                  {exercises.map((ex) => (
                                    <option key={ex.id} value={ex.id}>
                                      {ex.name} ({ex.muscle_group})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="sm:col-span-2">
                                <input
                                  type="number"
                                  placeholder="Sets"
                                  value={exItem.sets}
                                  onChange={(e) => {
                                    const updated = { ...studioForm };
                                    updated.workout_days[dIdx].exercises[exIdx].sets = e.target.value;
                                    setStudioForm(updated);
                                  }}
                                  className={inputCls}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <input
                                  type="text"
                                  placeholder="Reps (10-12)"
                                  value={exItem.reps}
                                  onChange={(e) => {
                                    const updated = { ...studioForm };
                                    updated.workout_days[dIdx].exercises[exIdx].reps = e.target.value;
                                    setStudioForm(updated);
                                  }}
                                  className={inputCls}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <input
                                  type="number"
                                  placeholder="Rest (s)"
                                  value={exItem.rest_seconds}
                                  onChange={(e) => {
                                    const updated = { ...studioForm };
                                    updated.workout_days[dIdx].exercises[exIdx].rest_seconds = e.target.value;
                                    setStudioForm(updated);
                                  }}
                                  className={inputCls}
                                />
                              </div>
                              <div className="sm:col-span-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...studioForm };
                                    updated.workout_days[dIdx].exercises = updated.workout_days[dIdx].exercises.filter((_, i) => i !== exIdx);
                                    setStudioForm(updated);
                                  }}
                                  className="text-zinc-600 hover:text-red-400 text-sm"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...studioForm };
                              updated.workout_days[dIdx].exercises.push({
                                exercise_id: '',
                                sets: 3,
                                reps: '10-12',
                                target_weight_kg: 0,
                                rest_seconds: 60
                              });
                              setStudioForm(updated);
                            }}
                            className="text-[11px] text-lime-400 font-bold hover:underline inline-block pt-1"
                          >
                            + Add Exercise to {day.day_name}
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...studioForm };
                        const nextDayNum = updated.workout_days.length + 1;
                        updated.workout_days.push({
                          day_number: nextDayNum,
                          day_name: `Day ${nextDayNum}: Arms & Shoulders`,
                          focus_area: 'Accessory',
                          exercises: [{ exercise_id: '', sets: 3, reps: '12', target_weight_kg: 0, rest_seconds: 60 }]
                        });
                        setStudioForm(updated);
                      }}
                      className="px-4 py-2 bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-xl hover:text-white"
                    >
                      + Add Another Workout Day
                    </button>
                  </div>

                  <div>
                    <label className={labelCls}>Coach Notes for Member</label>
                    <textarea
                      rows="2"
                      value={studioForm.notes}
                      onChange={(e) => setStudioForm({ ...studioForm, notes: e.target.value })}
                      className={inputCls}
                      placeholder="Progressive overload guidelines, warm-up sets etc..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !studioForm.member_id}
                    className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Assigning...' : 'Assign Custom Workout Plan to Member'}
                  </button>
                </form>
              )}

              {/* SECTION B: ASSIGN MASTER DIET PLAN */}
              {studioForm.assign_type === 'diet' && (
                <form onSubmit={handleAssignDietPlan} className="space-y-4">
                  <div>
                    <label className={labelCls}>Select Master Diet Template *</label>
                    <select
                      required
                      value={studioForm.diet_plan_id}
                      onChange={(e) => setStudioForm({ ...studioForm, diet_plan_id: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">-- Choose Master Diet Plan --</option>
                      {dietCatalog.plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.daily_calories} kcal · P: {p.protein_g}g · {p.goal_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Start Date *</label>
                      <input
                        type="date"
                        required
                        value={studioForm.start_date}
                        onChange={(e) => setStudioForm({ ...studioForm, start_date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>End Date (Optional)</label>
                      <input
                        type="date"
                        value={studioForm.end_date}
                        onChange={(e) => setStudioForm({ ...studioForm, end_date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Custom Instructions / Hydration Targets</label>
                    <textarea
                      rows="2"
                      value={studioForm.notes}
                      onChange={(e) => setStudioForm({ ...studioForm, notes: e.target.value })}
                      className={inputCls}
                      placeholder="Drink 4 litres water, avoid refined carbs post 8 PM..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !studioForm.member_id || !studioForm.diet_plan_id}
                    className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Activating...' : 'Activate Diet Plan on Member Profile'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL 1: ADD EXERCISE ═══════════ */}
      {showExerciseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Add Exercise</h3>
              <button onClick={() => setShowExerciseModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateExercise} className="space-y-3">
              <div>
                <label className={labelCls}>Exercise Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Incline Dumbbell Press"
                  value={exerciseForm.name}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Muscle Group *</label>
                  <select
                    value={exerciseForm.muscle_group}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, muscle_group: e.target.value })}
                    className={inputCls}
                  >
                    {MUSCLE_GROUPS.map((mg) => (
                      <option key={mg} value={mg}>{mg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Equipment *</label>
                  <select
                    value={exerciseForm.equipment}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, equipment: e.target.value })}
                    className={inputCls}
                  >
                    {EQUIPMENT_LIST.map((eq) => (
                      <option key={eq} value={eq}>{eq}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Difficulty</label>
                <select
                  value={exerciseForm.difficulty}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, difficulty: e.target.value })}
                  className={inputCls}
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Description / Form Cues</label>
                <textarea
                  rows="2"
                  value={exerciseForm.description}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, description: e.target.value })}
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs uppercase rounded-xl transition"
              >
                {submitting ? 'Saving...' : 'Add Exercise'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL 2: ADD FOOD ═══════════ */}
      {showFoodModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Add Food Item</h3>
              <button onClick={() => setShowFoodModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateFood} className="space-y-3">
              <div>
                <label className={labelCls}>Food Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Peanut Butter, Paneer"
                  value={foodForm.name}
                  onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Serving Size</label>
                  <input
                    type="text"
                    required
                    value={foodForm.serving_size}
                    onChange={(e) => setFoodForm({ ...foodForm, serving_size: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Calories (kcal) *</label>
                  <input
                    type="number"
                    required
                    value={foodForm.calories}
                    onChange={(e) => setFoodForm({ ...foodForm, calories: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>Protein (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={foodForm.protein_g}
                    onChange={(e) => setFoodForm({ ...foodForm, protein_g: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Carbs (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={foodForm.carbs_g}
                    onChange={(e) => setFoodForm({ ...foodForm, carbs_g: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Fat (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={foodForm.fat_g}
                    onChange={(e) => setFoodForm({ ...foodForm, fat_g: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs uppercase rounded-xl transition"
              >
                {submitting ? 'Saving...' : 'Save Food Item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL 3: MASTER DIET TEMPLATE BUILDER ═══════════ */}
      {showDietPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-extrabold text-white uppercase tracking-wider">Create Master Diet Template</h3>
              <button onClick={() => setShowDietPlanModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateDietPlan} className="space-y-4">
              <div>
                <label className={labelCls}>Plan Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vegetarian Clean Bulk 2800"
                  value={dietPlanForm.name}
                  onChange={(e) => setDietPlanForm({ ...dietPlanForm, name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Goal Type</label>
                  <select
                    value={dietPlanForm.goal_type}
                    onChange={(e) => setDietPlanForm({ ...dietPlanForm, goal_type: e.target.value })}
                    className={inputCls}
                  >
                    <option value="Muscle Gain">Muscle Gain</option>
                    <option value="Fat Loss">Fat Loss</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Ketogenic">Ketogenic</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Daily Calories (kcal) *</label>
                  <input
                    type="number"
                    required
                    value={dietPlanForm.daily_calories}
                    onChange={(e) => setDietPlanForm({ ...dietPlanForm, daily_calories: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <div>
                  <label className={labelCls}>Protein (g)</label>
                  <input
                    type="number"
                    value={dietPlanForm.protein_g}
                    onChange={(e) => setDietPlanForm({ ...dietPlanForm, protein_g: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Carbs (g)</label>
                  <input
                    type="number"
                    value={dietPlanForm.carbs_g}
                    onChange={(e) => setDietPlanForm({ ...dietPlanForm, carbs_g: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Fats (g)</label>
                  <input
                    type="number"
                    value={dietPlanForm.fat_g}
                    onChange={(e) => setDietPlanForm({ ...dietPlanForm, fat_g: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Meals builder */}
              <div className="space-y-3">
                <label className={labelCls}>Daily Meals Schedule</label>
                {dietPlanForm.meals.map((meal, mIdx) => (
                  <div key={mIdx} className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lime-400 text-xs">{meal.meal_name}</span>
                      <input
                        type="time"
                        value={meal.meal_time}
                        onChange={(e) => {
                          const updated = { ...dietPlanForm };
                          updated.meals[mIdx].meal_time = e.target.value;
                          setDietPlanForm(updated);
                        }}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      {meal.foods?.map((fItem, fIdx) => (
                        <div key={fIdx} className="flex gap-2 items-center">
                          <select
                            value={fItem.food_id}
                            onChange={(e) => {
                              const updated = { ...dietPlanForm };
                              updated.meals[mIdx].foods[fIdx].food_id = e.target.value;
                              setDietPlanForm(updated);
                            }}
                            className={`${inputCls} flex-1`}
                          >
                            <option value="">-- Choose Food from Catalog --</option>
                            {dietCatalog.foods?.map((food) => (
                              <option key={food.id} value={food.id}>
                                {food.name} ({food.calories} kcal · P: {food.protein_g}g)
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            placeholder="Qty"
                            value={fItem.quantity}
                            onChange={(e) => {
                              const updated = { ...dietPlanForm };
                              updated.meals[mIdx].foods[fIdx].quantity = e.target.value;
                              setDietPlanForm(updated);
                            }}
                            className="w-20 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...dietPlanForm };
                              updated.meals[mIdx].foods = updated.meals[mIdx].foods.filter((_, i) => i !== fIdx);
                              setDietPlanForm(updated);
                            }}
                            className="text-zinc-600 hover:text-red-400 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...dietPlanForm };
                          if (!updated.meals[mIdx].foods) updated.meals[mIdx].foods = [];
                          updated.meals[mIdx].foods.push({ food_id: '', quantity: 100, unit: 'grams' });
                          setDietPlanForm(updated);
                        }}
                        className="text-[11px] text-lime-400 font-bold hover:underline"
                      >
                        + Add Food
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className={labelCls}>Guidelines / Instructions</label>
                <textarea
                  rows="2"
                  value={dietPlanForm.instructions}
                  onChange={(e) => setDietPlanForm({ ...dietPlanForm, instructions: e.target.value })}
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-extrabold text-xs uppercase rounded-xl transition"
              >
                {submitting ? 'Saving Template...' : 'Save Master Diet Template'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}