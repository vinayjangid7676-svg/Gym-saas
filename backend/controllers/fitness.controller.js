const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. HEALTH PROFILE & MEASUREMENTS (Section 7)
// ================================================================

exports.saveHealthProfile = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const {
    member_id,
    medical_notes,
    allergies,
    medications,
    emergency_medical_notes,
    doctor_name,
    doctor_phone,
    fitness_clearance = true,
    clearance_date
  } = req.body;

  if (!member_id) {
    client.release();
    return res.status(400).json({ success: false, message: 'member_id required hai.' });
  }

  try {
    await client.query('BEGIN');
    const hashId = generateHashId('hlp_');
    const query = `
      INSERT INTO member_health_profiles (
        hash_id, member_id, medical_notes, allergies, medications,
        emergency_medical_notes, doctor_name, doctor_phone,
        fitness_clearance, clearance_date, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (member_id) DO UPDATE SET
        medical_notes = EXCLUDED.medical_notes,
        allergies = EXCLUDED.allergies,
        medications = EXCLUDED.medications,
        emergency_medical_notes = EXCLUDED.emergency_medical_notes,
        doctor_name = EXCLUDED.doctor_name,
        doctor_phone = EXCLUDED.doctor_phone,
        fitness_clearance = EXCLUDED.fitness_clearance,
        clearance_date = EXCLUDED.clearance_date,
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [
      hashId,
      parseInt(member_id, 10),
      medical_notes || null,
      allergies || null,
      medications || null,
      emergency_medical_notes || null,
      doctor_name || null,
      doctor_phone || null,
      fitness_clearance,
      clearance_date || null
    ];
    const { rows } = await client.query(query, values);
    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Health profile updated.', data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

exports.recordMeasurements = async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const {
    member_id,
    weight_kg,
    height_cm,
    body_fat_percent,
    muscle_mass_kg,
    chest_cm,
    waist_cm,
    hip_cm,
    biceps_cm,
    thigh_cm,
    neck_cm,
    notes
  } = req.body;

  if (!member_id || !weight_kg) {
    return res.status(400).json({ success: false, message: 'member_id aur weight_kg required hain.' });
  }

  let bmi = null;
  const numWeight = parseFloat(weight_kg);
  const numHeight = parseFloat(height_cm);
  if (numWeight && numHeight) {
    const heightInMeters = numHeight / 100;
    bmi = parseFloat((numWeight / (heightInMeters * heightInMeters)).toFixed(2));
  }

  try {
    const hashId = generateHashId('mea_');
    const query = `
      INSERT INTO member_measurements (
        hash_id, member_id, recorded_by, measured_at, weight_kg,
        height_cm, bmi, body_fat_percent, muscle_mass_kg,
        chest_cm, waist_cm, hip_cm, biceps_cm, thigh_cm, neck_cm, notes
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;
    `;
    const values = [
      hashId,
      parseInt(member_id, 10),
      userId ? parseInt(userId, 10) : null,
      numWeight,
      numHeight || null,
      bmi,
      body_fat_percent ? parseFloat(body_fat_percent) : null,
      muscle_mass_kg ? parseFloat(muscle_mass_kg) : null,
      chest_cm ? parseFloat(chest_cm) : null,
      waist_cm ? parseFloat(waist_cm) : null,
      hip_cm ? parseFloat(hip_cm) : null,
      biceps_cm ? parseFloat(biceps_cm) : null,
      thigh_cm ? parseFloat(thigh_cm) : null,
      neck_cm ? parseFloat(neck_cm) : null,
      notes || null
    ];
    const { rows } = await db.query(query, values);
    return res.status(201).json({ success: true, message: 'Measurements recorded.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. EXERCISE & WORKOUT MANAGEMENT (Section 8)
// ================================================================

exports.createExercise = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const {
    category_id,
    name,
    description,
    muscle_group,
    equipment,
    difficulty = 'intermediate',
    video_url,
    instructions
  } = req.body;

  if (!name || !muscle_group) {
    return res.status(400).json({ success: false, message: 'name aur muscle_group required hain.' });
  }

  try {
    const hashId = generateHashId('exe_');
    const query = `
      INSERT INTO exercises (
        hash_id, organization_id, category_id, name, description,
        muscle_group, equipment, difficulty, video_url, instructions, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
      RETURNING *;
    `;
    const values = [
      hashId,
      orgId ? parseInt(orgId, 10) : null,
      category_id ? parseInt(category_id, 10) : null,
      name.trim(),
      description ? description.trim() : 'Standard form instruction.',
      muscle_group.trim(),
      equipment ? equipment.trim() : 'Barbell',
      difficulty.trim(),
      video_url || null,
      instructions || null
    ];
    const { rows } = await db.query(query, values);
    return res.status(201).json({ success: true, message: 'Exercise added to library.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.createMemberWorkoutPlan = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const trainerUserId = req.user?.userId || req.user?.id;
  const {
    member_id,
    template_id,
    start_date,
    end_date,
    notes,
    days
  } = req.body;

  if (!member_id || !start_date || !days || !days.length) {
    client.release();
    return res.status(400).json({ success: false, message: 'member_id, start_date aur workout days required hain.' });
  }

  const parsedMemberId = parseInt(member_id, 10);

  try {
    await client.query('BEGIN');

    // Retrieve staff profile id if caller is trainer
    let staffProfileId = null;
    const staffRes = await client.query(
      'SELECT id FROM staff_profiles WHERE user_id = $1 AND organization_id = $2 LIMIT 1',
      [trainerUserId, orgId]
    );
    if (staffRes.rows.length > 0) {
      staffProfileId = staffRes.rows[0].id;
    }

    // Archive any existing active plans for this member
    await client.query(
      `UPDATE member_workout_plans 
       SET status = 'completed' 
       WHERE member_id = $1 AND status = 'active'`,
      [parsedMemberId]
    );

    const planHashId = generateHashId('mwp_');
    const planQuery = `
      INSERT INTO member_workout_plans (
        hash_id, member_id, template_id, trainer_id, start_date, end_date, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
      RETURNING id, hash_id, member_id, start_date, status;
    `;
    const planRes = await client.query(planQuery, [
      planHashId,
      parsedMemberId,
      template_id ? parseInt(template_id, 10) : null,
      staffProfileId,
      start_date,
      end_date || null,
      notes || null
    ]);
    const planId = planRes.rows[0].id;

    for (const d of days) {
      const dayHashId = generateHashId('mwd_');
      const dayQuery = `
        INSERT INTO member_workout_days (
          hash_id, workout_plan_id, day_number, day_name, focus_area, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `;
      const dayRes = await client.query(dayQuery, [
        dayHashId,
        planId,
        parseInt(d.day_number || 1, 10),
        d.day_name || 'Day 1',
        d.focus_area || null,
        d.notes || null
      ]);
      const dayId = dayRes.rows[0].id;

      if (Array.isArray(d.exercises) && d.exercises.length) {
        for (const ex of d.exercises) {
          if (!ex.exercise_id) continue;
          const exQuery = `
            INSERT INTO member_workout_exercises (
              workout_day_id, exercise_id, sequence_no, sets, reps,
              target_weight_kg, rest_seconds, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
          `;
          await client.query(exQuery, [
            dayId,
            parseInt(ex.exercise_id, 10),
            parseInt(ex.sequence_no || 1, 10),
            parseInt(ex.sets || 3, 10),
            String(ex.reps || '10-12'),
            parseFloat(ex.target_weight_kg || 0),
            parseInt(ex.rest_seconds || 60, 10),
            ex.notes || null
          ]);
        }
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Custom workout plan member ko successfully assign ho gaya.',
      workout_plan: planRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

exports.logWorkout = async (req, res) => {
  const {
    member_id,
    workout_day_id,
    exercise_id,
    sets_completed,
    reps_completed,
    weight_kg,
    duration_seconds,
    calories_burned,
    notes
  } = req.body;

  if (!member_id || !exercise_id) {
    return res.status(400).json({ success: false, message: 'member_id aur exercise_id required hain.' });
  }

  try {
    const hashId = generateHashId('wkl_');
    const query = `
      INSERT INTO workout_logs (
        hash_id, member_id, workout_day_id, exercise_id, performed_at,
        sets_completed, reps_completed, weight_kg, duration_seconds, calories_burned, notes
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      hashId,
      parseInt(member_id, 10),
      workout_day_id ? parseInt(workout_day_id, 10) : null,
      parseInt(exercise_id, 10),
      sets_completed ? parseInt(sets_completed, 10) : null,
      reps_completed || null,
      weight_kg ? parseFloat(weight_kg) : null,
      duration_seconds ? parseInt(duration_seconds, 10) : null,
      calories_burned ? parseFloat(calories_burned) : null,
      notes || null
    ];
    const { rows } = await db.query(query, values);
    return res.status(201).json({ success: true, message: 'Workout log recorded.', log: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 3. DIET & NUTRITION ENGINE (Section 9)
// ================================================================

exports.createFood = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g } = req.body;

  if (!name || calories === undefined || protein_g === undefined) {
    return res.status(400).json({ success: false, message: 'name, calories, aur protein_g required hain.' });
  }

  try {
    const hashId = generateHashId('fod_');
    const query = `
      INSERT INTO foods (
        hash_id, organization_id, name, serving_size,
        calories, protein_g, carbs_g, fat_g, fiber_g, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
      RETURNING *;
    `;
    const values = [
      hashId,
      orgId ? parseInt(orgId, 10) : null,
      name.trim(),
      serving_size ? serving_size.trim() : '100g',
      parseFloat(calories || 0),
      parseFloat(protein_g || 0),
      parseFloat(carbs_g || 0),
      parseFloat(fat_g || 0),
      parseFloat(fiber_g || 0)
    ];
    const { rows } = await db.query(query, values);
    return res.status(201).json({ success: true, message: 'Food item added to pantry.', food: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.createDietPlan = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const userId = req.user?.userId || req.user?.id;

  const {
    name,
    goal_type,
    daily_calories,
    protein_g,
    carbs_g,
    fat_g,
    duration_days = 30,
    instructions,
    meals
  } = req.body;

  if (!name || !daily_calories || !meals || !meals.length) {
    client.release();
    return res.status(400).json({ success: false, message: 'name, daily_calories aur meals required hain.' });
  }

  try {
    await client.query('BEGIN');

    const planHashId = generateHashId('dtp_');
    const planQuery = `
      INSERT INTO diet_plans (
        hash_id, organization_id, created_by, name, goal_type,
        daily_calories, protein_g, carbs_g, fat_g, duration_days, instructions, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
      RETURNING id, hash_id, name, daily_calories, goal_type;
    `;
    const planRes = await client.query(planQuery, [
      planHashId,
      orgId ? parseInt(orgId, 10) : null,
      userId ? parseInt(userId, 10) : null,
      name.trim(),
      goal_type || 'Muscle Gain',
      parseFloat(daily_calories),
      parseFloat(protein_g || 0),
      parseFloat(carbs_g || 0),
      parseFloat(fat_g || 0),
      parseInt(duration_days, 10),
      instructions || null
    ]);
    const planId = planRes.rows[0].id;

    for (const m of meals) {
      const mealQuery = `
        INSERT INTO diet_plan_meals (
          diet_plan_id, meal_name, meal_time, sequence_no
        ) VALUES ($1, $2, $3, $4)
        RETURNING id;
      `;
      const mealRes = await client.query(mealQuery, [
        planId,
        m.meal_name,
        m.meal_time || '08:00:00',
        parseInt(m.sequence_no || 1, 10)
      ]);
      const mealId = mealRes.rows[0].id;

      if (Array.isArray(m.foods) && m.foods.length) {
        for (const f of m.foods) {
          if (!f.food_id) continue;
          const foodQuery = `
            INSERT INTO diet_plan_foods (
              meal_id, food_id, quantity, unit
            ) VALUES ($1, $2, $3, $4);
          `;
          await client.query(foodQuery, [
            mealId,
            parseInt(f.food_id, 10),
            parseFloat(f.quantity || 100),
            f.unit || 'grams'
          ]);
        }
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Master diet plan created successfully.',
      diet_plan: planRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

exports.assignDietToMember = async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const { member_id, diet_plan_id, start_date, end_date, notes } = req.body;

  if (!member_id || !diet_plan_id || !start_date) {
    return res.status(400).json({ success: false, message: 'member_id, diet_plan_id aur start_date zaroori hain.' });
  }

  const parsedMemberId = parseInt(member_id, 10);

  try {
    await db.query(
      `UPDATE member_diet_plans SET status = 'completed' WHERE member_id = $1 AND status = 'active'`,
      [parsedMemberId]
    );

    const hashId = generateHashId('mdp_');
    const query = `
      INSERT INTO member_diet_plans (
        hash_id, member_id, diet_plan_id, assigned_by, start_date, end_date, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId,
      parsedMemberId,
      parseInt(diet_plan_id, 10),
      userId ? parseInt(userId, 10) : null,
      start_date,
      end_date || null,
      notes || null
    ]);
    return res.status(201).json({ success: true, message: 'Diet plan member ko assign ho gaya.', assignment: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 4. GET METHODS FOR UI DATA LOADING
// ================================================================

exports.getMemberFitnessOverview = async (req, res) => {
  const { memberId } = req.params;

  if (!memberId || isNaN(parseInt(memberId, 10))) {
    return res.status(400).json({ success: false, message: 'Valid memberId zaroori hai.' });
  }

  try {
    const memId = parseInt(memberId, 10);

    const [healthRes, measurementsRes, workoutRes, dietRes] = await Promise.all([
      db.query('SELECT * FROM member_health_profiles WHERE member_id = $1 LIMIT 1', [memId]),
      db.query('SELECT * FROM member_measurements WHERE member_id = $1 ORDER BY measured_at DESC LIMIT 10', [memId]),
      db.query(`
        SELECT mwp.*, u.name as trainer_name
        FROM member_workout_plans mwp
        LEFT JOIN staff_profiles sp ON sp.id = mwp.trainer_id
        LEFT JOIN users u ON u.id = sp.user_id
        WHERE mwp.member_id = $1 AND mwp.status = 'active'
        ORDER BY mwp.id DESC LIMIT 1
      `, [memId]),
      db.query(`
        SELECT 
          mdp.*, 
          dp.name as plan_name, 
          dp.daily_calories, 
          dp.protein_g, 
          dp.carbs_g, 
          dp.fat_g, 
          dp.instructions,
          COALESCE((
            SELECT json_agg(json_build_object(
              'meal_id', dpm.id,
              'meal_name', dpm.meal_name,
              'meal_time', dpm.meal_time,
              'foods', COALESCE((
                SELECT json_agg(json_build_object(
                  'food_id', f.id,
                  'food_name', f.name,
                  'quantity', dpf.quantity,
                  'unit', dpf.unit,
                  'calories', f.calories,
                  'protein', f.protein_g
                ))
                FROM diet_plan_foods dpf
                JOIN foods f ON f.id = dpf.food_id
                WHERE dpf.meal_id = dpm.id
              ), '[]'::json)
            ) ORDER BY dpm.sequence_no ASC)
            FROM diet_plan_meals dpm
            WHERE dpm.diet_plan_id = dp.id
          ), '[]'::json) AS meals
        FROM member_diet_plans mdp
        JOIN diet_plans dp ON dp.id = mdp.diet_plan_id
        WHERE mdp.member_id = $1 AND mdp.status = 'active'
        ORDER BY mdp.id DESC LIMIT 1;
      `, [memId])
    ]);

    let workoutDays = [];
    if (workoutRes.rows.length > 0) {
      const planId = workoutRes.rows[0].id;
      const daysRes = await db.query(`
        SELECT mwd.*,
          COALESCE((
            SELECT json_agg(json_build_object(
              'exercise_id', e.id,
              'exercise_name', e.name,
              'muscle_group', e.muscle_group,
              'equipment', e.equipment,
              'sets', mwe.sets,
              'reps', mwe.reps,
              'target_weight_kg', mwe.target_weight_kg,
              'rest_seconds', mwe.rest_seconds
            ))
            FROM member_workout_exercises mwe
            JOIN exercises e ON e.id = mwe.exercise_id
            WHERE mwe.workout_day_id = mwd.id
          ), '[]'::json) as exercises
        FROM member_workout_days mwd
        WHERE mwd.workout_plan_id = $1
        ORDER BY mwd.day_number ASC
      `, [planId]);
      workoutDays = daysRes.rows;
    }

    return res.status(200).json({
      success: true,
      data: {
        health: healthRes.rows[0] || null,
        measurements: measurementsRes.rows || [],
        latest_measurement: measurementsRes.rows[0] || null,
        active_workout: workoutRes.rows[0] ? { ...workoutRes.rows[0], days: workoutDays } : null,
        active_diet: dietRes.rows[0] || null
      }
    });
  } catch (error) {
    console.error('getMemberFitnessOverview Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.getExercises = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { muscle_group, search, equipment } = req.query;

  try {
    let query = `
      SELECT id, hash_id, name, description, muscle_group, equipment, difficulty, video_url, instructions, is_active
      FROM exercises
      WHERE (organization_id = $1 OR organization_id IS NULL) AND is_active = TRUE
    `;
    const params = [parseInt(orgId, 10)];

    if (muscle_group && muscle_group.toLowerCase() !== 'all') {
      params.push(muscle_group.trim());
      query += ` AND LOWER(muscle_group) = LOWER($${params.length})`;
    }

    if (equipment && equipment.toLowerCase() !== 'all') {
      params.push(equipment.trim());
      query += ` AND LOWER(equipment) = LOWER($${params.length})`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    query += ` ORDER BY name ASC;`;

    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.getDietCatalog = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  try {
    const parsedOrg = parseInt(orgId, 10);

    const [foodsRes, plansRes] = await Promise.all([
      db.query(
        'SELECT * FROM foods WHERE (organization_id = $1 OR organization_id IS NULL) AND is_active = TRUE ORDER BY name ASC',
        [parsedOrg]
      ),
      db.query(`
        SELECT 
          dp.*,
          COALESCE((
            SELECT json_agg(json_build_object(
              'meal_id', dpm.id,
              'meal_name', dpm.meal_name,
              'meal_time', dpm.meal_time,
              'foods', COALESCE((
                SELECT json_agg(json_build_object(
                  'food_id', f.id,
                  'food_name', f.name,
                  'quantity', dpf.quantity,
                  'unit', dpf.unit,
                  'calories', f.calories,
                  'protein', f.protein_g
                ))
                FROM diet_plan_foods dpf
                JOIN foods f ON f.id = dpf.food_id
                WHERE dpf.meal_id = dpm.id
              ), '[]'::json)
            ) ORDER BY dpm.sequence_no ASC)
            FROM diet_plan_meals dpm
            WHERE dpm.diet_plan_id = dp.id
          ), '[]'::json) AS meals
        FROM diet_plans dp
        WHERE (dp.organization_id = $1 OR dp.organization_id IS NULL) AND dp.is_active = TRUE
        ORDER BY dp.id DESC;
      `, [parsedOrg])
    ]);

    return res.status(200).json({
      success: true,
      foods: foodsRes.rows || [],
      plans: plansRes.rows || []
    });
  } catch (error) {
    console.error('getDietCatalog Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};