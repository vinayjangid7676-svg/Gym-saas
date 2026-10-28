// const crypto = require('crypto');
// const db = require('../config/db');

// const generateHashId = (prefix = '') => {
//   const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
//   return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
// };

// // ================================================================
// // 1. GET ALL MASTER CLASSES (Branch/Org Scoped with Dynamic Price)
// // ================================================================
// exports.getClasses = async (req, res) => {
//   const orgId = req.user?.orgId || req.user?.org_id || req.user?.organization_id;
//   const { branch_id } = req.query;

//   try {
//     let query = `
//       SELECT 
//         c.*,
//         b.name as branch_name,
//         (SELECT COUNT(*) FROM class_schedules cs WHERE cs.class_id = c.id AND cs.status = 'scheduled') AS active_schedules_count
//       FROM classes c
//       JOIN branches b ON b.id = c.branch_id
//       WHERE c.organization_id = $1
//     `;
//     const params = [parseInt(orgId, 10)];

//     if (branch_id && !isNaN(parseInt(branch_id, 10))) {
//       params.push(parseInt(branch_id, 10));
//       query += ` AND c.branch_id = $${params.length}`;
//     }

//     query += ` ORDER BY c.id DESC;`;

//     const { rows } = await db.query(query, params);
//     return res.status(200).json({ success: true, count: rows.length, data: rows });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// // ================================================================
// // 2. CREATE MASTER GROUP CLASS (With Custom Price & Capacity)
// // ================================================================
// exports.createClass = async (req, res) => {
//   const orgId = req.user?.orgId || req.user?.org_id || req.user?.organization_id;
//   const { branch_id, name, description, max_capacity = 20, duration_minutes = 60, price = 0.00 } = req.body;

//   if (!branch_id || !name) {
//     return res.status(400).json({ success: false, message: 'branch_id aur name required hain.' });
//   }

//   try {
//     const hashId = generateHashId('cls_');
//     const query = `
//       INSERT INTO classes (
//         hash_id, organization_id, branch_id, name, description,
//         max_capacity, duration_minutes, price, is_active, created_at
//       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
//       RETURNING *;
//     `;
//     const { rows } = await db.query(query, [
//       hashId, 
//       parseInt(orgId, 10), 
//       parseInt(branch_id, 10), 
//       name.trim(), 
//       description ? description.trim() : null, 
//       parseInt(max_capacity, 10), 
//       parseInt(duration_minutes, 10),
//       parseFloat(price || 0.00)
//     ]);

//     return res.status(201).json({ success: true, message: 'Group class successfully create ho gayi.', data: rows[0] });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// // ================================================================
// // 3. GET SCHEDULED CLASS SLOTS (With Master Price Attached)
// // ================================================================
// exports.getSchedules = async (req, res) => {
//   const orgId = req.user?.orgId || req.user?.org_id || req.user?.organization_id;
//   const userId = req.user?.userId || req.user?.id;
//   const userRole = (req.user?.role || '').toLowerCase();
//   const { branch_id, date, my_classes } = req.query;

//   try {
//     let query = `
//       SELECT 
//         cs.id, cs.hash_id, cs.start_time, cs.end_time, cs.status,
//         c.id as class_id, c.name as class_name, c.max_capacity, c.duration_minutes,
//         c.price as class_price,
//         c.branch_id,
//         COALESCE(u.name, 'Staff Instructor') as trainer_name,
//         COALESCE(b.name, 'Main Branch') as branch_name,
//         COALESCE((
//           SELECT COUNT(*) 
//           FROM class_bookings cb 
//           WHERE cb.class_schedule_id = cs.id AND cb.booking_status = 'confirmed'
//         ), 0)::INTEGER AS booked_count,
//         GREATEST(0, c.max_capacity - COALESCE((
//           SELECT COUNT(*) 
//           FROM class_bookings cb 
//           WHERE cb.class_schedule_id = cs.id AND cb.booking_status = 'confirmed'
//         ), 0))::INTEGER AS available_slots,
//         COALESCE((
//           SELECT COUNT(*) 
//           FROM class_waitlists cw 
//           WHERE cw.class_schedule_id = cs.id
//         ), 0)::INTEGER AS waitlist_count,
//         COALESCE((
//           SELECT json_agg(json_build_object(
//             'booking_id', cb.id,
//             'member_id', m.id,
//             'member_name', m.first_name || ' ' || COALESCE(m.last_name, ''),
//             'member_code', m.member_code,
//             'phone', m.phone,
//             'status', cb.booking_status,
//             'booked_at', cb.booked_at
//           ))
//           FROM class_bookings cb
//           JOIN members m ON m.id = cb.member_id
//           WHERE cb.class_schedule_id = cs.id AND cb.booking_status = 'confirmed'
//         ), '[]'::json) AS bookings,
//         COALESCE((
//           SELECT json_agg(json_build_object(
//             'waitlist_id', cw.id,
//             'member_id', m.id,
//             'member_name', m.first_name || ' ' || COALESCE(m.last_name, ''),
//             'member_code', m.member_code,
//             'queue_position', cw.queue_position
//           ) ORDER BY cw.queue_position ASC)
//           FROM class_waitlists cw
//           JOIN members m ON m.id = cw.member_id
//           WHERE cw.class_schedule_id = cs.id
//         ), '[]'::json) AS waitlists
//       FROM class_schedules cs
//       JOIN classes c ON c.id = cs.class_id
//       LEFT JOIN branches b ON b.id = c.branch_id
//       LEFT JOIN users u ON u.id = cs.trainer_user_id
//       WHERE c.organization_id = $1
//     `;
//     const params = [parseInt(orgId, 10)];

//     if (branch_id && !isNaN(parseInt(branch_id, 10))) {
//       params.push(parseInt(branch_id, 10));
//       query += ` AND c.branch_id = $${params.length}`;
//     }

//     if (date) {
//       params.push(date);
//       query += ` AND DATE(cs.start_time) = $${params.length}`;
//     }

//     if (userRole === 'trainer' && my_classes === 'true') {
//       params.push(parseInt(userId, 10));
//       query += ` AND cs.trainer_user_id = $${params.length}`;
//     }

//     query += ` ORDER BY cs.start_time ASC;`;

//     const { rows } = await db.query(query, params);
//     return res.status(200).json({ success: true, count: rows.length, data: rows });
//   } catch (error) {
//     console.error("getSchedules Error:", error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// // ================================================================
// // 4. SCHEDULE A CLASS SLOT
// // ================================================================
// exports.scheduleClass = async (req, res) => {
//   const { class_id, trainer_user_id, start_time, end_time } = req.body;

//   if (!class_id || !start_time || !end_time) {
//     return res.status(400).json({ success: false, message: 'class_id, start_time, aur end_time required hain.' });
//   }

//   try {
//     const hashId = generateHashId('sch_');
//     const query = `
//       INSERT INTO class_schedules (
//         hash_id, class_id, trainer_user_id, start_time, end_time, status
//       ) VALUES ($1, $2, $3, $4, $5, 'scheduled')
//       RETURNING *;
//     `;
//     const { rows } = await db.query(query, [
//       hashId, 
//       parseInt(class_id, 10), 
//       trainer_user_id ? parseInt(trainer_user_id, 10) : null, 
//       start_time, 
//       end_time
//     ]);

//     return res.status(201).json({ success: true, message: 'Batch schedule publish ho gaya.', data: rows[0] });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// // ================================================================
// // 5. MEMBER BOOKING (🔥 FIXED: Staff Authority Overwrite + Billed Pass Check)
// // ================================================================
// exports.bookClass = async (req, res) => {
//   const client = await db.connect();
//   const orgId = req.user?.orgId || req.user?.org_id || req.user?.organization_id;
//   const userRole = (req.user?.role || req.user?.role_slug || '').toLowerCase().trim();
//   const isSuper = Boolean(req.user?.isSuperAdmin || req.user?.is_super_admin);
//   const isStaff = isSuper || ['owner', 'manager', 'receptionist', 'admin'].includes(userRole);

//   const { class_schedule_id, member_id } = req.body;

//   if (!class_schedule_id || !member_id) {
//     client.release();
//     return res.status(400).json({ 
//       success: false, 
//       message: 'class_schedule_id aur member_id required hain.' 
//     });
//   }

//   const parsedMemberId = parseInt(member_id, 10);
//   const parsedScheduleId = parseInt(class_schedule_id, 10);

//   try {
//     await client.query('BEGIN');

//     // 1. Get Class Details & Capacity
//     const scheduleRes = await client.query(
//       `SELECT cs.id, cs.start_time, c.id AS class_id, c.name AS class_name, c.max_capacity,
//               (SELECT COUNT(*) FROM class_bookings cb WHERE cb.class_schedule_id = cs.id AND cb.booking_status = 'confirmed') AS confirmed_count
//        FROM class_schedules cs
//        JOIN classes c ON cs.class_id = c.id
//        WHERE cs.id = $1 AND c.organization_id = $2
//        FOR UPDATE`,
//       [parsedScheduleId, orgId]
//     );

//     if (scheduleRes.rows.length === 0) {
//       await client.query('ROLLBACK');
//       return res.status(404).json({ success: false, message: 'Class schedule batch nahi mila.' });
//     }

//     const classInfo = scheduleRes.rows[0];

//     // 2. Access Verification (Staff Override OR Active Membership/Addon OR Billed Pass)
//     let isPermitted = isStaff; // 🔥 Owner, Manager aur Receptionist ke paas direct enroll karne ka poora right hai!
//     let accessReason = isStaff ? 'Direct Staff Desk Assignment' : '';

//     if (!isPermitted) {
//       // Check Active Membership Plan or Addon
//       const accessQuery = `
//         SELECT 
//           m.id AS membership_id,
//           p.name AS plan_name,
//           EXISTS (
//             SELECT 1 
//             FROM member_membership_addons mma
//             JOIN membership_addons ma ON ma.id = mma.addon_id
//             WHERE mma.membership_id = m.id 
//               AND (ma.name ILIKE '%' || $2 || '%' OR ma.name ILIKE '%Class%' OR ma.name ILIKE '%Studio%')
//           ) AS has_addon_access
//         FROM memberships m
//         JOIN membership_plans p ON p.id = m.plan_id
//         WHERE m.member_id = $1 
//           AND m.organization_id = $3
//           AND m.status = 'active'
//           AND CURRENT_DATE BETWEEN m.start_date AND m.end_date
//         ORDER BY m.id DESC;
//       `;
//       const accessRes = await client.query(accessQuery, [parsedMemberId, classInfo.class_name, orgId]);

//       if (accessRes.rows.length > 0) {
//         for (const row of accessRes.rows) {
//           const planLower = row.plan_name.toLowerCase();
//           const classLower = classInfo.class_name.toLowerCase();
//           if (planLower.includes(classLower) || planLower.includes('all-access') || planLower.includes('unlimited') || planLower.includes('vip') || planLower.includes('gold')) {
//             isPermitted = true;
//             accessReason = `Dedicated Plan: ${row.plan_name}`;
//             break;
//           }
//           if (row.has_addon_access) {
//             isPermitted = true;
//             accessReason = `Add-on Service Attached with ${row.plan_name}`;
//             break;
//           }
//         }
//       }

//       // Check if Member purchased a Class Pass via POS Invoicing
//       if (!isPermitted) {
//         const invCheck = await client.query(
//           `SELECT ii.id FROM invoice_items ii
//            JOIN invoices i ON i.id = ii.invoice_id
//            WHERE i.member_id = $1 AND i.organization_id = $2 AND i.payment_status IN ('paid', 'partially_paid')
//              AND (ii.item_type = 'class_enrollment' OR ii.description ILIKE '%' || $3 || '%')
//            LIMIT 1`,
//           [parsedMemberId, orgId, classInfo.class_name]
//         );
//         if (invCheck.rows.length > 0) {
//           isPermitted = true;
//           accessReason = 'Billed Class Pass Paid at Counter';
//         }
//       }
//     }

//     if (!isPermitted) {
//       await client.query('ROLLBACK');
//       return res.status(403).json({
//         success: false,
//         message: `Booking Denied: Member ke paas "${classInfo.class_name}" ka koi active membership plan ya add-on pack nahi hai. Kripya counter se Plan ya Class Add-on assign karein.`
//       });
//     }

//     // 3. Confirm Slot ya Waitlist
//     const confirmedCount = parseInt(classInfo.confirmed_count, 10);
//     const maxCapacity = parseInt(classInfo.max_capacity, 10);

//     if (confirmedCount < maxCapacity) {
//       const hashId = generateHashId('cbk_');
//       const bookQuery = `
//         INSERT INTO class_bookings (
//           hash_id, class_schedule_id, member_id, booking_status, booked_at, cancelled_at
//         ) VALUES ($1, $2, $3, 'confirmed', NOW(), NULL)
//         ON CONFLICT (class_schedule_id, member_id)
//         DO UPDATE SET booking_status = 'confirmed', cancelled_at = NULL
//         RETURNING *;
//       `;
//       const { rows } = await client.query(bookQuery, [hashId, parsedScheduleId, parsedMemberId]);
//       await client.query('COMMIT');
//       return res.status(201).json({ 
//         success: true, 
//         message: `Class slot confirmed! Remaining seats: ${maxCapacity - (confirmedCount + 1)}`, 
//         booking: rows[0],
//         remaining_slots: maxCapacity - (confirmedCount + 1)
//       });
//     }

//     // Waitlist Insertion (FIFO)
//     const waitlistCountRes = await client.query(
//       'SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_pos FROM class_waitlists WHERE class_schedule_id = $1',
//       [parsedScheduleId]
//     );
//     const nextQueuePos = waitlistCountRes.rows[0].next_pos;
//     const waitlistQuery = `
//       INSERT INTO class_waitlists (
//         class_schedule_id, member_id, queue_position, created_at
//       ) VALUES ($1, $2, $3, NOW())
//       ON CONFLICT (class_schedule_id, member_id)
//       DO UPDATE SET queue_position = EXCLUDED.queue_position
//       RETURNING *;
//     `;
//     const waitlistRes = await client.query(waitlistQuery, [parsedScheduleId, parsedMemberId, nextQueuePos]);

//     await client.query('COMMIT');
//     return res.status(200).json({
//       success: true,
//       message: `Batch full hai. Member Waitlist position #${nextQueuePos} par add ho gaya.`,
//       waitlist: waitlistRes.rows[0]
//     });
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('bookClass Error:', error);
//     return res.status(500).json({ success: false, error: error.message });
//   } finally {
//     client.release();
//   }
// };

// // ================================================================
// // 6. CANCEL BOOKING & AUTO-PROMOTE FIRST WAITLIST MEMBER (FIFO)
// // ================================================================
// exports.cancelBooking = async (req, res) => {
//   const client = await db.connect();
//   const { booking_id } = req.body;

//   if (!booking_id) {
//     client.release();
//     return res.status(400).json({ success: false, message: 'booking_id zaroori hai.' });
//   }

//   try {
//     await client.query('BEGIN');

//     const bkRes = await client.query(
//       "UPDATE class_bookings SET booking_status = 'cancelled', cancelled_at = NOW() WHERE id = $1 RETURNING *;",
//       [booking_id]
//     );

//     if (bkRes.rows.length === 0) {
//       await client.query('ROLLBACK');
//       return res.status(404).json({ success: false, message: 'Booking nahi mili.' });
//     }

//     const cancelledBooking = bkRes.rows[0];
//     const scheduleId = cancelledBooking.class_schedule_id;

//     const nextWaitlistRes = await client.query(
//       "SELECT * FROM class_waitlists WHERE class_schedule_id = $1 ORDER BY queue_position ASC LIMIT 1 FOR UPDATE;",
//       [scheduleId]
//     );

//     let promotedMember = null;
//     if (nextWaitlistRes.rows.length > 0) {
//       const waitlistEntry = nextWaitlistRes.rows[0];
//       const hashId = generateHashId('cbk_');

//       const promoteRes = await client.query(
//         "INSERT INTO class_bookings (hash_id, class_schedule_id, member_id, booking_status, booked_at) VALUES ($1, $2, $3, 'confirmed', NOW()) RETURNING *;",
//         [hashId, scheduleId, waitlistEntry.member_id]
//       );
//       promotedMember = promoteRes.rows[0];

//       await client.query("DELETE FROM class_waitlists WHERE id = $1", [waitlistEntry.id]);
//       await client.query(
//         "UPDATE class_waitlists SET queue_position = queue_position - 1 WHERE class_schedule_id = $1;",
//         [scheduleId]
//       );
//     }

//     await client.query('COMMIT');
//     return res.status(200).json({
//       success: true,
//       message: 'Booking cancel ho gayi.' + (promotedMember ? ' Waitlist se agla member confirm ho gaya!' : ''),
//       promoted: promotedMember
//     });
//   } catch (error) {
//     await client.query('ROLLBACK');
//     return res.status(500).json({ success: false, error: error.message });
//   } finally {
//     client.release();
//   }
// };

// // ================================================================
// // 7. GET MEMBER'S ENROLLED CLASSES (🔥 FIXED: cw.hash_id Removed)
// // ================================================================
// exports.getMemberClasses = async (req, res) => {
//   const orgId = req.user?.orgId || req.user?.org_id || req.user?.organization_id;
//   const { memberId } = req.params;

//   if (!memberId || isNaN(parseInt(memberId, 10))) {
//     return res.status(400).json({ success: false, message: 'Valid memberId zaroori hai.' });
//   }

//   try {
//     const query = `
//       SELECT * FROM (
//         SELECT 
//           cb.id AS booking_id,
//           cb.hash_id AS booking_hash_id,
//           cb.booking_status::TEXT AS booking_status,
//           cb.booked_at,
//           CAST(NULL AS INTEGER) AS waitlist_queue_position,
//           cs.id AS schedule_id,
//           cs.start_time,
//           cs.end_time,
//           cs.status AS schedule_status,
//           c.id AS class_id,
//           c.name AS class_name,
//           c.duration_minutes,
//           c.max_capacity,
//           c.price AS class_price,
//           b.name AS branch_name,
//           COALESCE(u.name, 'Staff Instructor') AS trainer_name
//         FROM class_bookings cb
//         JOIN class_schedules cs ON cs.id = cb.class_schedule_id
//         JOIN classes c ON c.id = cs.class_id
//         JOIN branches b ON b.id = c.branch_id
//         LEFT JOIN users u ON u.id = cs.trainer_user_id
//         WHERE cb.member_id = $1 
//           AND c.organization_id = $2
//           AND cb.booking_status = 'confirmed'
//         UNION ALL
//         SELECT 
//           cw.id AS booking_id,
//           CAST(NULL AS VARCHAR(32)) AS booking_hash_id, -- 🔥 FIXED: cw.hash_id hatakar NULL cast kiya taaki query crash na ho!
//           'waitlist'::TEXT AS booking_status,
//           cw.created_at AS booked_at,
//           cw.queue_position AS waitlist_queue_position,
//           cs.id AS schedule_id,
//           cs.start_time,
//           cs.end_time,
//           cs.status AS schedule_status,
//           c.id AS class_id,
//           c.name AS class_name,
//           c.duration_minutes,
//           c.max_capacity,
//           c.price AS class_price,
//           b.name AS branch_name,
//           COALESCE(u.name, 'Staff Instructor') AS trainer_name
//         FROM class_waitlists cw
//         JOIN class_schedules cs ON cs.id = cw.class_schedule_id
//         JOIN classes c ON c.id = cs.class_id
//         JOIN branches b ON b.id = c.branch_id
//         LEFT JOIN users u ON u.id = cs.trainer_user_id
//         WHERE cw.member_id = $1 
//           AND c.organization_id = $2
//       ) AS combined_classes
//       ORDER BY start_time ASC;
//     `;
//     const { rows } = await db.query(query, [
//       parseInt(memberId, 10), 
//       parseInt(orgId, 10)
//     ]);

//     return res.status(200).json({ 
//       success: true, 
//       count: rows.length, 
//       data: rows 
//     });
//   } catch (error) {
//     console.error('getMemberClasses Error:', error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };
const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. GET ALL MASTER CLASSES
// ================================================================
exports.getClasses = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id || req.user?.organization_id;
  const { branch_id } = req.query;

  try {
    let query = `
      SELECT 
        c.*,
        b.name as branch_name,
        (SELECT COUNT(*) FROM class_schedules cs WHERE cs.class_id = c.id AND cs.status = 'scheduled') AS active_schedules_count
      FROM classes c
      JOIN branches b ON b.id = c.branch_id
      WHERE c.organization_id = $1
    `;
    const params = [parseInt(orgId, 10)];

    if (branch_id && !isNaN(parseInt(branch_id, 10))) {
      params.push(parseInt(branch_id, 10));
      query += ` AND c.branch_id = $${params.length}`;
    }

    query += ` ORDER BY c.id DESC;`;

    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. CREATE MASTER GROUP CLASS
// ================================================================
exports.createClass = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id || req.user?.organization_id;
  const { branch_id, name, description, max_capacity = 20, duration_minutes = 60, price = 0.00 } = req.body;

  if (!branch_id || !name) {
    return res.status(400).json({ success: false, message: 'branch_id aur name required hain.' });
  }

  try {
    const hashId = generateHashId('cls_');
    const query = `
      INSERT INTO classes (
        hash_id, organization_id, branch_id, name, description,
        max_capacity, duration_minutes, price, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, 
      parseInt(orgId, 10), 
      parseInt(branch_id, 10), 
      name.trim(), 
      description ? description.trim() : null, 
      parseInt(max_capacity, 10), 
      parseInt(duration_minutes, 10),
      parseFloat(price || 0.00)
    ]);

    return res.status(201).json({ success: true, message: 'Group class successfully create ho gayi.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 3. GET SCHEDULED CLASS SLOTS (With Full Member Profiles & Invoice Info)
// ================================================================
exports.getSchedules = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id || req.user?.organization_id;
  const userId = req.user?.userId || req.user?.id;
  const userRole = (req.user?.role || '').toLowerCase();
  const { branch_id, date, my_classes } = req.query;

  try {
    let query = `
      SELECT 
        cs.id, cs.hash_id, cs.start_time, cs.end_time, cs.status,
        c.id as class_id, c.name as class_name, c.max_capacity, c.duration_minutes,
        c.price as class_price,
        c.branch_id,
        COALESCE(u.name, 'Staff Instructor') as trainer_name,
        COALESCE(b.name, 'Main Branch') as branch_name,
        COALESCE((
          SELECT COUNT(*) 
          FROM class_bookings cb 
          WHERE cb.class_schedule_id = cs.id AND cb.booking_status = 'confirmed'
        ), 0)::INTEGER AS booked_count,
        GREATEST(0, c.max_capacity - COALESCE((
          SELECT COUNT(*) 
          FROM class_bookings cb 
          WHERE cb.class_schedule_id = cs.id AND cb.booking_status = 'confirmed'
        ), 0))::INTEGER AS available_slots,
        COALESCE((
          SELECT COUNT(*) 
          FROM class_waitlists cw 
          WHERE cw.class_schedule_id = cs.id
        ), 0)::INTEGER AS waitlist_count,
        COALESCE((
          SELECT json_agg(json_build_object(
            'booking_id', cb.id,
            'member_id', m.id,
            'member_hash_id', m.hash_id,
            'member_name', m.first_name || ' ' || COALESCE(m.last_name, ''),
            'member_code', m.member_code,
            'phone', m.phone,
            'profile_image_url', m.profile_image_url,
            'invoice_id', cb.invoice_id,
            'invoice_number', inv.invoice_number,
            'invoice_status', inv.payment_status,
            'status', cb.booking_status,
            'booked_at', cb.booked_at
          ))
          FROM class_bookings cb
          JOIN members m ON m.id = cb.member_id
          LEFT JOIN invoices inv ON inv.id = cb.invoice_id
          WHERE cb.class_schedule_id = cs.id AND cb.booking_status = 'confirmed'
        ), '[]'::json) AS bookings,
        COALESCE((
          SELECT json_agg(json_build_object(
            'waitlist_id', cw.id,
            'member_id', m.id,
            'member_hash_id', m.hash_id,
            'member_name', m.first_name || ' ' || COALESCE(m.last_name, ''),
            'member_code', m.member_code,
            'phone', m.phone,
            'profile_image_url', m.profile_image_url,
            'queue_position', cw.queue_position
          ) ORDER BY cw.queue_position ASC)
          FROM class_waitlists cw
          JOIN members m ON m.id = cw.member_id
          WHERE cw.class_schedule_id = cs.id
        ), '[]'::json) AS waitlists
      FROM class_schedules cs
      JOIN classes c ON c.id = cs.class_id
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN users u ON u.id = cs.trainer_user_id
      WHERE c.organization_id = $1
    `;
    const params = [parseInt(orgId, 10)];

    if (branch_id && !isNaN(parseInt(branch_id, 10))) {
      params.push(parseInt(branch_id, 10));
      query += ` AND c.branch_id = $${params.length}`;
    }

    if (date) {
      params.push(date);
      query += ` AND DATE(cs.start_time) = $${params.length}`;
    }

    if (userRole === 'trainer' && my_classes === 'true') {
      params.push(parseInt(userId, 10));
      query += ` AND cs.trainer_user_id = $${params.length}`;
    }

    query += ` ORDER BY cs.start_time ASC;`;

    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("getSchedules Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 4. SCHEDULE A CLASS SLOT
// ================================================================
exports.scheduleClass = async (req, res) => {
  const { class_id, trainer_user_id, start_time, end_time } = req.body;

  if (!class_id || !start_time || !end_time) {
    return res.status(400).json({ success: false, message: 'class_id, start_time, aur end_time required hain.' });
  }

  try {
    const hashId = generateHashId('sch_');
    const query = `
      INSERT INTO class_schedules (
        hash_id, class_id, trainer_user_id, start_time, end_time, status
      ) VALUES ($1, $2, $3, $4, $5, 'scheduled')
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, 
      parseInt(class_id, 10), 
      trainer_user_id ? parseInt(trainer_user_id, 10) : null, 
      start_time, 
      end_time
    ]);

    return res.status(201).json({ success: true, message: 'Batch schedule publish ho gaya.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 5. DIRECT SLOT BOOKING (Fallback with Billed Pass Verification)
// ================================================================
exports.bookClass = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id || req.user?.organization_id;
  const userRole = (req.user?.role || req.user?.role_slug || '').toLowerCase().trim();
  const isSuper = Boolean(req.user?.isSuperAdmin || req.user?.is_super_admin);
  const isStaff = isSuper || ['owner', 'manager', 'receptionist', 'admin'].includes(userRole);

  const { class_schedule_id, member_id, invoice_id } = req.body;

  if (!class_schedule_id || !member_id) {
    client.release();
    return res.status(400).json({ success: false, message: 'class_schedule_id aur member_id required hain.' });
  }

  const parsedMemberId = parseInt(member_id, 10);
  const parsedScheduleId = parseInt(class_schedule_id, 10);

  try {
    await client.query('BEGIN');

    const scheduleRes = await client.query(
      `SELECT cs.id, cs.start_time, c.id AS class_id, c.name AS class_name, c.max_capacity,
              (SELECT COUNT(*) FROM class_bookings cb WHERE cb.class_schedule_id = cs.id AND cb.booking_status = 'confirmed') AS confirmed_count
       FROM class_schedules cs
       JOIN classes c ON cs.class_id = c.id
       WHERE cs.id = $1 AND c.organization_id = $2
       FOR UPDATE`,
      [parsedScheduleId, orgId]
    );

    if (scheduleRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Class schedule batch nahi mila.' });
    }

    const classInfo = scheduleRes.rows[0];

    // Determine linked invoice if not explicitly provided
    let linkedInvoiceId = invoice_id ? parseInt(invoice_id, 10) : null;
    if (!linkedInvoiceId) {
      const invCheck = await client.query(
        `SELECT i.id FROM invoices i
         JOIN invoice_items ii ON ii.invoice_id = i.id
         WHERE i.member_id = $1 AND i.organization_id = $2 AND i.payment_status IN ('paid', 'partially_paid')
           AND (ii.item_type = 'class_enrollment' OR ii.description ILIKE '%' || $3 || '%')
         ORDER BY i.id DESC LIMIT 1`,
        [parsedMemberId, orgId, classInfo.class_name]
      );
      if (invCheck.rows.length > 0) {
        linkedInvoiceId = invCheck.rows[0].id;
      }
    }

    const confirmedCount = parseInt(classInfo.confirmed_count, 10);
    const maxCapacity = parseInt(classInfo.max_capacity, 10);

    if (confirmedCount < maxCapacity) {
      const hashId = generateHashId('cbk_');
      const bookQuery = `
        INSERT INTO class_bookings (
          hash_id, class_schedule_id, member_id, booking_status, booked_at, cancelled_at, invoice_id
        ) VALUES ($1, $2, $3, 'confirmed', NOW(), NULL, $4)
        ON CONFLICT (class_schedule_id, member_id)
        DO UPDATE SET booking_status = 'confirmed', cancelled_at = NULL, invoice_id = COALESCE(EXCLUDED.invoice_id, class_bookings.invoice_id)
        RETURNING *;
      `;
      const { rows } = await client.query(bookQuery, [hashId, parsedScheduleId, parsedMemberId, linkedInvoiceId]);
      await client.query('COMMIT');
      return res.status(201).json({ 
        success: true, 
        message: `Class slot confirmed! Remaining seats: ${maxCapacity - (confirmedCount + 1)}`, 
        booking: rows[0],
        remaining_slots: maxCapacity - (confirmedCount + 1)
      });
    }

    // Waitlist Insertion
    const waitlistCountRes = await client.query(
      'SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_pos FROM class_waitlists WHERE class_schedule_id = $1',
      [parsedScheduleId]
    );
    const nextQueuePos = waitlistCountRes.rows[0].next_pos;
    const waitlistQuery = `
      INSERT INTO class_waitlists (
        class_schedule_id, member_id, queue_position, created_at
      ) VALUES ($1, $2, $3, NOW())
      ON CONFLICT (class_schedule_id, member_id)
      DO UPDATE SET queue_position = EXCLUDED.queue_position
      RETURNING *;
    `;
    const waitlistRes = await client.query(waitlistQuery, [parsedScheduleId, parsedMemberId, nextQueuePos]);

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: `Batch full hai. Member Waitlist position #${nextQueuePos} par add ho gaya.`,
      waitlist: waitlistRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('bookClass Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 6. CANCEL BOOKING & AUTO-FIFO PROMOTE
// ================================================================
exports.cancelBooking = async (req, res) => {
  const client = await db.connect();
  const { booking_id } = req.body;

  if (!booking_id) {
    client.release();
    return res.status(400).json({ success: false, message: 'booking_id zaroori hai.' });
  }

  try {
    await client.query('BEGIN');

    const bkRes = await client.query(
      "UPDATE class_bookings SET booking_status = 'cancelled', cancelled_at = NOW() WHERE id = $1 RETURNING *;",
      [booking_id]
    );

    if (bkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Booking nahi mili.' });
    }

    const cancelledBooking = bkRes.rows[0];
    const scheduleId = cancelledBooking.class_schedule_id;

    const nextWaitlistRes = await client.query(
      "SELECT * FROM class_waitlists WHERE class_schedule_id = $1 ORDER BY queue_position ASC LIMIT 1 FOR UPDATE;",
      [scheduleId]
    );

    let promotedMember = null;
    if (nextWaitlistRes.rows.length > 0) {
      const waitlistEntry = nextWaitlistRes.rows[0];
      const hashId = generateHashId('cbk_');

      const promoteRes = await client.query(
        "INSERT INTO class_bookings (hash_id, class_schedule_id, member_id, booking_status, booked_at) VALUES ($1, $2, $3, 'confirmed', NOW()) RETURNING *;",
        [hashId, scheduleId, waitlistEntry.member_id]
      );
      promotedMember = promoteRes.rows[0];

      await client.query("DELETE FROM class_waitlists WHERE id = $1", [waitlistEntry.id]);
      await client.query(
        "UPDATE class_waitlists SET queue_position = queue_position - 1 WHERE class_schedule_id = $1;",
        [scheduleId]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Booking cancel ho gayi.' + (promotedMember ? ' Waitlist se agla member confirm ho gaya!' : ''),
      promoted: promotedMember
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 7. GET MEMBER'S ENROLLED CLASSES
// ================================================================
exports.getMemberClasses = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id || req.user?.organization_id;
  const { memberId } = req.params;

  if (!memberId || isNaN(parseInt(memberId, 10))) {
    return res.status(400).json({ success: false, message: 'Valid memberId zaroori hai.' });
  }

  try {
    const query = `
      SELECT * FROM (
        SELECT 
          cb.id AS booking_id,
          cb.hash_id AS booking_hash_id,
          cb.booking_status::TEXT AS booking_status,
          cb.booked_at,
          CAST(NULL AS INTEGER) AS waitlist_queue_position,
          cs.id AS schedule_id,
          cs.start_time,
          cs.end_time,
          cs.status AS schedule_status,
          c.id AS class_id,
          c.name AS class_name,
          c.duration_minutes,
          c.max_capacity,
          c.price AS class_price,
          b.name AS branch_name,
          COALESCE(u.name, 'Staff Instructor') AS trainer_name
        FROM class_bookings cb
        JOIN class_schedules cs ON cs.id = cb.class_schedule_id
        JOIN classes c ON c.id = cs.class_id
        JOIN branches b ON b.id = c.branch_id
        LEFT JOIN users u ON u.id = cs.trainer_user_id
        WHERE cb.member_id = $1 
          AND c.organization_id = $2
          AND cb.booking_status = 'confirmed'
        UNION ALL
        SELECT 
          cw.id AS booking_id,
          CAST(NULL AS VARCHAR(32)) AS booking_hash_id,
          'waitlist'::TEXT AS booking_status,
          cw.created_at AS booked_at,
          cw.queue_position AS waitlist_queue_position,
          cs.id AS schedule_id,
          cs.start_time,
          cs.end_time,
          cs.status AS schedule_status,
          c.id AS class_id,
          c.name AS class_name,
          c.duration_minutes,
          c.max_capacity,
          c.price AS class_price,
          b.name AS branch_name,
          COALESCE(u.name, 'Staff Instructor') AS trainer_name
        FROM class_waitlists cw
        JOIN class_schedules cs ON cs.id = cw.class_schedule_id
        JOIN classes c ON c.id = cs.class_id
        JOIN branches b ON b.id = c.branch_id
        LEFT JOIN users u ON u.id = cs.trainer_user_id
        WHERE cw.member_id = $1 
          AND c.organization_id = $2
      ) AS combined_classes
      ORDER BY start_time ASC;
    `;
    const { rows } = await db.query(query, [
      parseInt(memberId, 10), 
      parseInt(orgId, 10)
    ]);

    return res.status(200).json({ 
      success: true, 
      count: rows.length, 
      data: rows 
    });
  } catch (error) {
    console.error('getMemberClasses Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};