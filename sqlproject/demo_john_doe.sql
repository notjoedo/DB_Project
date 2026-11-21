-- =====================================================================
--  DEMO DATA ONLY (like the sample data in volunteer_db.sql, not an app feature)
--  Gives the demo volunteer john@gmail.com a realistic history so his
--  Reports page has data: 5 completed events across 3 organizations and
--  5 months, 1 cancelled sign-up, and 1 upcoming pending sign-up.
--  Safe to run more than once (UQ_Registration_UserOpp + INSERT IGNORE).
--
--  Run:  docker exec -i -e MYSQL_PWD=treefinder treefinder-mysql \
--          mysql -uroot volunteer_db < sqlproject/demo_john_doe.sql
-- =====================================================================

INSERT IGNORE INTO Registration (UserID, OpportunityID, RegistrationDate, Status, HoursLogged)
SELECT u.UserID, v.OpportunityID, d.RegistrationDate, d.Status, d.HoursLogged
FROM Users u
JOIN (
  SELECT 'Spring Street Tree Planting' AS Title, DATE '2026-03-10' AS RegistrationDate, 'Completed' AS Status, 4.0 AS HoursLogged
  UNION ALL SELECT 'Riverbank Cleanup Day',        '2026-03-30', 'Completed', 3.0
  UNION ALL SELECT 'Trail Erosion Repair',         '2026-06-05', 'Cancelled', 0.0
  UNION ALL SELECT 'Summer Tree Watering Crew',    '2026-07-14', 'Completed', 3.5
  UNION ALL SELECT 'Tree Health Survey',           '2026-08-30', 'Completed', 5.5
  UNION ALL SELECT 'Fall Tree Planting Festival',  '2026-10-25', 'Completed', 4.5
  UNION ALL SELECT 'School Arbor Day Prep',        '2026-11-20', 'Pending',   0.0
) d
JOIN VolunteerOpportunity v ON v.Title = d.Title
WHERE u.Email = 'john@gmail.com';

-- What John's reports will summarize
SELECT r.Status, COUNT(*) AS SignUps, SUM(r.HoursLogged) AS Hours
FROM Registration r JOIN Users u ON u.UserID = r.UserID
WHERE u.Email = 'john@gmail.com'
GROUP BY r.Status;
