const db = require('../config/db');

exports.getDashboardStats = async (req, res) => {
  const orgId = req.user.orgId;
  const { branch_id } = req.query;

  try {
    const branchFilterMembers = branch_id ? 'AND primary_branch_id = $2' : '';
    const branchFilterGeneral = branch_id ? 'AND branch_id = $2' : '';
    const params = branch_id ? [orgId, branch_id] : [orgId];

    // 1. Members Summary (Active, Inactive, Total)
    const memberStatsQuery = `
      SELECT 
        COUNT(*) AS total_members,
        COUNT(*) FILTER (WHERE status = 'active') AS active_members,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired_members,
        COUNT(*) FILTER (WHERE status = 'frozen') AS frozen_members
      FROM members
      WHERE organization_id = $1 AND deleted_at IS NULL ${branchFilterMembers};
    `;
    const memberStatsRes = await db.query(memberStatsQuery, params);

    // 2. Financial Metrics (Today's Collection, This Month's Collection, Pending Dues)
    const financialStatsQuery = `
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0) AS today_collection,
        COALESCE(SUM(amount) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)), 0) AS month_collection
      FROM payments
      WHERE organization_id = $1 AND status = 'success' ${branchFilterGeneral};
    `;
    const financialStatsRes = await db.query(financialStatsQuery, params);

    // Total Pending Dues from Invoices
    const dueStatsQuery = `
      SELECT 
        COALESCE(SUM(total_amount), 0) - COALESCE(
          (SELECT SUM(pa.allocated_amount) 
           FROM payment_allocations pa 
           JOIN invoices inv ON pa.invoice_id = inv.id 
           WHERE inv.organization_id = $1 ${branch_id ? 'AND inv.branch_id = $2' : ''}), 0
        ) AS total_pending_due
      FROM invoices
      WHERE organization_id = $1 AND payment_status IN ('unpaid', 'partially_paid') ${branchFilterGeneral};
    `;
    const dueStatsRes = await db.query(dueStatsQuery, params);

    // 3. Attendance Today
    const attendanceStatsQuery = `
      SELECT 
        COUNT(*) AS today_checkins,
        COUNT(*) FILTER (WHERE access_granted = TRUE) AS successful_entries,
        COUNT(*) FILTER (WHERE access_granted = FALSE) AS denied_entries
      FROM attendance
      WHERE organization_id = $1 AND DATE(check_in_time) = CURRENT_DATE ${branchFilterGeneral};
    `;
    const attendanceStatsRes = await db.query(attendanceStatsQuery, params);

    // 4. Memberships Expiring in Next 7 Days
    const upcomingExpiriesQuery = `
      SELECT 
        m.hash_id AS member_hash_id,
        m.member_code,
        m.first_name,
        m.last_name,
        m.phone,
        ms.end_date,
        mp.name AS plan_name
      FROM memberships ms
      JOIN members m ON ms.member_id = m.id
      JOIN membership_plans mp ON ms.plan_id = mp.id
      WHERE ms.organization_id = $1 
        AND ms.status = 'active'
        AND ms.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
        ${branch_id ? 'AND ms.branch_id = $2' : ''}
      ORDER BY ms.end_date ASC
      LIMIT 10;
    `;
    const upcomingExpiriesRes = await db.query(upcomingExpiriesQuery, params);

    // 5. Active Leads Summary
    const leadsStatsQuery = `
      SELECT 
        COUNT(*) AS total_leads,
        COUNT(*) FILTER (WHERE status = 'new') AS new_leads,
        COUNT(*) FILTER (WHERE status = 'contacted') AS contacted_leads,
        COUNT(*) FILTER (WHERE status = 'trial') AS trial_leads
      FROM leads
      WHERE organization_id = $1 ${branchFilterGeneral};
    `;
    const leadsStatsRes = await db.query(leadsStatsQuery, params);

    return res.status(200).json({
      success: true,
      data: {
        members: memberStatsRes.rows[0],
        revenue: {
          today: parseFloat(financialStatsRes.rows[0].today_collection),
          this_month: parseFloat(financialStatsRes.rows[0].month_collection),
          pending_due: Math.max(0, parseFloat(dueStatsRes.rows[0].total_pending_due))
        },
        attendance_today: attendanceStatsRes.rows[0],
        leads: leadsStatsRes.rows[0],
        expiring_soon: upcomingExpiriesRes.rows
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};