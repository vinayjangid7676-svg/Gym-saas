const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. GENERATE OR PREVIEW MONTH-END PAYROLL RUN
// ================================================================
exports.generateMonthlyPayroll = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const currentUserId = req.user?.userId || req.user?.id;
  const { branch_id, month, year, auto_commit = false } = req.body;

  const targetBranchId = branch_id ? parseInt(branch_id, 10) : req.user?.branch_id;
  const targetMonth = parseInt(month, 10);
  const targetYear = parseInt(year, 10);

  if (!targetBranchId || !targetMonth || !targetYear || targetMonth < 1 || targetMonth > 12) {
    client.release();
    return res.status(400).json({
      success: false,
      message: 'Branch ID, valid month (1-12), aur year anivarya hain.'
    });
  }

  try {
    await client.query('BEGIN');

    // Month date boundaries
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // 1. Fetch active staff members for this branch
    const staffQuery = `
      SELECT 
        sp.id, sp.hash_id, sp.employee_code, sp.designation,
        sp.payout_type, sp.monthly_fixed_salary, sp.hourly_rate,
        sp.commission_percentage, sp.weekly_off, sp.late_grace_minutes,
        u.name, u.phone
      FROM staff_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE sp.organization_id = $1 AND sp.branch_id = $2 AND sp.is_active = TRUE
      ORDER BY sp.id ASC
    `;
    const staffRes = await client.query(staffQuery, [orgId, targetBranchId]);
    const staffMembers = staffRes.rows;

    if (staffMembers.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Is branch me koi active staff member nahi mila.'
      });
    }

    const payrollItems = [];
    let grandTotalPayout = 0;

    for (const staff of staffMembers) {
      // 2. Fetch Attendance Summary for current month
      const attQuery = `
        SELECT 
          COUNT(*)::int as total_clocked_days,
          COALESCE(SUM(worked_minutes), 0)::int as total_worked_minutes,
          COALESCE(SUM(late_minutes), 0)::int as total_late_minutes,
          COALESCE(SUM(overtime_minutes), 0)::int as total_overtime_minutes,
          COUNT(CASE WHEN late_minutes > sp.late_grace_minutes THEN 1 END)::int as late_penalty_count
        FROM staff_attendance sa
        JOIN staff_profiles sp ON sp.id = sa.staff_id
        WHERE sa.staff_id = $1 
          AND sa.attendance_date >= $2 
          AND sa.attendance_date <= $3
          AND sa.status = 'present'
        GROUP BY sp.late_grace_minutes
      `;
      const attRes = await client.query(attQuery, [staff.id, startDate, endDate]);
      const attData = attRes.rows[0] || {
        total_clocked_days: 0,
        total_worked_minutes: 0,
        total_late_minutes: 0,
        total_overtime_minutes: 0,
        late_penalty_count: 0
      };

      // 3. PT Sessions & Commission Calculation
      // Formula: session_rate = plan_price / sessions_total
      const ptQuery = `
        SELECT 
          COUNT(pts.id)::int as completed_sessions,
          COALESCE(SUM(ptp.price / NULLIF(pte.sessions_total, 0)), 0)::numeric(12,2) as generated_revenue
        FROM personal_training_sessions pts
        JOIN personal_training_enrollments pte ON pte.id = pts.enrollment_id
        JOIN personal_training_plans ptp ON ptp.id = pte.plan_id
        WHERE pte.trainer_id = $1
          AND pts.status = 'completed'
          AND pts.actual_start >= $2::timestamptz
          AND pts.actual_start <= ($3 || ' 23:59:59')::timestamptz
      `;
      const ptRes = await client.query(ptQuery, [staff.id, startDate, endDate]);
      const ptData = ptRes.rows[0] || { completed_sessions: 0, generated_revenue: 0 };

      const completedPtSessions = parseInt(ptData.completed_sessions, 10);
      const ptRevenue = parseFloat(ptData.generated_revenue || 0);
      const commRate = parseFloat(staff.commission_percentage || 0);
      const commissionAmount = parseFloat(((ptRevenue * commRate) / 100).toFixed(2));

      // 4. Base & Overtime Salary Breakdown
      let basicAmount = 0;
      let overtimeAmount = 0;
      let deductionAmount = 0;

      const monthlySalary = parseFloat(staff.monthly_fixed_salary || 0);
      const hourlyRate = parseFloat(staff.hourly_rate || 0);
      const totalHoursWorked = parseFloat((attData.total_worked_minutes / 60).toFixed(2));

      if (staff.payout_type === 'fixed') {
        const perDayRate = monthlySalary / lastDay;
        // Half-day deduction for every 2 late arrivals exceeding grace
        const halfDayDeductions = Math.floor(attData.late_penalty_count / 2) * (perDayRate * 0.5);
        deductionAmount = parseFloat(halfDayDeductions.toFixed(2));
        
        // Full fixed salary base minus unexcused unpaid absences (pro-rated if clocked < expected days)
        // Yahan gym policy ke mutabiq default full salary ya day-wise count lag sakta hai
        basicAmount = parseFloat(Math.max(0, monthlySalary - deductionAmount).toFixed(2));

        // Overtime compensation
        if (attData.total_overtime_minutes > 0) {
          const perHourRate = (monthlySalary / lastDay) / 8; // Assuming 8-hr shift
          overtimeAmount = parseFloat(((attData.total_overtime_minutes / 60) * perHourRate * 1.5).toFixed(2));
        }
      } else if (staff.payout_type === 'hourly') {
        basicAmount = parseFloat((totalHoursWorked * hourlyRate).toFixed(2));
      } else if (staff.payout_type === 'commission') {
        basicAmount = 0.00; // purely variable
      }

      const netAmount = parseFloat((basicAmount + overtimeAmount + commissionAmount).toFixed(2));
      grandTotalPayout += netAmount;

      payrollItems.push({
        staff_id: staff.id,
        staff_hash_id: staff.hash_id,
        name: staff.name,
        phone: staff.phone,
        employee_code: staff.employee_code,
        designation: staff.designation,
        payout_type: staff.payout_type,
        total_days_in_month: lastDay,
        present_days: attData.total_clocked_days,
        late_days: attData.late_penalty_count,
        total_hours_worked: totalHoursWorked,
        completed_pt_sessions: completedPtSessions,
        pt_session_revenue: ptRevenue,
        commission_percentage: commRate,
        basic_amount: basicAmount,
        overtime_amount: overtimeAmount,
        commission_amount: commissionAmount,
        deduction_amount: deductionAmount,
        net_amount: netAmount,
        breakdown: {
          worked_minutes: attData.total_worked_minutes,
          late_minutes: attData.total_late_minutes,
          overtime_minutes: attData.total_overtime_minutes
        }
      });
    }

    // 5. If auto_commit is true, save in Database
    let salaryRunRecord = null;
    if (auto_commit) {
      // Check existing salary run for this branch & month
      const checkRun = await client.query(
        'SELECT id, status FROM staff_salary_runs WHERE branch_id = $1 AND month = $2 AND year = $3',
        [targetBranchId, targetMonth, targetYear]
      );

      let runId;
      if (checkRun.rows.length > 0) {
        if (checkRun.rows[0].status === 'approved' || checkRun.rows[0].status === 'paid') {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Month ${targetMonth}/${targetYear} ki salary pehle se ${checkRun.rows[0].status} hai.`
          });
        }
        runId = checkRun.rows[0].id;
        await client.query(
          `UPDATE staff_salary_runs 
           SET total_payout = $1, processed_by = $2, processed_at = NOW(), updated_at = NOW() 
           WHERE id = $3`,
          [grandTotalPayout, currentUserId, runId]
        );
        // Clear previous draft line items
        await client.query('DELETE FROM staff_salary_items WHERE salary_run_id = $1', [runId]);
      } else {
        const runHashId = generateHashId('run_');
        const insertRun = await client.query(
          `INSERT INTO staff_salary_runs (
            hash_id, organization_id, branch_id, month, year, status, 
            total_payout, processed_by, processed_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, NOW(), NOW())
          RETURNING *;`,
          [runHashId, orgId, targetBranchId, targetMonth, targetYear, grandTotalPayout, currentUserId]
        );
        runId = insertRun.rows[0].id;
        salaryRunRecord = insertRun.rows[0];
      }

      // Insert line items
      for (const item of payrollItems) {
        await client.query(
          `INSERT INTO staff_salary_items (
            salary_run_id, staff_id, basic_amount, overtime_amount,
            commission_amount, deduction_amount, net_amount, payment_status,
            total_days_in_month, present_days, late_days, completed_pt_sessions,
            pt_session_revenue, total_hours_worked, breakdown, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'unpaid', $8, $9, $10, $11, $12, $13, $14, NOW())`,
          [
            runId,
            item.staff_id,
            item.basic_amount,
            item.overtime_amount,
            item.commission_amount,
            item.deduction_amount,
            item.net_amount,
            item.total_days_in_month,
            item.present_days,
            item.late_days,
            item.completed_pt_sessions,
            item.pt_session_revenue,
            item.total_hours_worked,
            JSON.stringify(item.breakdown)
          ]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: auto_commit 
        ? `Month ${targetMonth}/${targetYear} ka Payroll Draft successfully generate aur save ho gaya.` 
        : `Payroll preview calculated successfully.`,
      summary: {
        total_staff: payrollItems.length,
        total_payout: grandTotalPayout,
        month: targetMonth,
        year: targetYear,
        is_saved: auto_commit,
        salary_run: salaryRunRecord
      },
      data: payrollItems
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('generateMonthlyPayroll Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 2. DISBURSE SINGLE STAFF SALARY & AUTO RECORD EXPENSE
// ================================================================
exports.disburseStaffSalary = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const currentUserId = req.user?.userId || req.user?.id;
  const { salary_item_id, payment_method = 'upi_qr', transaction_reference, notes } = req.body;

  if (!salary_item_id) {
    client.release();
    return res.status(400).json({ success: false, message: 'salary_item_id zaroori hai.' });
  }

  try {
    await client.query('BEGIN');

    // Fetch line item
    const itemQuery = `
      SELECT 
        si.*, 
        sr.branch_id, sr.month, sr.year,
        sp.user_id, u.name as staff_name, sp.employee_code
      FROM staff_salary_items si
      JOIN staff_salary_runs sr ON sr.id = si.salary_run_id
      JOIN staff_profiles sp ON sp.id = si.staff_id
      JOIN users u ON u.id = sp.user_id
      WHERE si.id = $1 AND sr.organization_id = $2 FOR UPDATE
    `;
    const itemRes = await client.query(itemQuery, [parseInt(salary_item_id, 10), orgId]);

    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Salary line item record nahi mila.' });
    }

    const item = itemRes.rows[0];

    if (item.payment_status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Yeh salary pehle se paid ho chuki hai.' });
    }

    // 1. Record in staff_salary_payments
    const paymentHashId = generateHashId('spm_');
    const paymentRes = await client.query(
      `INSERT INTO staff_salary_payments (
        hash_id, salary_item_id, amount, payment_method,
        transaction_reference, paid_at, paid_by
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      RETURNING *;`,
      [
        paymentHashId,
        item.id,
        item.net_amount,
        payment_method,
        transaction_reference || `SAL-${item.month}-${item.year}-${item.employee_code}`,
        currentUserId
      ]
    );

    // 2. Mark item as Paid
    await client.query(
      `UPDATE staff_salary_items SET payment_status = 'paid' WHERE id = $1`,
      [item.id]
    );

    // 3. Link to Accounting: Auto-Create Entry in expenses table
    // Resolve or create "Staff Salaries" expense category
    let expCatRes = await client.query(
      `SELECT id FROM expense_categories WHERE organization_id = $1 AND LOWER(name) = 'staff salary & commissions' LIMIT 1`,
      [orgId]
    );
    let catId;
    if (expCatRes.rows.length > 0) {
      catId = expCatRes.rows[0].id;
    } else {
      const catHash = generateHashId('exc_');
      const createCat = await client.query(
        `INSERT INTO expense_categories (hash_id, organization_id, name) VALUES ($1, $2, 'Staff Salary & Commissions') RETURNING id`,
        [catHash, orgId]
      );
      catId = createCat.rows[0].id;
    }

    const expHash = generateHashId('exp_');
    await client.query(
      `INSERT INTO expenses (
        hash_id, organization_id, branch_id, category_id,
        amount, expense_date, payment_method, description, status, created_by, approved_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, 'paid', $8, $8, NOW())`,
      [
        expHash,
        orgId,
        item.branch_id,
        catId,
        item.net_amount,
        payment_method,
        `Salary Payout for ${item.staff_name} (${item.employee_code}) - Month ${item.month}/${item.year}. (Basic: ₹${item.basic_amount}, PT Comm: ₹${item.commission_amount})`,
        currentUserId
      ]
    );

    // 4. If all items in this run are paid, mark salary run as 'paid'
    const pendingItems = await client.query(
      `SELECT COUNT(*)::int as unpaid_count FROM staff_salary_items WHERE salary_run_id = $1 AND payment_status != 'paid'`,
      [item.salary_run_id]
    );

    if (parseInt(pendingItems.rows[0].unpaid_count, 10) === 0) {
      await client.query(
        `UPDATE staff_salary_runs SET status = 'paid' WHERE id = $1`,
        [item.salary_run_id]
      );
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `${item.staff_name} ko ₹${item.net_amount} successfully disburse ho gaye.`,
      payment: paymentRes.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disburseStaffSalary Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 3. GET SALARY HISTORY & RUN DETAILS
// ================================================================
exports.getSalaryRuns = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { branch_id, year } = req.query;

  try {
    let query = `
      SELECT 
        sr.id, sr.hash_id, sr.month, sr.year, sr.status, sr.total_payout,
        sr.processed_at, sr.created_at,
        b.name as branch_name,
        u.name as processed_by_name,
        (SELECT COUNT(*)::int FROM staff_salary_items ssi WHERE ssi.salary_run_id = sr.id) as staff_count,
        (SELECT COUNT(*)::int FROM staff_salary_items ssi WHERE ssi.salary_run_id = sr.id AND ssi.payment_status = 'paid') as paid_count
      FROM staff_salary_runs sr
      JOIN branches b ON b.id = sr.branch_id
      LEFT JOIN users u ON u.id = sr.processed_by
      WHERE sr.organization_id = $1
    `;
    const params = [parseInt(orgId, 10)];

    if (branch_id && !isNaN(parseInt(branch_id, 10))) {
      params.push(parseInt(branch_id, 10));
      query += ` AND sr.branch_id = $${params.length}`;
    }

    if (year && !isNaN(parseInt(year, 10))) {
      params.push(parseInt(year, 10));
      query += ` AND sr.year = $${params.length}`;
    }

    query += ` ORDER BY sr.year DESC, sr.month DESC;`;

    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 4. GET SINGLE SALARY RUN WITH EMPLOYEE BREAKDOWN
// ================================================================
exports.getSalaryRunDetails = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { id } = req.params;

  try {
    const runQuery = `
      SELECT sr.*, b.name as branch_name
      FROM staff_salary_runs sr
      JOIN branches b ON b.id = sr.branch_id
      WHERE (sr.id = $1 OR sr.hash_id = $2) AND sr.organization_id = $3
      LIMIT 1;
    `;
    const runRes = await db.query(runQuery, [
      isNaN(parseInt(id, 10)) ? -1 : parseInt(id, 10),
      id,
      parseInt(orgId, 10)
    ]);

    if (runRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Salary run record nahi mila.' });
    }

    const run = runRes.rows[0];

    const itemsQuery = `
      SELECT 
        si.*, 
        sp.hash_id as staff_hash_id, sp.employee_code, sp.designation, sp.payout_type,
        u.name as staff_name, u.phone as staff_phone,
        ssp.payment_method, ssp.transaction_reference, ssp.paid_at
      FROM staff_salary_items si
      JOIN staff_profiles sp ON sp.id = si.staff_id
      JOIN users u ON u.id = sp.user_id
      LEFT JOIN staff_salary_payments ssp ON ssp.salary_item_id = si.id
      WHERE si.salary_run_id = $1
      ORDER BY si.id ASC;
    `;
    const { rows: items } = await db.query(itemsQuery, [run.id]);

    return res.status(200).json({
      success: true,
      run,
      items
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};