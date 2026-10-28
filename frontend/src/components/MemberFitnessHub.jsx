import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost } from '../api';

const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 transition';
const labelCls = 'text-[11px] text-zinc-400 block mb-1 font-semibold uppercase tracking-wider';

// Master Muscle Groups (Dedicated Biceps & Triceps)
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

// Weekly Presets for Instant 1-Click Fill
const WORKOUT_PRESETS = {
  ppl: {
    name: '6-Day Push Pull Legs (PPL)',
    days: [
      { day_number: 1, day_name: 'Push A (Chest / Shoulders / Triceps)', focus_area: 'Push - Heavy Compound', exercises: [] },
      { day_number: 2, day_name: 'Pull A (Back & Biceps)', focus_area: 'Pull - Width & Thickness', exercises: [] },
      { day_number: 3, day_name: 'Legs & Core', focus_area: 'Lower Body Quad Focus', exercises: [] },
      { day_number: 4, day_name: 'Push B (Hypertrophy)', focus_area: 'Delts & Triceps Volume', exercises: [] },
      { day_number: 5, day_name: 'Pull B (Hypertrophy)', focus_area: 'Lats & Biceps Peak', exercises: [] },
      { day_number: 6, day_name: 'Legs & Hamstrings', focus_area: 'Posterior Chain', exercises: [] }
    ]
  },
  bro_split: {
    name: '5-Day Bodypart Split',
    days: [
      { day_number: 1, day_name: 'Chest Day', focus_area: 'Pectorals & Front Delts', exercises: [] },
      { day_number: 2, day_name: 'Back Day', focus_area: 'Lats, Rhomboids & Traps', exercises: [] },
      { day_number: 3, day_name: 'Shoulders & Traps', focus_area: 'Deltoid Isolation', exercises: [] },
      { day_number: 4, day_name: 'Arms (Biceps & Triceps)', focus_area: 'Arm Hypertrophy & Pumps', exercises: [] },
      { day_number: 5, day_name: 'Legs Day', focus_area: 'Quads, Hamstrings & Calves', exercises: [] }
    ]
  },
  upper_lower: {
    name: '4-Day Upper / Lower Split',
    days: [
      { day_number: 1, day_name: 'Upper Body A', focus_area: 'Chest, Back & Shoulders', exercises: [] },
      { day_number: 2, day_name: 'Lower Body A', focus_area: 'Squat & Quad Focus', exercises: [] },
      { day_number: 3, day_name: 'Upper Body B (Arms & Delts)', focus_area: 'Biceps, Triceps & Lats', exercises: [] },
      { day_number: 4, day_name: 'Lower Body B', focus_area: 'Deadlift & Hamstring', exercises: [] }
    ]
  }
};

export default function MemberFitnessHub({ memberId, memberName }) {
  const [activeTab, setActiveTab] = useState('workout'); // 'workout' | 'health' | 'diet'
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    health: null,
    latest_measurement: null,
    measurements: [],
    active_workout: null,
    active_diet: null
  });

  const [exerciseList, setExerciseList] = useState([]);
  const [dietCatalog, setDietCatalog] = useState({ foods: [], plans: [] });

  // Modal toggles
  const [showMeasureModal, setShowMeasureModal] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Filter state inside the workout builder modal
  const [modalMuscleFilter, setModalMuscleFilter] = useState('All');

  const [measureForm, setMeasureForm] = useState({
    weight_kg: '',
    height_cm: '',
    body_fat_percent: '',
    muscle_mass_kg: '',
    chest_cm: '',
    waist_cm: '',
    biceps_cm: '',
    notes: ''
  });

  const [dietAssignForm, setDietAssignForm] = useState({
    diet_plan_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: ''
  });

  // Weekly Workout Split State
  const [workoutForm, setWorkoutForm] = useState({
    start_date: new Date().toISOString().split('T')[0],
    days: [
      {
        day_number: 1,
        day_name: 'Push Day (Chest, Shoulders & Triceps)',
        focus_area: 'Upper Body Push',
        exercises: [{ exercise_id: '', sets: 3, reps: '10-12', target_weight_kg: 20, rest_seconds: 60 }]
      }
    ]
  });

  const loadData = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const [res, exeRes, dietRes] = await Promise.all([
        apiGet(`/api/v1/fitness/member/${memberId}/overview`),
        apiGet('/api/v1/fitness/exercises'),
        apiGet('/api/v1/fitness/diet-catalog')
      ]);

      if (res?.success) setData(res.data);
      if (exeRes?.success) setExerciseList(exeRes.data || []);
      if (dietRes?.success) setDietCatalog({ foods: dietRes.foods || [], plans: dietRes.plans || [] });
    } catch (err) {
      console.error('MemberFitnessHub Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Grouped Exercises
  const groupedExercises = useMemo(() => {
    const groups = {};
    exerciseList.forEach((ex) => {
      let mg = ex.muscle_group || 'Other';
      if (mg.toLowerCase() === 'arms') {
        mg = ex.name.toLowerCase().includes('tricep') || ex.name.toLowerCase().includes('pushdown') || ex.name.toLowerCase().includes('dip')
          ? 'Triceps'
          : 'Biceps';
      }
      if (!groups[mg]) groups[mg] = [];
      groups[mg].push(ex);
    });
    return groups;
  }, [exerciseList]);

  const filteredDropdownOptions = useMemo(() => {
    if (modalMuscleFilter === 'All') return groupedExercises;
    return {
      [modalMuscleFilter]: groupedExercises[modalMuscleFilter] || []
    };
  }, [groupedExercises, modalMuscleFilter]);

  const applyPreset = (presetKey) => {
    const preset = WORKOUT_PRESETS[presetKey];
    if (!preset) return;

    setWorkoutForm((prev) => ({
      ...prev,
      days: preset.days.map((d) => ({
        ...d,
        exercises: [{ exercise_id: '', sets: 3, reps: '10-12', target_weight_kg: 0, rest_seconds: 60 }]
      }))
    }));
  };

  const addWorkoutDay = () => {
    const nextDayNum = workoutForm.days.length + 1;
    if (nextDayNum > 7) {
      alert('Ek week mein maximum 7 workout days ho sakte hain.');
      return;
    }
    setWorkoutForm((prev) => ({
      ...prev,
      days: [
        ...prev.days,
        {
          day_number: nextDayNum,
          day_name: `Day ${nextDayNum} Workout`,
          focus_area: 'Target Muscle Group',
          exercises: [{ exercise_id: '', sets: 3, reps: '10-12', target_weight_kg: 0, rest_seconds: 60 }]
        }
      ]
    }));
  };

  const removeWorkoutDay = (dayIdx) => {
    if (workoutForm.days.length <= 1) {
      alert('Kam se kam 1 workout day hona zaroori hai.');
      return;
    }
    const updated = workoutForm.days
      .filter((_, i) => i !== dayIdx)
      .map((d, i) => ({ ...d, day_number: i + 1 }));
    setWorkoutForm((prev) => ({ ...prev, days: updated }));
  };

  const addExerciseRow = (dayIdx) => {
    const updated = { ...workoutForm };
    updated.days[dayIdx].exercises.push({
      exercise_id: '',
      sets: 3,
      reps: '10-12',
      target_weight_kg: 0,
      rest_seconds: 60
    });
    setWorkoutForm(updated);
  };

  const removeExerciseRow = (dayIdx, exIdx) => {
    const updated = { ...workoutForm };
    updated.days[dayIdx].exercises = updated.days[dayIdx].exercises.filter((_, i) => i !== exIdx);
    setWorkoutForm(updated);
  };

  const handleSaveMeasurement = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await apiPost('/api/v1/fitness/measurements', {
      member_id: parseInt(memberId, 10),
      weight_kg: parseFloat(measureForm.weight_kg),
      height_cm: measureForm.height_cm ? parseFloat(measureForm.height_cm) : undefined,
      body_fat_percent: measureForm.body_fat_percent ? parseFloat(measureForm.body_fat_percent) : undefined,
      muscle_mass_kg: measureForm.muscle_mass_kg ? parseFloat(measureForm.muscle_mass_kg) : undefined,
      chest_cm: measureForm.chest_cm ? parseFloat(measureForm.chest_cm) : undefined,
      waist_cm: measureForm.waist_cm ? parseFloat(measureForm.waist_cm) : undefined,
      biceps_cm: measureForm.biceps_cm ? parseFloat(measureForm.biceps_cm) : undefined,
      notes: measureForm.notes || undefined
    });

    if (res?.success) {
      setMessage({ type: 'success', text: 'Measurement & BMI recorded!' });
      setShowMeasureModal(false);
      loadData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Failed to record.' });
    }
    setSubmitting(false);
  };

  const handleAssignDiet = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await apiPost('/api/v1/fitness/diet-plans/assign', {
      member_id: parseInt(memberId, 10),
      diet_plan_id: parseInt(dietAssignForm.diet_plan_id, 10),
      start_date: dietAssignForm.start_date,
      end_date: dietAssignForm.end_date || undefined,
      notes: dietAssignForm.notes || undefined
    });

    if (res?.success) {
      setMessage({ type: 'success', text: 'Diet plan assigned to member!' });
      setShowDietModal(false);
      loadData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Assignment failed.' });
    }
    setSubmitting(false);
  };

  const handleSaveWorkoutPlan = async (e) => {
    e.preventDefault();

    for (const d of workoutForm.days) {
      const validEx = d.exercises.filter((ex) => ex.exercise_id);
      if (validEx.length === 0) {
        alert(`Kripya "${d.day_name}" ke andar kam se kam 1 exercise select karein.`);
        return;
      }
    }

    setSubmitting(true);
    const res = await apiPost('/api/v1/fitness/workout-plans', {
      member_id: parseInt(memberId, 10),
      start_date: workoutForm.start_date,
      days: workoutForm.days.map((d) => ({
        day_number: d.day_number,
        day_name: d.day_name,
        focus_area: d.focus_area,
        exercises: d.exercises
          .filter((ex) => ex.exercise_id)
          .map((ex, seq) => ({
            exercise_id: parseInt(ex.exercise_id, 10),
            sequence_no: seq + 1,
            sets: parseInt(ex.sets, 10),
            reps: String(ex.reps),
            target_weight_kg: parseFloat(ex.target_weight_kg || 0),
            rest_seconds: parseInt(ex.rest_seconds || 60, 10)
          }))
      }))
    });

    if (res?.success) {
      setMessage({ type: 'success', text: `${workoutForm.days.length}-Day Weekly Routine successfully assigned!` });
      setShowWorkoutModal(false);
      loadData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Plan save nahi ho saka.' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-zinc-500 animate-pulse">Loading Member Fitness Dossier...</div>;
  }

  const { latest_measurement, active_workout, active_diet } = data;

  return (
    <div className="space-y-6">
      {/* Tab Switcher & Action Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div className="flex gap-2">
          {[
            { id: 'workout', label: '🏋️ Workout Split & Routine' },
            { id: 'health', label: '📊 Health & Body Metrics' },
            { id: 'diet', label: '🥗 Nutrition & Diet Plan' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === tab.id
                  ? 'bg-lime-400 text-zinc-950 shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'workout' && (
          <button
            onClick={() => setShowWorkoutModal(true)}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold rounded-xl transition shadow-sm"
          >
            + Assign Full Weekly Split
          </button>
        )}
        {activeTab === 'health' && (
          <button
            onClick={() => setShowMeasureModal(true)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-lime-400 border border-zinc-700 text-xs font-bold rounded-xl transition"
          >
            + Log Body Measurements
          </button>
        )}
        {activeTab === 'diet' && (
          <button
            onClick={() => setShowDietModal(true)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-lime-400 border border-zinc-700 text-xs font-bold rounded-xl transition"
          >
            + Assign Diet Plan
          </button>
        )}
      </div>

      {message.text && (
        <div className={`p-3 rounded-xl text-xs font-semibold ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {message.text}
        </div>
      )}

      {/* ─── TAB 1: WEEKLY WORKOUT SPLIT ROUTINE ─── */}
      {activeTab === 'workout' && (
        <div className="space-y-6">
          {active_workout ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <span className="text-[10px] text-lime-400 font-bold uppercase tracking-widest block font-mono">
                    WEEKLY PROGRAM • {active_workout.days?.length || 1} DAYS SPLIT
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    Assigned by {active_workout.trainer_name || 'Coach Assigned'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Active since: {new Date(active_workout.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono uppercase">
                    Active Routine
                  </span>
                  <button
                    onClick={() => setShowWorkoutModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition"
                  >
                    Edit / Replace Split
                  </button>
                </div>
              </div>

              {/* Weekly Days Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {active_workout.days?.map((day) => (
                  <div key={day.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2 mb-3">
                        <div>
                          <span className="text-[10px] text-lime-400 uppercase font-mono font-bold">Day {day.day_number}</span>
                          <h4 className="text-sm font-bold text-white">{day.day_name}</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                          {day.exercises?.length || 0} Exercises
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 mb-3 font-semibold">
                        Target Focus: <span className="text-zinc-200">{day.focus_area || 'General Muscle'}</span>
                      </p>

                      <div className="space-y-2">
                        {day.exercises?.map((ex, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-lg bg-zinc-900/70 border border-zinc-800/60">
                            <div>
                              <span className="text-white font-medium block truncate max-w-[140px]">{ex.exercise_name}</span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {ex.muscle_group} {ex.equipment ? `• ${ex.equipment}` : ''}
                              </span>
                            </div>
                            <div className="text-right font-mono text-lime-400 font-bold text-xs">
                              {ex.sets} × {ex.reps}
                              {parseFloat(ex.target_weight_kg) > 0 && (
                                <span className="text-zinc-400 text-[10px] block font-normal">@{ex.target_weight_kg}kg</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500 font-mono text-right">
                      Rest: ~60s between sets
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-zinc-500 bg-zinc-900 border border-dashed border-zinc-800 rounded-2xl text-xs space-y-2">
              <span className="text-3xl block">🏋️</span>
              <p className="font-semibold text-zinc-300">Is member ko abhi tak koi weekly workout schedule assign nahi kiya gaya.</p>
              <button
                onClick={() => setShowWorkoutModal(true)}
                className="text-lime-400 hover:underline font-semibold"
              >
                Upar "+ Assign Full Weekly Split" par click karke pure hafte ka routine banayein.
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: HEALTH & MEASUREMENTS ─── */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1">Body Weight</span>
              <p className="text-2xl font-bold font-mono text-white">
                {latest_measurement?.weight_kg ? `${latest_measurement.weight_kg} kg` : '--'}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1">Calculated BMI</span>
              <p className="text-2xl font-bold font-mono text-lime-400">
                {latest_measurement?.bmi || '--'}
              </p>
              <span className="text-[10px] text-zinc-400">
                {latest_measurement?.bmi < 18.5 ? 'Underweight' : latest_measurement?.bmi < 25 ? 'Normal' : 'Overweight'}
              </span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1">Body Fat %</span>
              <p className="text-2xl font-bold font-mono text-white">
                {latest_measurement?.body_fat_percent ? `${latest_measurement.body_fat_percent}%` : '--'}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1">Muscle Mass</span>
              <p className="text-2xl font-bold font-mono text-white">
                {latest_measurement?.muscle_mass_kg ? `${latest_measurement.muscle_mass_kg} kg` : '--'}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-zinc-800 flex justify-between items-center">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tape Measurement Logs</h4>
              <span className="text-[10px] text-zinc-500 font-mono">{data.measurements.length} Records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Weight (kg)</th>
                    <th className="py-3 px-4">BMI</th>
                    <th className="py-3 px-4">Chest (cm)</th>
                    <th className="py-3 px-4">Waist (cm)</th>
                    <th className="py-3 px-4">Biceps (cm)</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {data.measurements.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-950/40">
                      <td className="py-3 px-4 text-white font-sans">{new Date(m.measured_at).toLocaleDateString('en-IN')}</td>
                      <td className="py-3 px-4 text-lime-400 font-bold">{m.weight_kg}</td>
                      <td className="py-3 px-4 text-zinc-300">{m.bmi || '--'}</td>
                      <td className="py-3 px-4 text-zinc-300">{m.chest_cm || '--'}</td>
                      <td className="py-3 px-4 text-zinc-300">{m.waist_cm || '--'}</td>
                      <td className="py-3 px-4 text-zinc-300">{m.biceps_cm || '--'}</td>
                      <td className="py-3 px-4 text-zinc-400 font-sans truncate max-w-xs">{m.notes || '-'}</td>
                    </tr>
                  ))}
                  {data.measurements.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-zinc-500 font-sans">
                        Koi body measurement record nahi mila.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: DIET & NUTRITION (🔥 WITH COMPLETE MEAL SCHEDULE & FOOD ITEMS) ─── */}
      {activeTab === 'diet' && (
        <div className="space-y-6">
          {active_diet ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="flex justify-between items-start border-b border-zinc-800 pb-4">
                <div>
                  <span className="text-[10px] text-lime-400 font-bold uppercase tracking-widest block font-mono">ASSIGNED DIET PROGRAM</span>
                  <h3 className="text-xl font-bold text-white mt-0.5">{active_diet.plan_name}</h3>
                  <p className="text-xs text-zinc-400">
                    Active Period: {new Date(active_diet.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} to {active_diet.end_date ? new Date(active_diet.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Ongoing'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Calorie Target</span>
                  <span className="text-2xl font-bold font-mono text-lime-400">{active_diet.daily_calories} kcal</span>
                </div>
              </div>

              {/* Macros Breakdown */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Protein</span>
                  <p className="text-lg font-bold font-mono text-blue-400">{active_diet.protein_g}g</p>
                </div>
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Carbohydrates</span>
                  <p className="text-lg font-bold font-mono text-amber-400">{active_diet.carbs_g}g</p>
                </div>
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Healthy Fats</span>
                  <p className="text-lg font-bold font-mono text-rose-400">{active_diet.fat_g}g</p>
                </div>
              </div>

              {/* 🔥 COMPLETE DAILY MEALS & FOOD ROSTER */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Daily Meal Timetable & Nutritional Breakdown
                </h4>

                {active_diet.meals && active_diet.meals.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {active_diet.meals.map((meal, mIdx) => (
                      <div key={mIdx} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-2 mb-2">
                            <div>
                              <span className="text-[10px] font-mono font-bold text-lime-400 uppercase">Meal {mIdx + 1}</span>
                              <h5 className="text-sm font-bold text-white">{meal.meal_name}</h5>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                              🕒 {meal.meal_time?.slice(0, 5) || 'Scheduled'}
                            </span>
                          </div>

                          {/* Food Items List */}
                          <div className="space-y-2">
                            {meal.foods && meal.foods.length > 0 ? (
                              meal.foods.map((food, fIdx) => (
                                <div key={fIdx} className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60 flex justify-between items-center text-xs">
                                  <div>
                                    <strong className="text-zinc-200 block">{food.food_name}</strong>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                      {food.quantity} {food.unit}
                                    </span>
                                  </div>
                                  <div className="text-right font-mono text-[11px]">
                                    <span className="text-lime-400 font-bold block">{food.calories} kcal</span>
                                    <span className="text-blue-400 text-[10px]">P: {food.protein}g</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-zinc-600 italic py-2">No food items added in this meal.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-950 rounded-xl border border-dashed border-zinc-800 text-xs text-zinc-500 italic text-center">
                    Is diet plan ke andar koi individual meal schedule mapped nahi hai.
                  </div>
                )}
              </div>

              {active_diet.instructions && (
                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-xs">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Trainer Instructions / Guidelines:</span>
                  <p className="text-zinc-300 leading-relaxed">{active_diet.instructions}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-zinc-500 bg-zinc-900 border border-dashed border-zinc-800 rounded-2xl text-xs space-y-2">
              <span className="text-3xl block">🥗</span>
              <p className="font-semibold text-zinc-300">Is member ke paas koi active meal/diet program nahi hai.</p>
              <button
                onClick={() => setShowDietModal(true)}
                className="text-lime-400 hover:underline font-semibold"
              >
                Upar "+ Assign Diet Plan" par click karke diet attach karein.
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL 1: LOG MEASUREMENT ─── */}
      {showMeasureModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Log Physical Measurements</h3>
              <button onClick={() => setShowMeasureModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveMeasurement} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={measureForm.weight_kg}
                    onChange={(e) => setMeasureForm({ ...measureForm, weight_kg: e.target.value })}
                    className={inputCls}
                    placeholder="75.5"
                  />
                </div>
                <div>
                  <label className={labelCls}>Height (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measureForm.height_cm}
                    onChange={(e) => setMeasureForm({ ...measureForm, height_cm: e.target.value })}
                    className={inputCls}
                    placeholder="178"
                  />
                </div>
                <div>
                  <label className={labelCls}>Body Fat %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={measureForm.body_fat_percent}
                    onChange={(e) => setMeasureForm({ ...measureForm, body_fat_percent: e.target.value })}
                    className={inputCls}
                    placeholder="18.2"
                  />
                </div>
                <div>
                  <label className={labelCls}>Muscle Mass (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={measureForm.muscle_mass_kg}
                    onChange={(e) => setMeasureForm({ ...measureForm, muscle_mass_kg: e.target.value })}
                    className={inputCls}
                    placeholder="34.0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Chest (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measureForm.chest_cm}
                    onChange={(e) => setMeasureForm({ ...measureForm, chest_cm: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Waist (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measureForm.waist_cm}
                    onChange={(e) => setMeasureForm({ ...measureForm, waist_cm: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Biceps (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measureForm.biceps_cm}
                    onChange={(e) => setMeasureForm({ ...measureForm, biceps_cm: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50"
              >
                {submitting ? 'Recording...' : 'Save & Calculate BMI'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: ASSIGN DIET PLAN ─── */}
      {showDietModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Assign Master Diet Plan</h3>
              <button onClick={() => setShowDietModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAssignDiet} className="space-y-4">
              <div>
                <label className={labelCls}>Select Diet Program *</label>
                <select
                  required
                  value={dietAssignForm.diet_plan_id}
                  onChange={(e) => setDietAssignForm({ ...dietAssignForm, diet_plan_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">-- Choose Diet Plan --</option>
                  {dietCatalog.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.daily_calories} kcal • {p.goal_type})
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
                    value={dietAssignForm.start_date}
                    onChange={(e) => setDietAssignForm({ ...dietAssignForm, start_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>End Date</label>
                  <input
                    type="date"
                    value={dietAssignForm.end_date}
                    onChange={(e) => setDietAssignForm({ ...dietAssignForm, end_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50"
              >
                {submitting ? 'Assigning...' : 'Attach Diet Plan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: FULL WEEKLY WORKOUT SPLIT BUILDER ─── */}
      {showWorkoutModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Weekly Workout Split Builder</h3>
                <p className="text-xs text-zinc-400">Design training splits for {memberName} (Biceps, Triceps, Chest, Back organized)</p>
              </div>
              <button onClick={() => setShowWorkoutModal(false)} className="text-zinc-500 hover:text-white text-base">✕</button>
            </div>

            {/* Quick Presets Selection Bar */}
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2">
              <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block">
                ⚡ 1-Click Weekly Routine Presets
              </span>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyPreset('ppl')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-lime-400 border border-zinc-700 text-xs font-bold transition"
                >
                  + Load 6-Day PPL
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('bro_split')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700 text-xs font-bold transition"
                >
                  + Load 5-Day Bodypart Split
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('upper_lower')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-blue-400 border border-zinc-700 text-xs font-bold transition"
                >
                  + Load 4-Day Upper / Lower
                </button>
              </div>
            </div>

            {/* Dropdown Exercise Filter Ribbons */}
            <div className="flex items-center gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 overflow-x-auto scrollbar-none">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider shrink-0 pl-1">
                Filter Dropdowns:
              </span>
              <button
                type="button"
                onClick={() => setModalMuscleFilter('All')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition shrink-0 ${
                  modalMuscleFilter === 'All' ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                All Muscles
              </button>
              {MUSCLE_GROUPS.map((mg) => (
                <button
                  key={mg}
                  type="button"
                  onClick={() => setModalMuscleFilter(mg)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition shrink-0 ${
                    modalMuscleFilter.toLowerCase() === mg.toLowerCase()
                      ? 'bg-lime-400 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  {mg}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveWorkoutPlan} className="space-y-5">
              <div className="w-48">
                <label className={labelCls}>Plan Start Date *</label>
                <input
                  type="date"
                  required
                  value={workoutForm.start_date}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, start_date: e.target.value })}
                  className={inputCls}
                />
              </div>

              {/* Day Loop */}
              <div className="space-y-4">
                {workoutForm.days.map((day, dIdx) => (
                  <div key={dIdx} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3 relative">
                    <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-lime-400 text-zinc-950 font-bold font-mono text-[10px]">
                          DAY {day.day_number}
                        </span>
                        <span className="text-xs font-bold text-white uppercase">{day.day_name || 'Workout Day'}</span>
                      </div>
                      {workoutForm.days.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWorkoutDay(dIdx)}
                          className="text-xs text-red-400 hover:underline font-semibold"
                        >
                          Delete Day ✕
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Day Name / Muscle Split *</label>
                        <input
                          type="text"
                          required
                          value={day.day_name}
                          onChange={(e) => {
                            const updated = { ...workoutForm };
                            updated.days[dIdx].day_name = e.target.value;
                            setWorkoutForm(updated);
                          }}
                          className={inputCls}
                          placeholder="e.g. Chest & Triceps"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Focus Area</label>
                        <input
                          type="text"
                          value={day.focus_area}
                          onChange={(e) => {
                            const updated = { ...workoutForm };
                            updated.days[dIdx].focus_area = e.target.value;
                            setWorkoutForm(updated);
                          }}
                          className={inputCls}
                          placeholder="Hypertrophy / Strength / Delts"
                        />
                      </div>
                    </div>

                    {/* Exercises Inside Day */}
                    <div className="space-y-2 pt-2">
                      <div className="grid grid-cols-12 gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-1">
                        <span className="col-span-5">Exercise Name</span>
                        <span className="col-span-2">Sets</span>
                        <span className="col-span-2">Reps</span>
                        <span className="col-span-2">Target (kg)</span>
                        <span className="col-span-1 text-center">Action</span>
                      </div>

                      {day.exercises.map((ex, eIdx) => (
                        <div key={eIdx} className="grid grid-cols-12 gap-2 items-center bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/50">
                          <div className="col-span-5">
                            <select
                              required
                              value={ex.exercise_id}
                              onChange={(e) => {
                                const updated = { ...workoutForm };
                                updated.days[dIdx].exercises[eIdx].exercise_id = e.target.value;
                                setWorkoutForm(updated);
                              }}
                              className={inputCls}
                            >
                              <option value="">-- Choose Exercise --</option>
                              {Object.entries(filteredDropdownOptions).map(([groupName, exList]) => {
                                if (!exList || exList.length === 0) return null;
                                return (
                                  <optgroup key={groupName} label={`-- ${groupName.toUpperCase()} --`}>
                                    {exList.map((lib) => (
                                      <option key={lib.id} value={lib.id}>
                                        {lib.name} ({lib.equipment || 'Standard'})
                                      </option>
                                    ))}
                                  </optgroup>
                                );
                              })}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              placeholder="Sets"
                              value={ex.sets}
                              onChange={(e) => {
                                const updated = { ...workoutForm };
                                updated.days[dIdx].exercises[eIdx].sets = e.target.value;
                                setWorkoutForm(updated);
                              }}
                              className={inputCls}
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="text"
                              placeholder="Reps (10-12)"
                              value={ex.reps}
                              onChange={(e) => {
                                const updated = { ...workoutForm };
                                updated.days[dIdx].exercises[eIdx].reps = e.target.value;
                                setWorkoutForm(updated);
                              }}
                              className={inputCls}
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              step="0.5"
                              placeholder="Weight (kg)"
                              value={ex.target_weight_kg}
                              onChange={(e) => {
                                const updated = { ...workoutForm };
                                updated.days[dIdx].exercises[eIdx].target_weight_kg = e.target.value;
                                setWorkoutForm(updated);
                              }}
                              className={inputCls}
                            />
                          </div>
                          <div className="col-span-1 text-center">
                            {day.exercises.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeExerciseRow(dIdx, eIdx)}
                                className="text-zinc-500 hover:text-red-400 font-bold text-xs"
                                title="Remove exercise"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addExerciseRow(dIdx)}
                        className="text-xs text-lime-400 font-bold hover:underline pt-1 inline-block"
                      >
                        + Add Exercise To Day {day.day_number}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Next Day Button */}
              {workoutForm.days.length < 7 && (
                <button
                  type="button"
                  onClick={addWorkoutDay}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-lime-400 font-bold text-xs border border-dashed border-zinc-700 rounded-xl transition"
                >
                  + Add Next Workout Day (Day {workoutForm.days.length + 1})
                </button>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
              >
                {submitting ? 'Publishing Entire Weekly Split...' : `Save & Assign Entire ${workoutForm.days.length}-Day Routine`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}